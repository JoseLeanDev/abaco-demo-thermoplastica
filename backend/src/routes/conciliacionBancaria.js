const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const { parsePeriodo } = require('../services/periodo');

// Conciliación bancaria — thermoplastica.fact_conciliacion_bancaria (vista del ERP
// dbo.vst_ConciliacionBancaria, foto completa diaria 06:00 GT; migración 029).
//
// La vista trae solo el lado LIBROS (movimientos registrados en Profit) con su marca de
// conciliación. No hay estado de cuenta del banco, así que:
//   saldo en libros al corte  = Σ monto_neto de movimientos no anulados con fecha ≤ corte
//   pendiente al corte        = no anulado, fecha ≤ corte y (sin conciliar o conciliado después del corte)
//   saldo según banco (est.)  = libros − pendientes = lo que el banco ya reflejó al corte
// Corte = `hasta` del filtro global. Montos en la moneda de cada cuenta: sumar con la tasa de
// cada movimiento no da un saldo en Q válido, por eso los totales van por moneda.

const T = 'thermoplastica.fact_conciliacion_bancaria';
// Fechas que el ERP trae mal digitadas (1922, 1932, 2067…) o que la vista marca fuera de rango
const SOSPECHOSA = `(m.fecha_fuera_de_rango OR m.fecha < DATE '2010-01-01' OR m.fecha > CURRENT_DATE)`;
const PENDIENTE = (corte) => `NOT m.anulado AND m.fecha <= ${corte}
  AND (NOT m.conciliado OR m.fecha_conciliacion IS NULL OR m.fecha_conciliacion > ${corte})`;

const num = (v) => (v == null ? 0 : parseFloat(v) || 0);
const int = (v) => (v == null ? 0 : parseInt(v, 10) || 0);

// GET /api/conciliacion-bancaria   Resumen por cuenta al corte + movimientos del período
router.get('/', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const { D, H } = P;

    const cuentas = await db.allAsync(`
      SELECT m.cod_cta, MAX(m.num_cta) AS num_cta, MAX(m.banco) AS banco, MAX(m.moneda_cuenta) AS moneda,
        COALESCE(SUM(m.monto_neto) FILTER (WHERE NOT m.anulado AND m.fecha <= ${H}), 0)          AS saldo_libros,
        COALESCE(SUM(m.monto_neto) FILTER (WHERE ${PENDIENTE(H)}), 0)                            AS pendiente_monto,
        COUNT(*) FILTER (WHERE ${PENDIENTE(H)})                                                  AS pendiente_n,
        COALESCE(SUM(m.monto_neto) FILTER (WHERE ${PENDIENTE(H)} AND m.monto_neto > 0), 0)       AS pendiente_entradas,
        COALESCE(SUM(m.monto_neto) FILTER (WHERE ${PENDIENTE(H)} AND m.monto_neto < 0), 0)       AS pendiente_salidas,
        (MAX(m.fecha_conciliacion) FILTER (WHERE m.conciliado AND m.fecha_conciliacion <= ${H}
                                          AND m.fecha_conciliacion >= DATE '2010-01-01'))::text  AS ultima_conciliacion,
        (MAX(m.fecha) FILTER (WHERE m.fecha <= ${H} AND m.fecha >= DATE '2010-01-01'))::text     AS ultimo_movimiento,
        COUNT(*) FILTER (WHERE m.fecha BETWEEN ${D} AND ${H} AND NOT m.anulado)                  AS mov_periodo,
        COUNT(*) FILTER (WHERE m.fecha BETWEEN ${D} AND ${H} AND NOT m.anulado AND m.conciliado
                         AND m.fecha_conciliacion <= ${H})                                       AS mov_periodo_conciliados,
        COALESCE(SUM(m.entrada) FILTER (WHERE m.fecha BETWEEN ${D} AND ${H} AND NOT m.anulado), 0) AS entradas_periodo,
        COALESCE(SUM(m.salida + m.idb) FILTER (WHERE m.fecha BETWEEN ${D} AND ${H} AND NOT m.anulado), 0) AS salidas_periodo,
        COUNT(*) FILTER (WHERE m.fecha BETWEEN ${D} AND ${H} AND m.anulado)                      AS anulados_periodo
      FROM ${T} m
      GROUP BY m.cod_cta
      ORDER BY MAX(m.banco), m.cod_cta
    `);

    const antiguedad = await db.allAsync(`
      WITH p AS (
        SELECT m.moneda_cuenta AS moneda, m.monto_neto, (${H} - m.fecha) AS dias
        FROM ${T} m WHERE ${PENDIENTE(H)}
      )
      SELECT CASE WHEN dias <= 30 THEN '0-30' WHEN dias <= 60 THEN '31-60' WHEN dias <= 90 THEN '61-90'
                  WHEN dias <= 180 THEN '91-180' ELSE '180+' END AS tramo,
             moneda, COUNT(*) AS n, SUM(monto_neto) AS monto
      FROM p GROUP BY 1, 2
    `);

    const pendientes = await db.allAsync(`
      SELECT m.id_movimiento, m.cod_cta, m.banco, m.moneda_cuenta AS moneda, m.fecha::text AS fecha, m.doc_num,
             m.tipo_operacion, m.estado_conciliacion, m.conciliado, m.fecha_conciliacion::text AS fecha_conciliacion,
             m.tercero, COALESCE(m.descripcion, m.concepto) AS descripcion, m.monto_neto,
             (${H} - m.fecha) AS dias, ${SOSPECHOSA} AS fecha_sospechosa
      FROM ${T} m WHERE ${PENDIENTE(H)}
      ORDER BY m.fecha
      LIMIT 500
    `);

    const sospechosas = await db.allAsync(`
      SELECT m.id_movimiento, m.cod_cta, m.banco, m.moneda_cuenta AS moneda, m.fecha::text AS fecha, m.fecha_creacion::date::text AS fecha_registro,
             m.doc_num, m.tipo_operacion, m.estado_conciliacion, m.monto_neto,
             COALESCE(m.descripcion, m.concepto) AS descripcion
      FROM ${T} m WHERE ${SOSPECHOSA} AND NOT m.anulado
      ORDER BY m.fecha
    `);

    const carga = await db.getAsync(`SELECT MAX(cargado_en) AS cargado_en, COUNT(*) AS filas FROM ${T}`);

    const filas = cuentas.map((c) => {
      const libros = num(c.saldo_libros), pend = num(c.pendiente_monto);
      const movs = int(c.mov_periodo), conc = int(c.mov_periodo_conciliados);
      return {
        cod_cta: c.cod_cta, num_cta: c.num_cta, banco: c.banco, moneda: c.moneda,
        saldo_libros: libros,
        saldo_banco: Math.round((libros - pend) * 100) / 100,
        diferencia: pend,
        pendiente_n: int(c.pendiente_n),
        pendiente_entradas: num(c.pendiente_entradas),
        pendiente_salidas: num(c.pendiente_salidas),
        ultima_conciliacion: c.ultima_conciliacion,
        ultimo_movimiento: c.ultimo_movimiento,
        mov_periodo: movs,
        mov_periodo_conciliados: conc,
        pct_conciliado: movs > 0 ? Math.round((conc / movs) * 1000) / 10 : null,
        entradas_periodo: num(c.entradas_periodo),
        salidas_periodo: num(c.salidas_periodo),
        anulados_periodo: int(c.anulados_periodo),
      };
    });

    // Totales por moneda (no se convierten a Q)
    const porMoneda = {};
    for (const f of filas) {
      const t = (porMoneda[f.moneda] ||= { moneda: f.moneda, cuentas: 0, saldo_libros: 0, saldo_banco: 0, diferencia: 0, pendiente_n: 0, entradas_periodo: 0, salidas_periodo: 0 });
      t.cuentas += 1;
      for (const k of ['saldo_libros', 'saldo_banco', 'diferencia', 'pendiente_n', 'entradas_periodo', 'salidas_periodo']) t[k] += f[k];
    }
    const totales = Object.values(porMoneda).map((t) => ({
      ...t,
      saldo_libros: Math.round(t.saldo_libros * 100) / 100,
      saldo_banco: Math.round(t.saldo_banco * 100) / 100,
      diferencia: Math.round(t.diferencia * 100) / 100,
    }));

    const movTot = filas.reduce((s, f) => s + f.mov_periodo, 0);
    const concTot = filas.reduce((s, f) => s + f.mov_periodo_conciliados, 0);
    const ultimas = filas.map((f) => f.ultima_conciliacion).filter(Boolean).sort();

    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        corte: P.hasta,
        actualizado_en: carga?.cargado_en || null,
        filas_tabla: int(carga?.filas),
        cuentas: filas,
        totales_moneda: totales,
        periodo: {
          movimientos: movTot,
          conciliados: concTot,
          pct_conciliado: movTot > 0 ? Math.round((concTot / movTot) * 1000) / 10 : null,
          anulados: filas.reduce((s, f) => s + f.anulados_periodo, 0),
        },
        pendientes_total: filas.reduce((s, f) => s + f.pendiente_n, 0),
        ultima_conciliacion_min: ultimas[0] || null,
        antiguedad: antiguedad.map((a) => ({ tramo: a.tramo, moneda: a.moneda, n: int(a.n), monto: num(a.monto) })),
        pendientes: pendientes.map((p) => ({ ...p, monto_neto: num(p.monto_neto), dias: int(p.dias) })),
        fechas_sospechosas: sospechosas.map((s) => ({ ...s, monto_neto: num(s.monto_neto) })),
      },
    });
  } catch (error) {
    console.error('[conciliacion-bancaria] resumen:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/conciliacion-bancaria/movimientos?cuenta=&estado=&busqueda=&limit=&offset=
// Movimientos con fecha en el período. estado: todos | conciliado | pendiente | anulado
router.get('/movimientos', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const { D, H } = P;
    const where = [`m.fecha BETWEEN ${D} AND ${H}`];
    const params = [];
    if (req.query.cuenta) { params.push(String(req.query.cuenta)); where.push('m.cod_cta = ?'); }
    const estado = String(req.query.estado || 'todos');
    if (estado === 'conciliado') where.push(`NOT m.anulado AND m.conciliado AND m.fecha_conciliacion <= ${H}`);
    else if (estado === 'pendiente') where.push(PENDIENTE(H));
    else if (estado === 'anulado') where.push('m.anulado');
    const busqueda = String(req.query.busqueda || '').trim();
    if (busqueda) {
      params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
      where.push('(m.doc_num ILIKE ? OR m.tercero ILIKE ? OR COALESCE(m.descripcion, m.concepto) ILIKE ?)');
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 10000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const W = where.join(' AND ');

    const tot = await db.getAsync(`SELECT COUNT(*) AS n FROM ${T} m WHERE ${W}`, params);
    const filas = await db.allAsync(`
      SELECT m.id_movimiento, m.cod_cta, m.banco, m.moneda_cuenta AS moneda, m.fecha::text AS fecha, m.doc_num,
             m.tipo_operacion, m.modulo_origen, m.tercero, COALESCE(m.descripcion, m.concepto) AS descripcion,
             m.entrada, m.salida + m.idb AS salida, m.monto_neto, m.anulado, m.conciliado,
             m.fecha_conciliacion::text AS fecha_conciliacion, m.estado_conciliacion
      FROM ${T} m WHERE ${W}
      ORDER BY m.fecha DESC, m.id_movimiento DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    res.json({
      status: 'success',
      data: {
        total_filas: int(tot?.n),
        filas: filas.map((f) => ({ ...f, entrada: num(f.entrada), salida: num(f.salida), monto_neto: num(f.monto_neto) })),
      },
    });
  } catch (error) {
    console.error('[conciliacion-bancaria] movimientos:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// GET /api/conciliacion-bancaria/resumen   Efectivo y flujo de caja real para la página Tesorería
//
// Para poder sumar cuentas en Q, US$ y € se convierte todo con UN tipo de cambio de referencia por
// moneda: la mediana de la tasa de los 10 movimientos más recientes de esa moneda hasta el corte.
// No se usan las tasas redondas (8.00 US$, 10.00 €): en el ERP son un valor puesto a mano,
// no el cambio del día (245 movimientos de 2026). Con una sola tasa todo queda sumable:
// saldo fin de mes − saldo mes anterior = entradas − salidas ± traslados.
//
// Categorías (por origen del movimiento en Profit):
//   entradas: COB cobros a clientes · DEP depósitos de caja · otras entradas (intereses, depósitos manuales)
//   salidas:  PAG pagos a proveedores · OPA órdenes de pago a SAT / IGSS (impuestos) · resto de OPA
//             (planilla, importaciones, gastos) · cargos bancarios y otros
//   traslados: BAN TR / TP = transferencias entre cuentas propias (compra de dólares/euros, fondeo
//             de planilla), más los depósitos manuales que son la otra punta de una compra de
//             divisas (en la cuenta de euros a veces se registra como DP). Se muestran aparte y no
//             cuentan como entrada ni salida. Los TR de membresías o cheques rechazados son cargos.
const CATEGORIA = `CASE
  WHEN m.origen = 'BAN' AND m.tipo_op IN ('TR', 'TP')
       AND COALESCE(m.descripcion, '') !~* '(membres|rechaz|comisi)' THEN 'traslados'
  WHEN m.origen = 'BAN' AND m.tipo_op = 'DP'
       AND COALESCE(m.descripcion, '') ~* '(compr|compa|camb|euro|planilla)' THEN 'traslados'
  WHEN m.origen = 'COB' THEN 'cobros'
  WHEN m.origen = 'DEP' THEN 'depositos_caja'
  WHEN m.entrada > 0 THEN 'otras_entradas'
  WHEN m.origen = 'PAG' THEN 'pagos_proveedores'
  WHEN m.origen = 'OPA' AND m.tercero ~* '(superintendencia de administraci|^\\s*sat[\\s/]|igss)' THEN 'impuestos'
  WHEN m.origen = 'OPA' THEN 'ordenes_pago'
  ELSE 'cargos_otros' END`;
const CATEGORIAS = {
  cobros:            { tipo: 'entrada',  nombre: 'Cobros a clientes' },
  depositos_caja:    { tipo: 'entrada',  nombre: 'Depósitos de caja' },
  otras_entradas:    { tipo: 'entrada',  nombre: 'Intereses y otras entradas' },
  pagos_proveedores: { tipo: 'salida',   nombre: 'Pagos a proveedores' },
  impuestos:         { tipo: 'salida',   nombre: 'Impuestos e IGSS (SAT, IGSS)' },
  ordenes_pago:      { tipo: 'salida',   nombre: 'Otras órdenes de pago (planilla, importaciones, gastos)' },
  cargos_otros:      { tipo: 'salida',   nombre: 'Cargos bancarios y otros' },
  traslados:         { tipo: 'traslado', nombre: 'Traslados entre cuentas propias' },
};

router.get('/resumen', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const { D, H } = P;

    // Tipo de cambio de referencia por moneda (ver arriba)
    const tasas = await db.allAsync(`
      WITH r AS (
        SELECT m.moneda_cuenta AS moneda, m.tasa, m.fecha,
               ROW_NUMBER() OVER (PARTITION BY m.moneda_cuenta ORDER BY m.fecha DESC, m.id_movimiento DESC) AS rn
        FROM ${T} m
        WHERE m.moneda_cuenta <> 'Q' AND m.moneda = m.moneda_cuenta AND NOT m.anulado
          AND m.tasa > 1 AND m.tasa <> TRUNC(m.tasa) AND m.fecha <= ${H} AND m.fecha >= DATE '2010-01-01'
      )
      SELECT moneda, percentile_cont(0.5) WITHIN GROUP (ORDER BY tasa) AS tasa,
             MIN(fecha)::text AS desde, MAX(fecha)::text AS hasta, COUNT(*) AS n
      FROM r WHERE rn <= 10 GROUP BY moneda
    `);
    const tc = { Q: 1 };
    for (const t of tasas) tc[t.moneda] = num(t.tasa);
    const aQ = (moneda, monto) => (tc[moneda] != null ? num(monto) * tc[moneda] : null);

    const cuentas = await db.allAsync(`
      SELECT m.cod_cta, MAX(m.num_cta) AS num_cta, MAX(m.banco) AS banco, MAX(m.moneda_cuenta) AS moneda,
             COALESCE(SUM(m.monto_neto) FILTER (WHERE NOT m.anulado AND m.fecha <= ${H}), 0) AS saldo,
             COALESCE(SUM(m.monto_neto) FILTER (WHERE NOT m.anulado AND m.fecha <  ${D}), 0) AS saldo_inicial
      FROM ${T} m GROUP BY m.cod_cta ORDER BY MAX(m.banco), m.cod_cta
    `);

    // Movimientos del período por mes × moneda × categoría
    const mov = await db.allAsync(`
      SELECT to_char(m.fecha, 'YYYY-MM') AS mes, m.moneda_cuenta AS moneda, ${CATEGORIA} AS categoria,
             COUNT(*) AS n, COALESCE(SUM(m.entrada), 0) AS entradas, COALESCE(SUM(m.salida + m.idb), 0) AS salidas
      FROM ${T} m
      WHERE NOT m.anulado AND m.fecha BETWEEN ${D} AND ${H}
      GROUP BY 1, 2, 3
    `);

    const actualizado = await db.getAsync(`SELECT MAX(cargado_en) AS en FROM ${T}`);

    // Meses del período (aunque no tengan movimientos)
    const meses = [];
    for (let d = new Date(`${P.desde.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 7) <= P.hasta.slice(0, 7);
      d.setUTCMonth(d.getUTCMonth() + 1)) meses.push(d.toISOString().slice(0, 7));

    const sinTasa = new Set();
    const flujo = Object.fromEntries(meses.map(m => [m, { mes: m, entradas_q: 0, salidas_q: 0, traslados_q: 0 }]));
    const comp = {};
    for (const f of mov) {
      const e = aQ(f.moneda, f.entradas), s = aQ(f.moneda, f.salidas);
      if (e == null) { sinTasa.add(f.moneda); continue; }
      const cat = CATEGORIAS[f.categoria] ? f.categoria : 'cargos_otros';
      const fm = flujo[f.mes];
      if (fm) {
        if (cat === 'traslados') fm.traslados_q += e - s;
        else { fm.entradas_q += e; fm.salidas_q += s; }
      }
      const c = comp[cat] || (comp[cat] = { categoria: cat, ...CATEGORIAS[cat], entradas_q: 0, salidas_q: 0, n: 0 });
      c.entradas_q += e; c.salidas_q += s; c.n += int(f.n);
    }

    // Saldo al cierre de cada mes = saldo antes del período + Σ netos acumulados
    let saldo = 0;
    for (const c of cuentas) { const v = aQ(c.moneda, c.saldo_inicial); if (v != null) saldo += v; }
    const flujoMensual = meses.map(m => {
      const f = flujo[m];
      saldo += f.entradas_q - f.salidas_q + f.traslados_q;
      return { ...f, neto_q: f.entradas_q - f.salidas_q, saldo_fin_q: saldo };
    });

    const ctas = cuentas.map(c => ({
      cod_cta: c.cod_cta, num_cta: c.num_cta, banco: c.banco, moneda: c.moneda,
      saldo: num(c.saldo), saldo_q: aQ(c.moneda, c.saldo),
    }));
    const monedas = {};
    for (const c of ctas) {
      const m = monedas[c.moneda] || (monedas[c.moneda] = { moneda: c.moneda, saldo: 0, saldo_q: 0, cuentas: 0, tasa: tc[c.moneda] ?? null });
      m.saldo += c.saldo; m.saldo_q += c.saldo_q || 0; m.cuentas += 1;
    }
    const totalQ = ctas.reduce((s, c) => s + (c.saldo_q || 0), 0);
    const tot = flujoMensual.reduce((a, f) => ({
      entradas_q: a.entradas_q + f.entradas_q, salidas_q: a.salidas_q + f.salidas_q, traslados_q: a.traslados_q + f.traslados_q,
    }), { entradas_q: 0, salidas_q: 0, traslados_q: 0 });

    res.json({
      status: 'success',
      data: {
        periodo: P.ventana(),
        corte: P.hasta,
        actualizado_en: actualizado?.en || null,
        tipos_cambio: tasas.map(t => ({ moneda: t.moneda, tasa: num(t.tasa), desde: t.desde, hasta: t.hasta, n: int(t.n) })),
        monedas_sin_tasa: [...sinTasa, ...ctas.filter(c => c.saldo_q == null).map(c => c.moneda)]
          .filter((v, i, a) => a.indexOf(v) === i),
        efectivo: { total_q: totalQ, monedas: Object.values(monedas) },
        cuentas: ctas,
        flujo: { ...tot, neto_q: tot.entradas_q - tot.salidas_q, saldo_inicial_q: flujoMensual.length
          ? flujoMensual[0].saldo_fin_q - (flujoMensual[0].neto_q + flujoMensual[0].traslados_q) : totalQ },
        flujo_mensual: flujoMensual,
        composicion: Object.values(comp).sort((a, b) => (b.entradas_q + b.salidas_q) - (a.entradas_q + a.salidas_q)),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
