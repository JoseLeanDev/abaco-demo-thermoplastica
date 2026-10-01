/**
 * proyecciones — Proyección de ventas y de flujo de caja operativo sobre datos reales.
 *
 * Lo usan /api/analisis (página Salud financiera) y /api/tesoreria/proyeccion.
 * Lee las vistas de analitica de la migración 015 (v_ciclo_caja) y las tablas del
 * ERP en el schema thermoplastica.
 *
 * Límites que se declaran en la respuesta (no se inventan):
 *   - No hay saldo bancario: el flujo es NETO acumulado, no saldo en caja.
 *   - No hay nómina, impuestos ni deuda: la salida solo incluye proveedores.
 *   - CxP vencida a más de 90 días (facturas sin cerrar en el ERP) y CxC vencida a
 *     más de 90 días (dudosa) quedan fuera.
 */
const db = require('../../database/connection');

const DIA_MS = 24 * 60 * 60 * 1000;
const MESES_NOMBRE = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Con solo dos años completos de historia, el índice estacional se encoge a la
// mitad hacia 1 para no confundir un mes atípico con estacionalidad.
const PESO_ESTACIONALIDAD = 0.5;
const MESES_BACKTEST = 6;
const ERROR_MINIMO = 0.08;   // rango nunca menor a ±8%
const Z_80 = 1.28;           // banda de ~80%
const SEMANAS_REPARTO_ATRASO = 4;

// ---------------------------------------------------------------------------
// Fechas (todo en UTC a nivel de día para evitar corrimientos por zona horaria)
// ---------------------------------------------------------------------------
const aFecha = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const sumarDias = (d, n) => new Date(d.getTime() + n * DIA_MS);
const iso = (d) => d.toISOString().slice(0, 10);
const claveMes = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const sumarMeses = (clave, n) => {
  const [y, m] = clave.split('-').map(Number);
  return claveMes(new Date(Date.UTC(y, m - 1 + n, 1)));
};
const diasDelMes = (clave) => {
  const [y, m] = clave.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const etiquetaMes = (clave) => {
  const [y, m] = clave.split('-');
  return `${MESES_NOMBRE[+m - 1]} ${y.slice(2)}`;
};
const hoyUTC = () => aFecha(new Date());

// ---------------------------------------------------------------------------
// Datos base
// ---------------------------------------------------------------------------
async function cargarCiclo() {
  const c = await db.getAsync('SELECT * FROM analitica.v_ciclo_caja');
  if (!c) throw new Error('analitica.v_ciclo_caja no devolvió datos (¿falta aplicar la migración 015?)');
  const n = (k) => Number(c[k]) || 0;
  return {
    fechaCorte: aFecha(c.fecha_corte),
    diasCobroReal: n('dias_cobro_real'),
    diasPagoReal: n('dias_pago_real'),
    ratioIvaVentas: n('ventas_12m') > 0 ? n('ventas_12m_con_iva') / n('ventas_12m') : 1.12,
    comprasDiariasConIva: n('compras_12m_con_iva') / 365,
    cxpPorDepurar: n('cxp_por_depurar'),
    facturasPorDepurar: n('facturas_por_depurar'),
    cxcDudosa: n('cxc_dudosa'),
  };
}

async function cargarSerieMensual() {
  const rows = await db.allAsync(`
    SELECT to_char(make_date(anio, mes, 1), 'YYYY-MM') AS mes, sum(monto) AS ventas
    FROM thermoplastica.fact_ventas_mensuales
    GROUP BY 1 ORDER BY 1
  `);
  return rows.map(r => ({ mes: r.mes, ventas: Number(r.ventas) || 0 }));
}

// ---------------------------------------------------------------------------
// Modelo de ventas: nivel (promedio 12m) × tendencia interanual × estacionalidad
// ---------------------------------------------------------------------------
const promedio = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

/**
 * Pronostica el mes `objetivo` usando SOLO la historia completa hasta `ultimo`.
 * Devuelve null si no hay al menos 12 meses de historia.
 */
function pronosticarMes(serie, ultimo, objetivo) {
  const hist = serie.filter(s => s.mes <= ultimo);
  if (hist.length < 12) return null;
  const mapa = new Map(hist.map(s => [s.mes, s.ventas]));

  const ult12 = hist.slice(-12).map(s => s.ventas);
  const prev12 = hist.slice(-24, -12).map(s => s.ventas);
  const nivel = promedio(ult12);
  const crecimiento = prev12.length === 12 ? ult12.reduce((a, b) => a + b, 0) / prev12.reduce((a, b) => a + b, 0) - 1 : 0;

  // Índice estacional del mes calendario, con años calendario completos.
  const mesCal = objetivo.slice(5, 7);
  const anios = [...new Set(hist.map(s => s.mes.slice(0, 4)))]
    .filter(y => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`).every(k => mapa.has(k)));
  const ratios = anios.map(y => {
    const media = promedio(Array.from({ length: 12 }, (_, i) => mapa.get(`${y}-${String(i + 1).padStart(2, '0')}`)));
    return mapa.get(`${y}-${mesCal}`) / media;
  });
  const indiceBruto = ratios.length ? promedio(ratios) : 1;
  const indice = 1 + PESO_ESTACIONALIDAD * (indiceBruto - 1);

  // El nivel está centrado 5.5 meses antes de `ultimo`; se lleva hasta el objetivo.
  const [yu, mu] = ultimo.split('-').map(Number);
  const [yo, mo] = objetivo.split('-').map(Number);
  const horizonte = (yo - yu) * 12 + (mo - mu);
  const factorTendencia = Math.pow(1 + crecimiento, (horizonte + 5.5) / 12);

  return { valor: nivel * factorTendencia * indice, crecimiento, indice };
}

/**
 * Proyección de ventas mensuales (sin IVA).
 * - historia: meses completos reales.
 * - backtest: últimos meses reales comparados con lo que el modelo habría dicho
 *   un mes antes (así se mide el error real del método).
 * - proyeccion: próximos `meses` meses con rango de ~80%.
 */
async function proyectarVentas({ meses = 6 } = {}) {
  const [ciclo, serie] = await Promise.all([cargarCiclo(), cargarSerieMensual()]);

  // Último mes completo: el mes de corte solo cuenta si la última venta es fin de mes.
  const corte = ciclo.fechaCorte;
  const mesCorte = claveMes(corte);
  const corteEsFinDeMes = claveMes(sumarDias(corte, 1)) !== mesCorte;
  const ultimoCompleto = corteEsFinDeMes ? mesCorte : sumarMeses(mesCorte, -1);
  const completos = serie.filter(s => s.mes <= ultimoCompleto);

  // Backtest a un mes vista
  const backtest = [];
  for (let i = MESES_BACKTEST; i >= 1; i--) {
    const objetivo = sumarMeses(ultimoCompleto, -(i - 1));
    const p = pronosticarMes(completos, sumarMeses(objetivo, -1), objetivo);
    const real = completos.find(s => s.mes === objetivo)?.ventas;
    if (p && real) backtest.push({ mes: objetivo, real, pronostico: p.valor, error_pct: (real - p.valor) / p.valor * 100 });
  }
  const errores = backtest.map(b => b.error_pct / 100);
  const errorTipico = Math.max(Math.sqrt(promedio(errores.map(e => e * e))), ERROR_MINIMO);
  const mape = backtest.length ? promedio(backtest.map(b => Math.abs(b.error_pct))) : null;

  // Proyección hacia adelante (incluye el mes de corte si quedó parcial)
  const proyeccion = [];
  for (let h = 1; h <= meses; h++) {
    const objetivo = sumarMeses(ultimoCompleto, h);
    const p = pronosticarMes(completos, ultimoCompleto, objetivo);
    if (!p) break;
    // El error crece con el horizonte (raíz del número de meses).
    const banda = Z_80 * errorTipico * Math.sqrt(h);
    const parcial = serie.find(s => s.mes === objetivo && objetivo === mesCorte && !corteEsFinDeMes);
    proyeccion.push({
      mes: objetivo,
      etiqueta: etiquetaMes(objetivo),
      pronostico: Math.round(p.valor),
      minimo: Math.round(p.valor * (1 - banda)),
      maximo: Math.round(p.valor * (1 + banda)),
      real_parcial: parcial ? Math.round(parcial.ventas) : null,
      indice_estacional: Number(p.indice.toFixed(3)),
    });
  }

  const ref = pronosticarMes(completos, ultimoCompleto, sumarMeses(ultimoCompleto, 1));
  const total = proyeccion.reduce((s, p) => s + p.pronostico, 0);
  const mismoPeriodoAnterior = proyeccion
    .map(p => completos.find(s => s.mes === sumarMeses(p.mes, -12))?.ventas)
    .filter(v => v != null);

  return {
    fecha_corte: iso(corte),
    ultimo_mes_completo: ultimoCompleto,
    metodo: 'Promedio de 12 meses × crecimiento interanual × estacionalidad (atenuada al 50%)',
    crecimiento_interanual_pct: ref ? Number((ref.crecimiento * 100).toFixed(1)) : null,
    error_tipico_pct: Number((errorTipico * 100).toFixed(1)),
    mape_backtest_pct: mape != null ? Number(mape.toFixed(1)) : null,
    total_proyectado: Math.round(total),
    total_mismo_periodo_anterior: mismoPeriodoAnterior.length === proyeccion.length
      ? Math.round(mismoPeriodoAnterior.reduce((a, b) => a + b, 0)) : null,
    historia: completos.slice(-18).map(s => ({ mes: s.mes, etiqueta: etiquetaMes(s.mes), real: Math.round(s.ventas) })),
    backtest: backtest.map(b => ({
      mes: b.mes, etiqueta: etiquetaMes(b.mes),
      real: Math.round(b.real), pronostico: Math.round(b.pronostico), error_pct: Number(b.error_pct.toFixed(1)),
    })),
    proyeccion,
  };
}

// ---------------------------------------------------------------------------
// Flujo de caja operativo semanal
// ---------------------------------------------------------------------------

/**
 * Flujo neto proyectado por semana a partir de hoy.
 * Entradas: CxC pendiente (fecha esperada = vencimiento + atraso histórico del
 *           cliente) + cobro de ventas proyectadas posteriores al corte.
 * Salidas:  CxP pendiente a su vencimiento + pago de compras proyectadas
 *           posteriores al corte (ritmo de los últimos 12 meses).
 */
async function proyectarFlujo({ semanas = 13 } = {}) {
  const ciclo = await cargarCiclo();
  const hoy = hoyUTC();
  const fin = sumarDias(hoy, semanas * 7);

  const [cxc, cxp, ventas] = await Promise.all([
    db.allAsync(`
      WITH atraso AS (
        SELECT cliente_id,
               sum((fecha_ultimo_cobro - fecha_vencimiento) * valor) / nullif(sum(valor), 0) AS dias
        FROM thermoplastica.fact_cxc_factura
        WHERE saldo <= 0 AND fecha_ultimo_cobro >= fecha_emision
          AND fecha_ultimo_cobro > CURRENT_DATE - 365
        GROUP BY cliente_id
      ),
      global AS (
        SELECT sum((fecha_ultimo_cobro - fecha_vencimiento) * valor) / nullif(sum(valor), 0) AS dias
        FROM thermoplastica.fact_cxc_factura
        WHERE saldo <= 0 AND fecha_ultimo_cobro >= fecha_emision
          AND fecha_ultimo_cobro > CURRENT_DATE - 365
      )
      SELECT f.saldo, f.fecha_vencimiento,
             least(greatest(round(coalesce(a.dias, g.dias, 0)), -15), 60)::int AS atraso
      FROM thermoplastica.fact_cxc_factura f
      LEFT JOIN atraso a ON a.cliente_id = f.cliente_id
      CROSS JOIN global g
      WHERE f.saldo > 0 AND f.fecha_vencimiento >= CURRENT_DATE - 90
    `),
    db.allAsync(`
      SELECT saldo, fecha_vencimiento
      FROM thermoplastica.fact_cxp_factura
      WHERE saldo > 0 AND fecha_vencimiento >= CURRENT_DATE - 90
    `),
    proyectarVentas({ meses: Math.ceil(semanas / 4) + 3 }),
  ]);

  const filas = Array.from({ length: semanas }, (_, i) => ({
    semana: i + 1,
    fecha_inicio: iso(sumarDias(hoy, i * 7)),
    fecha_fin: iso(sumarDias(hoy, i * 7 + 6)),
    cobros_cartera: 0, cobros_ventas_proyectadas: 0,
    pagos_proveedores: 0, pagos_compras_proyectadas: 0,
  }));
  const semanaDe = (fecha) => {
    const i = Math.floor((fecha.getTime() - hoy.getTime()) / (7 * DIA_MS));
    return i >= 0 && i < semanas ? filas[i] : null;
  };

  // Lo que ya debió cobrarse o pagarse no tiene fecha creíble: se reparte en partes
  // iguales en las primeras semanas en vez de cargarlo todo a una sola.
  const semanasAtraso = Math.min(SEMANAS_REPARTO_ATRASO, semanas);
  const asignar = (campo, fecha, monto) => {
    if (fecha < hoy) {
      for (let i = 0; i < semanasAtraso; i++) filas[i][campo] += monto / semanasAtraso;
      return;
    }
    const s = semanaDe(fecha);
    if (s) s[campo] += monto;
  };

  // Cartera documentada: vencimiento + atraso histórico del cliente.
  let cobrosAtrasados = 0;
  for (const r of cxc) {
    const esperada = sumarDias(aFecha(r.fecha_vencimiento), Number(r.atraso) || 0);
    if (esperada < hoy) cobrosAtrasados += Number(r.saldo) || 0;
    asignar('cobros_cartera', esperada, Number(r.saldo) || 0);
  }
  // Proveedores documentados: a su vencimiento.
  let pagosAtrasados = 0;
  for (const r of cxp) {
    const esperada = aFecha(r.fecha_vencimiento);
    if (esperada < hoy) pagosAtrasados += Number(r.saldo) || 0;
    asignar('pagos_proveedores', esperada, Number(r.saldo) || 0);
  }

  // Ventas y compras posteriores al corte que todavía no existen como documento.
  const ventaDiariaPorMes = new Map(ventas.proyeccion.map(p => {
    // Del mes de corte solo falta lo que no se ha facturado.
    const pendiente = p.real_parcial != null ? Math.max(p.pronostico - p.real_parcial, 0) : p.pronostico;
    const diasPendientes = p.real_parcial != null ? diasDelMes(p.mes) - ciclo.fechaCorte.getUTCDate() : diasDelMes(p.mes);
    return [p.mes, diasPendientes > 0 ? pendiente / diasPendientes : 0];
  }));
  const lagCobro = Math.round(ciclo.diasCobroReal);
  const lagPago = Math.round(ciclo.diasPagoReal);
  for (let d = sumarDias(ciclo.fechaCorte, 1); d < fin; d = sumarDias(d, 1)) {
    const venta = (ventaDiariaPorMes.get(claveMes(d)) || 0) * ciclo.ratioIvaVentas;
    const sCobro = semanaDe(sumarDias(d, lagCobro));
    if (sCobro) sCobro.cobros_ventas_proyectadas += venta;
    const sPago = semanaDe(sumarDias(d, lagPago));
    if (sPago) sPago.pagos_compras_proyectadas += ciclo.comprasDiariasConIva;
  }

  let acumulado = 0;
  const proyeccion = filas.map(f => {
    const entradas = f.cobros_cartera + f.cobros_ventas_proyectadas;
    const salidas = f.pagos_proveedores + f.pagos_compras_proyectadas;
    const neto = entradas - salidas;
    acumulado += neto;
    const documentado = (f.cobros_cartera + f.pagos_proveedores) / ((entradas + salidas) || 1);
    return {
      semana: f.semana,
      fecha_inicio: f.fecha_inicio,
      fecha_fin: f.fecha_fin,
      cobros_cartera: Math.round(f.cobros_cartera),
      cobros_ventas_proyectadas: Math.round(f.cobros_ventas_proyectadas),
      pagos_proveedores: Math.round(f.pagos_proveedores),
      pagos_compras_proyectadas: Math.round(f.pagos_compras_proyectadas),
      entradas: Math.round(entradas),
      salidas: Math.round(salidas),
      neto: Math.round(neto),
      flujo_acumulado: Math.round(acumulado),
      // Certeza = qué parte del movimiento de la semana ya existe como factura.
      certeza: documentado >= 0.7 ? 'alta' : documentado >= 0.4 ? 'media' : 'baja',
      pct_documentado: Math.round(documentado * 100),
    };
  });

  const minimo = proyeccion.reduce((m, p) => (p.flujo_acumulado < m.flujo_acumulado ? p : m), proyeccion[0]);
  const semanasNegativas = proyeccion.filter(p => p.neto < 0).map(p => p.semana);

  return {
    fecha_corte: iso(ciclo.fechaCorte),
    semanas,
    supuestos: {
      dias_cobro_ventas_nuevas: lagCobro,
      dias_pago_compras_nuevas: lagPago,
      compras_diarias_con_iva: Math.round(ciclo.comprasDiariasConIva),
      semanas_reparto_atrasado: semanasAtraso,
      cobros_atrasados_repartidos: Math.round(cobrosAtrasados),
      pagos_atrasados_repartidos: Math.round(pagosAtrasados),
    },
    excluido: {
      cxp_por_depurar: Math.round(ciclo.cxpPorDepurar),
      facturas_cxp_por_depurar: ciclo.facturasPorDepurar,
      cxc_dudosa: Math.round(ciclo.cxcDudosa),
      no_disponible: ['saldo bancario', 'nómina', 'impuestos', 'deuda financiera'],
    },
    resumen: {
      entradas_totales: proyeccion.reduce((s, p) => s + p.entradas, 0),
      salidas_totales: proyeccion.reduce((s, p) => s + p.salidas, 0),
      flujo_neto_total: proyeccion.length ? proyeccion[proyeccion.length - 1].flujo_acumulado : 0,
      flujo_acumulado_minimo: minimo ? minimo.flujo_acumulado : 0,
      semana_minimo: minimo ? minimo.semana : null,
      semanas_con_neto_negativo: semanasNegativas,
    },
    proyeccion,
  };
}

module.exports = { proyectarVentas, proyectarFlujo };
