const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// Ventana default: año en curso (ver services/periodo.js).
const { parsePeriodo: parseWindow } = require('../services/periodo');

// Todas las queries filtran es_gasto_operativo = TRUE.
// La agrupación primaria es por SUBLINEA (centro de costo) — en el ERP
// TP_A la "categoria" es fija 'Gastos de Operación' para todos.
const FILTRO_GASTO = 'AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE';

// GET /api/gastos   Resumen: KPIs + serie mensual
router.get('/', async (req, res) => {
  try {
    const P = parseWindow(req);
    const { desde, hasta } = P;

    const kpis = await db.getAsync(`
      SELECT
        COALESCE(SUM(f.total_sin_iva), 0)     AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)     AS gasto_con_iva,
        COALESCE(SUM(f.iva), 0)               AS iva_acreditable,
        COUNT(DISTINCT f.fact_num)            AS facturas,
        COUNT(DISTINCT f.proveedor_id)        AS proveedores,
        COUNT(DISTINCT a.sublinea)            AS centros_costo,
        COUNT(*)                              AS lineas
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
    `, [desde, hasta]);

    const mensual = await db.allAsync(`
      SELECT
        TO_CHAR(f.fecha_emision, 'YYYY-MM')     AS periodo,
        COALESCE(SUM(f.total_sin_iva), 0)       AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)       AS gasto_con_iva,
        COUNT(DISTINCT f.fact_num)              AS facturas
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
      GROUP BY 1
      ORDER BY 1
    `, [desde, hasta]);

    // Mismo período del año anterior (misma regla que el resto de la plataforma)
    const prev = await db.getAsync(`
      SELECT COALESCE(SUM(f.total_sin_iva), 0) AS gasto_sin_iva
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
    `, [P.prevDesde, P.prevHasta]);
    const gastoActual = parseFloat(kpis.gasto_sin_iva) || 0;
    const gastoPrev = parseFloat(prev.gasto_sin_iva) || 0;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        gasto_sin_iva: gastoActual,
        gasto_prev_sin_iva: gastoPrev,
        variacion_pct: gastoPrev > 0 ? Math.round((gastoActual - gastoPrev) / gastoPrev * 1000) / 10 : null,
        comparacion: { desde: P.prevDesde, hasta: P.prevHasta },
        gasto_con_iva: parseFloat(kpis.gasto_con_iva) || 0,
        iva_acreditable: parseFloat(kpis.iva_acreditable) || 0,
        facturas: parseInt(kpis.facturas) || 0,
        proveedores: parseInt(kpis.proveedores) || 0,
        centros_costo: parseInt(kpis.centros_costo) || 0,
        lineas: parseInt(kpis.lineas) || 0,
        serie_mensual: mensual.map(m => ({
          periodo: m.periodo,
          gasto_sin_iva: parseFloat(m.gasto_sin_iva) || 0,
          gasto_con_iva: parseFloat(m.gasto_con_iva) || 0,
          facturas: parseInt(m.facturas) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/gastos/centros-costo   Breakdown por sublinea (centro de costo)
router.get('/centros-costo', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ? AND ?
          ${FILTRO_GASTO}
      )
      SELECT
        COALESCE(a.sublinea, 'Sin centro')          AS centro_costo,
        COUNT(*)                                    AS lineas,
        COUNT(DISTINCT f.fact_num)                  AS facturas,
        COALESCE(SUM(f.total_sin_iva), 0)           AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)           AS gasto_con_iva,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                             AS porcentaje
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
      GROUP BY a.sublinea
      ORDER BY gasto_sin_iva DESC
      LIMIT ${limit}
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        centros: rows.map(r => ({
          centro_costo: r.centro_costo,
          lineas: parseInt(r.lineas) || 0,
          facturas: parseInt(r.facturas) || 0,
          gasto_sin_iva: parseFloat(r.gasto_sin_iva) || 0,
          gasto_con_iva: parseFloat(r.gasto_con_iva) || 0,
          porcentaje: parseFloat(r.porcentaje) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/gastos/proveedores   Top proveedores de gastos operativos
router.get('/proveedores', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ? AND ?
          ${FILTRO_GASTO}
      )
      SELECT
        p.codigo_proveedor,
        p.nombre                                    AS proveedor,
        p.rif,
        COUNT(DISTINCT f.fact_num)                  AS facturas,
        COUNT(*)                                    AS lineas,
        COALESCE(SUM(f.total_sin_iva), 0)           AS gasto_sin_iva,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                             AS porcentaje,
        MAX(f.fecha_emision)                        AS ultima_compra
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
      GROUP BY p.codigo_proveedor, p.nombre, p.rif
      ORDER BY gasto_sin_iva DESC
      LIMIT ${limit}
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        proveedores: rows.map(r => ({
          codigo: r.codigo_proveedor,
          proveedor: r.proveedor,
          rif: r.rif,
          facturas: parseInt(r.facturas) || 0,
          lineas: parseInt(r.lineas) || 0,
          gasto_sin_iva: parseFloat(r.gasto_sin_iva) || 0,
          porcentaje: parseFloat(r.porcentaje) || 0,
          ultima_compra: r.ultima_compra,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/gastos/detalle    Listado paginado con filtros
router.get('/detalle', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit  = Math.min(parseInt(req.query.limit) || 200, 20000);
    const offset = parseInt(req.query.offset) || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const proveedor = req.query.codigo_proveedor || '';
    const centroCosto = req.query.centro_costo || '';
    const concepto = req.query.concepto || '';

    const where = [`f.fecha_emision BETWEEN $1 AND $2`, `COALESCE(a.es_gasto_operativo, FALSE) = TRUE`];
    const params = [desde, hasta];

    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(p.nombre ILIKE ${p} OR p.codigo_proveedor ILIKE ${p} OR a.descripcion ILIKE ${p} OR f.fact_num::text ILIKE ${p})`);
    }
    if (proveedor) {
      params.push(proveedor);
      where.push(`p.codigo_proveedor = $${params.length}`);
    }
    if (centroCosto) {
      params.push(centroCosto);
      where.push(`a.sublinea = $${params.length}`);
    }
    if (concepto) {
      params.push(concepto);
      where.push(`a.codigo_articulo = $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`
      SELECT
        f.compra_id                                 AS id,
        f.fact_num, f.tipo_doc, f.fecha_emision,
        p.codigo_proveedor, p.nombre AS proveedor, p.rif,
        s.codigo_sucursal, s.nombre AS sucursal,
        a.codigo_articulo, a.descripcion AS articulo,
        a.sublinea AS centro_costo,
        f.unidades, f.total_sin_iva, f.total_con_iva, f.iva, f.saldo
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_sucursal  s ON s.sucursal_id  = f.sucursal_id
      JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
      WHERE ${whereSql}
      ORDER BY f.fecha_emision DESC, f.total_sin_iva DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const totalRow = await db.getAsync(`
      SELECT COUNT(*) AS total, COALESCE(SUM(f.total_sin_iva), 0) AS suma_sin_iva
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
      WHERE ${whereSql}
    `, params);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        total_filas: parseInt(totalRow.total) || 0,
        suma_sin_iva_filtrada: parseFloat(totalRow.suma_sin_iva) || 0,
        filas: rows.map(r => ({
          id: parseInt(r.id),
          fact_num: r.fact_num,
          tipo_doc: r.tipo_doc,
          fecha_emision: r.fecha_emision,
          codigo_proveedor: r.codigo_proveedor,
          proveedor: r.proveedor,
          rif: r.rif,
          codigo_sucursal: r.codigo_sucursal,
          sucursal: r.sucursal,
          codigo_articulo: r.codigo_articulo,
          articulo: r.articulo,
          centro_costo: r.centro_costo,
          unidades: parseFloat(r.unidades) || 0,
          total_sin_iva: parseFloat(r.total_sin_iva) || 0,
          total_con_iva: parseFloat(r.total_con_iva) || 0,
          iva: parseFloat(r.iva) || 0,
          saldo: parseFloat(r.saldo) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// =========================================================================
// GASTOS DE ADMINISTRACIÓN (centro de costo "Administración" ≈ 74% del gasto operativo)
//
// En el ERP cada gasto se registra con un artículo cuyo nombre ES el concepto
// contable (Alquileres, Agua y Energía Eléctrica, Seguros y Fianzas…) y el código
// trae la cuenta (02GOA51106 → 5.1.1.06). Aquí se agrupan esos conceptos en
// rubros para leerlos más fácil, y se detectan los cargos recurrentes (contratos
// que se facturan todos los meses: alquileres, energía, seguridad…).
//
// ?centro= permite usar la misma vista con otro centro de costo (default Administración).
// =========================================================================
const sinTilde = (e) => `TRANSLATE(LOWER(${e}), 'áéíóúñ', 'aeioun')`;
const RUBRO_EXPR = (() => {
  const d = sinTilde('a.descripcion');
  return `(CASE
    WHEN ${d} ~ 'alquiler|agua y energ|instalacion|mantenimiento|reparacion'   THEN 'instalaciones'
    WHEN ${d} ~ 'personal|capacitacion|uniforme|medico|sueldo|bonific'        THEN 'personal'
    WHEN ${d} ~ 'vehiculo|combustible|hospedaje|viatico|pasaje|flete'         THEN 'movilidad'
    WHEN ${d} ~ 'seguro|fianza'                                              THEN 'seguros'
    WHEN ${d} ~ 'servicio|telefono|software|electronico|cuota|suscripcion|honorario' THEN 'servicios'
    WHEN ${d} ~ 'suministro|papeleria|materiales'                            THEN 'oficina'
    ELSE 'otros' END)`;
})();
const RUBROS = [
  { id: 'instalaciones', label: 'Instalaciones',            desc: 'alquileres, energía y agua, mantenimiento de las instalaciones' },
  { id: 'servicios',     label: 'Servicios y tecnología',   desc: 'servicios contratados, teléfono, software, equipo electrónico, suscripciones' },
  { id: 'movilidad',     label: 'Vehículos y viajes',       desc: 'vehículos, combustible, hospedaje, viáticos y pasajes' },
  { id: 'personal',      label: 'Personal',                 desc: 'atención al personal, capacitación, uniformes y equipo de seguridad' },
  { id: 'seguros',       label: 'Seguros y fianzas',        desc: 'pólizas y fianzas' },
  { id: 'oficina',       label: 'Oficina y suministros',    desc: 'suministros, papelería y materiales' },
  { id: 'otros',         label: 'Otros',                    desc: 'diversos, no deducibles, impuestos, multas, representación, publicidad' },
];
const RUBRO_LABEL = Object.fromEntries(RUBROS.map(r => [r.id, r.label]));
const NOMBRE_PROV = `REGEXP_REPLACE(p.nombre, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', '')`;
const JOINS_G = `
  FROM thermoplastica.fact_compras_linea f
  JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
  JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id`;

const num = (x) => parseFloat(x) || 0;
const varPct = (v, vp) => (vp > 0 ? Math.round((v - vp) / vp * 1000) / 10 : null);
const mesesDe = (desde, hasta) => {
  const out = [];
  let [y, m] = desde.slice(0, 7).split('-').map(Number);
  const fin = hasta.slice(0, 7);
  for (;;) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    if (k > fin) break;
    out.push(k);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
};
const restarAnio = (ym) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;

function filtrosAdmin(req, params) {
  params.push(String(req.query.centro || 'Administración'));
  const where = [`COALESCE(a.es_gasto_operativo, FALSE) = TRUE`, `a.sublinea = $${params.length}`];
  if (req.query.rubro && RUBRO_LABEL[req.query.rubro]) {
    params.push(req.query.rubro);
    where.push(`${RUBRO_EXPR} = $${params.length}`);
  }
  if (req.query.proveedor) {
    params.push(String(req.query.proveedor));
    where.push(`p.codigo_proveedor = $${params.length}`);
  }
  return where;
}

// GET /api/gastos/administracion   Resumen completo de la sección
router.get('/administracion', async (req, res) => {
  try {
    const P = parseWindow(req);
    const params = [];
    const w = filtrosAdmin(req, params).join(' AND ');
    const act  = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
    const prev = `f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}`;
    const ambos = `((${act}) OR (${prev}))`;

    const [conceptos, porMes, cargos, provs, operativo] = await Promise.all([
      // Conceptos (artículo de gasto = concepto contable)
      db.allAsync(`
        SELECT a.codigo_articulo AS codigo, MAX(a.descripcion) AS concepto, MAX(${RUBRO_EXPR}) AS rubro,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)  AS gasto,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0) AS gasto_prev,
               COUNT(DISTINCT f.fact_num)     FILTER (WHERE ${act})     AS facturas,
               COUNT(DISTINCT f.proveedor_id) FILTER (WHERE ${act})     AS proveedores,
               COUNT(DISTINCT TO_CHAR(f.fecha_emision, 'YYYY-MM')) FILTER (WHERE ${act}) AS meses_con_gasto,
               MAX(f.fecha_emision) FILTER (WHERE ${act})               AS ultima
        ${JOINS_G}
        WHERE ${ambos} AND ${w}
        GROUP BY a.codigo_articulo
        ORDER BY gasto DESC`, params),
      // Serie mensual por rubro
      db.allAsync(`
        SELECT TO_CHAR(f.fecha_emision, 'YYYY-MM') AS mes, ${RUBRO_EXPR} AS rubro, (${act}) AS actual,
               SUM(f.total_sin_iva) AS gasto
        ${JOINS_G}
        WHERE ${ambos} AND ${w}
        GROUP BY 1, 2, 3`, params),
      // Cargos por concepto + proveedor + mes (para proveedor principal y recurrentes)
      db.allAsync(`
        SELECT a.codigo_articulo AS codigo, p.codigo_proveedor AS prov, MAX(${NOMBRE_PROV}) AS proveedor,
               TO_CHAR(f.fecha_emision, 'YYYY-MM') AS mes, SUM(f.total_sin_iva) AS gasto,
               MAX(f.fecha_emision) AS ultima
        ${JOINS_G}
        WHERE ${act} AND ${w}
        GROUP BY 1, 2, 4`, params),
      // Proveedores
      db.allAsync(`
        SELECT p.codigo_proveedor AS codigo, MAX(${NOMBRE_PROV}) AS nombre,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)  AS gasto,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0) AS gasto_prev,
               COUNT(DISTINCT f.fact_num) FILTER (WHERE ${act})         AS facturas,
               STRING_AGG(DISTINCT a.descripcion, ' · ') FILTER (WHERE ${act}) AS conceptos,
               MAX(f.fecha_emision) FILTER (WHERE ${act})               AS ultima
        ${JOINS_G}
        WHERE ${ambos} AND ${w}
        GROUP BY 1
        HAVING SUM(f.total_sin_iva) FILTER (WHERE ${act}) > 0
        ORDER BY gasto DESC`, params),
      // Todo el gasto operativo del período (para el % que representa este centro)
      db.getAsync(`
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE ${act} AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE`, []),
    ]);

    const meses = mesesDe(P.desde, P.hasta);
    // Meses completos del período (el mes en curso no cuenta para decidir si algo es recurrente)
    const hoyMes = new Date().toISOString().slice(0, 7);
    const mesesCompletos = meses.filter(m => m < hoyMes || m < P.hasta.slice(0, 7)).length || meses.length;
    const nMeses = Math.max(P.dias / 30.44, 1);

    const total = conceptos.reduce((s, c) => s + num(c.gasto), 0);
    const totalPrev = conceptos.reduce((s, c) => s + num(c.gasto_prev), 0);

    // Proveedor principal por concepto
    const porConcepto = {};
    for (const c of cargos) {
      const k = c.codigo;
      porConcepto[k] = porConcepto[k] || {};
      const pv = porConcepto[k][c.prov] = porConcepto[k][c.prov] || { codigo: c.prov, nombre: c.proveedor, gasto: 0, meses: {}, ultima: null };
      pv.gasto += num(c.gasto);
      pv.meses[c.mes] = (pv.meses[c.mes] || 0) + num(c.gasto);
      if (!pv.ultima || c.ultima > pv.ultima) pv.ultima = c.ultima;
    }

    const listaConceptos = conceptos.map(c => {
      const g = num(c.gasto), gp = num(c.gasto_prev);
      const pvs = Object.values(porConcepto[c.codigo] || {}).sort((a, b) => b.gasto - a.gasto);
      return {
        codigo: c.codigo,
        concepto: c.concepto,
        rubro: c.rubro,
        rubro_label: RUBRO_LABEL[c.rubro],
        gasto: g,
        gasto_prev: gp,
        variacion: g - gp,
        variacion_pct: varPct(g, gp),
        participacion: total > 0 ? Math.round(g / total * 1000) / 10 : 0,
        mensual: g / nMeses,
        facturas: parseInt(c.facturas) || 0,
        proveedores: parseInt(c.proveedores) || 0,
        meses_con_gasto: parseInt(c.meses_con_gasto) || 0,
        proveedor_principal: pvs[0] ? pvs[0].nombre : null,
        pct_proveedor_principal: pvs[0] && g > 0 ? Math.round(pvs[0].gasto / g * 100) : null,
        ultima: c.ultima,
        nuevo: g > 0 && gp === 0,
        dejado: g === 0 && gp > 0,
      };
    });

    // Rubros
    const rubros = RUBROS.map(r => {
      const cs = listaConceptos.filter(c => c.rubro === r.id);
      const g = cs.reduce((s, c) => s + c.gasto, 0), gp = cs.reduce((s, c) => s + c.gasto_prev, 0);
      return {
        rubro: r.id, label: r.label, desc: r.desc, gasto: g, gasto_prev: gp,
        variacion_pct: varPct(g, gp), participacion: total > 0 ? Math.round(g / total * 1000) / 10 : 0,
        mensual: g / nMeses,
        conceptos: cs.filter(c => c.gasto > 0).map(c => c.concepto),
      };
    }).filter(r => r.gasto > 0 || r.gasto_prev > 0).sort((a, b) => b.gasto - a.gasto);

    // Serie mensual
    const serie = Object.fromEntries(meses.map(m => [m, { periodo: m, total: 0, total_prev: 0, ...Object.fromEntries(RUBROS.map(r => [r.id, 0])) }]));
    const alinear = P.dias <= 366;
    for (const r of porMes) {
      const g = num(r.gasto);
      if (r.actual) {
        if (serie[r.mes]) { serie[r.mes].total += g; serie[r.mes][r.rubro] += g; }
      } else if (alinear) {
        const m = `${Number(r.mes.slice(0, 4)) + 1}${r.mes.slice(4)}`;
        if (serie[m]) serie[m].total_prev += g;
      }
    }

    // Cargos recurrentes: mismo concepto y proveedor facturado en casi todos los meses completos
    const mesesRef = meses.slice(0, mesesCompletos);
    const recurrentes = [];
    for (const c of listaConceptos) {
      for (const pv of Object.values(porConcepto[c.codigo] || {})) {
        // Proveedor genérico (GEN001 "El Portador": compras sin proveedor identificado, tipo caja chica)
        if (/^GEN/i.test(pv.codigo)) continue;
        const conCargo = mesesRef.filter(m => pv.meses[m] > 0);
        if (mesesRef.length < 3 || conCargo.length < Math.max(3, Math.ceil(mesesRef.length * 0.75))) continue;
        const montos = conCargo.map(m => pv.meses[m]).sort((a, b) => a - b);
        const mediana = montos[Math.floor(montos.length / 2)];
        const prom = montos.reduce((s, x) => s + x, 0) / montos.length;
        const desv = Math.sqrt(montos.reduce((s, x) => s + (x - prom) ** 2, 0) / montos.length);
        recurrentes.push({
          codigo: c.codigo, concepto: c.concepto, rubro: c.rubro,
          proveedor_codigo: pv.codigo, proveedor: pv.nombre,
          mensual: mediana,
          anual: mediana * 12,
          meses_con_cargo: conCargo.length,
          meses_periodo: mesesRef.length,
          // Monto fijo (contrato) vs variable (consumo: energía, combustible…)
          estable: prom > 0 && desv / prom < 0.15,
          variacion_mensual_pct: prom > 0 ? Math.round(desv / prom * 100) : null,
          gasto_periodo: pv.gasto,
          ultima: pv.ultima,
        });
      }
    }
    recurrentes.sort((a, b) => b.mensual - a.mensual);
    const recurrenteMensual = recurrentes.reduce((s, r) => s + r.mensual, 0);
    const gastoMensual = total / nMeses;

    const totalOperativo = num(operativo.total);
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        centro: String(req.query.centro || 'Administración'),
        gasto: total,
        gasto_prev: totalPrev,
        variacion_pct: varPct(total, totalPrev),
        pct_del_operativo: totalOperativo > 0 ? Math.round(total / totalOperativo * 1000) / 10 : null,
        gasto_operativo_total: totalOperativo,
        gasto_mensual: gastoMensual,
        recurrente_mensual: recurrenteMensual,
        pct_recurrente: gastoMensual > 0 ? Math.round(recurrenteMensual / gastoMensual * 1000) / 10 : null,
        n_conceptos: listaConceptos.filter(c => c.gasto > 0).length,
        n_proveedores: provs.length,
        facturas: listaConceptos.reduce((s, c) => s + c.facturas, 0),
        rubros,
        rubros_def: RUBROS,
        conceptos: listaConceptos.filter(c => !c.dejado),
        conceptos_dejados: listaConceptos.filter(c => c.dejado),
        recurrentes,
        proveedores: provs.map(p => ({
          codigo: p.codigo, nombre: p.nombre, generico: /^GEN/i.test(p.codigo),
          gasto: num(p.gasto), gasto_prev: num(p.gasto_prev), variacion_pct: varPct(num(p.gasto), num(p.gasto_prev)),
          participacion: total > 0 ? Math.round(num(p.gasto) / total * 1000) / 10 : 0,
          facturas: parseInt(p.facturas) || 0, conceptos: p.conceptos, ultima: p.ultima,
        })),
        serie_mensual: Object.values(serie),
      },
    });
  } catch (error) {
    console.error('gastos administracion error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/gastos/administracion/concepto/:codigo   Detalle de un concepto:
// últimos 24 meses (para ver estacionalidad y tendencia), proveedores y facturas del período.
router.get('/administracion/concepto/:codigo', async (req, res) => {
  try {
    const P = parseWindow(req);
    const params = [];
    const w = filtrosAdmin(req, params);
    params.push(String(req.params.codigo));
    w.push(`a.codigo_articulo = $${params.length}`);
    const ws = w.join(' AND ');
    const act = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
    const desde24 = `(date_trunc('month', ${P.H}) - INTERVAL '23 months')::date`;

    const [info, serie, provs, lineas] = await Promise.all([
      db.getAsync(`SELECT MAX(a.descripcion) AS concepto, MAX(${RUBRO_EXPR}) AS rubro ${JOINS_G} WHERE ${ws}`, params),
      db.allAsync(`
        SELECT TO_CHAR(f.fecha_emision, 'YYYY-MM') AS mes, SUM(f.total_sin_iva) AS gasto, COUNT(DISTINCT f.fact_num) AS facturas
        ${JOINS_G}
        WHERE f.fecha_emision BETWEEN ${desde24} AND ${P.H} AND ${ws}
        GROUP BY 1 ORDER BY 1`, params),
      db.allAsync(`
        SELECT p.codigo_proveedor AS codigo, MAX(${NOMBRE_PROV}) AS nombre, SUM(f.total_sin_iva) AS gasto,
               COUNT(DISTINCT f.fact_num) AS facturas, MAX(f.fecha_emision) AS ultima,
               COUNT(DISTINCT TO_CHAR(f.fecha_emision, 'YYYY-MM')) AS meses
        ${JOINS_G}
        WHERE ${act} AND ${ws}
        GROUP BY 1 ORDER BY gasto DESC`, params),
      db.allAsync(`
        SELECT f.compra_id AS id, f.fact_num, f.fecha_emision, ${NOMBRE_PROV} AS proveedor, p.codigo_proveedor,
               f.total_sin_iva, f.iva, f.total_con_iva, c.factura_proveedor
        ${JOINS_G}
        LEFT JOIN thermoplastica.fact_cxp_factura c
               ON c.numero_interno::text = f.fact_num::text AND c.proveedor_id = f.proveedor_id
        WHERE ${act} AND ${ws}
        ORDER BY f.fecha_emision DESC, f.total_sin_iva DESC
        LIMIT 200`, params),
    ]);

    // Últimos 24 meses hasta el fin del período, con cero en los meses sin gasto
    const fin = P.hasta.slice(0, 7);
    const inicio = `${restarAnio(restarAnio(fin))}-01`;
    const meses = mesesDe(inicio, P.hasta).slice(-24);
    const porMes = Object.fromEntries(serie.map(s => [s.mes, s]));
    const total = provs.reduce((s, p) => s + num(p.gasto), 0);
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        codigo: req.params.codigo,
        concepto: info?.concepto,
        rubro: info?.rubro,
        rubro_label: RUBRO_LABEL[info?.rubro],
        gasto: total,
        serie: meses.map(m => ({ periodo: m, gasto: num(porMes[m]?.gasto), facturas: parseInt(porMes[m]?.facturas) || 0, en_periodo: m >= P.desde.slice(0, 7) })),
        proveedores: provs.map(p => ({
          codigo: p.codigo, nombre: p.nombre, gasto: num(p.gasto), facturas: parseInt(p.facturas) || 0,
          meses: parseInt(p.meses) || 0, ultima: p.ultima,
          participacion: total > 0 ? Math.round(num(p.gasto) / total * 1000) / 10 : 0,
        })),
        lineas: lineas.map(l => ({
          id: parseInt(l.id), fact_num: l.fact_num, factura_proveedor: l.factura_proveedor, fecha: l.fecha_emision,
          proveedor: l.proveedor, codigo_proveedor: l.codigo_proveedor,
          total_sin_iva: num(l.total_sin_iva), iva: num(l.iva), total_con_iva: num(l.total_con_iva),
        })),
      },
    });
  } catch (error) {
    console.error('gastos concepto error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;

