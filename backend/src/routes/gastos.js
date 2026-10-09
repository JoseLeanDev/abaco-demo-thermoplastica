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
    const cuenta = req.query.cuenta || '';
    const rubro = req.query.rubro || '';

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
    if (cuenta) {
      // Cuenta contable = 5 dígitos finales del código del artículo de gasto
      params.push(cuenta);
      where.push(`COALESCE(SUBSTRING(a.codigo_articulo FROM '([0-9]{5})$'), a.codigo_articulo) = $${params.length}`);
    }
    if (rubro) {
      params.push(rubro);
      where.push(`${RUBRO_EXPR} = $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`
      SELECT
        f.compra_id                                 AS id,
        f.fact_num, f.tipo_doc, f.fecha_emision,
        p.codigo_proveedor, REGEXP_REPLACE(p.nombre, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', '') AS proveedor, p.rif,
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
// ANÁLISIS DE GASTOS (página Gastos Operativos y subpágina Administración)
//
// En el ERP cada gasto se registra con un artículo de "Gastos de Operación" cuyo
// nombre ES el concepto contable y cuyo código trae centro de costo + cuenta:
//   02GO A  51106 → centro Administración, cuenta 5.1.1.06 Alquileres
//   02GO M  51114 → centro Laminados,      cuenta 5.1.1.14 Pasajes, fletes y acarreos
// El centro de costo está en la sublínea del artículo. El mismo concepto (cuenta)
// existe con un código distinto en cada centro, así que los conceptos se agrupan
// por CUENTA (los 5 dígitos finales) para sumarlos entre centros.
//
// Los conceptos se agrupan en rubros (agrupación de la plataforma) y se detectan
// los cargos recurrentes (mismo concepto y proveedor facturado casi todos los meses).
//
// ?centro=  limita a un centro de costo (la subpágina de Administración lo fija).
// ?rubro=   ?proveedor=<código>  filtros adicionales.
// =========================================================================
const sinTilde = (e) => `TRANSLATE(LOWER(${e}), 'áéíóúñ', 'aeioun')`;
const RUBRO_EXPR = (() => {
  const d = sinTilde('a.descripcion');
  return `(CASE
    WHEN ${d} ~ 'flete|acarreo|importaci'                                    THEN 'logistica'
    WHEN ${d} ~ 'alquiler|agua y energ|instalacion|mantenimiento|reparacion'   THEN 'instalaciones'
    WHEN ${d} ~ 'personal|capacitacion|uniforme|medico|sueldo|bonific'        THEN 'personal'
    WHEN ${d} ~ 'vehiculo|combustible|hospedaje|viatico|pasaje'               THEN 'movilidad'
    WHEN ${d} ~ 'seguro|fianza'                                              THEN 'seguros'
    WHEN ${d} ~ 'servicio|telefono|software|electronico|cuota|suscripcion|honorario' THEN 'servicios'
    WHEN ${d} ~ 'suministro|papeleria|materiales'                            THEN 'oficina'
    ELSE 'otros' END)`;
})();
const RUBROS = [
  { id: 'instalaciones', label: 'Instalaciones',            desc: 'alquileres, energía y agua, mantenimiento de las instalaciones' },
  { id: 'servicios',     label: 'Servicios y tecnología',   desc: 'servicios contratados, teléfono, software, equipo electrónico, suscripciones' },
  { id: 'logistica',     label: 'Fletes e importación',     desc: 'pasajes, fletes, acarreos y gastos de importación' },
  { id: 'movilidad',     label: 'Vehículos y viajes',       desc: 'vehículos, combustible, hospedaje y viáticos' },
  { id: 'personal',      label: 'Personal',                 desc: 'atención al personal, capacitación, uniformes y equipo de seguridad' },
  { id: 'seguros',       label: 'Seguros y fianzas',        desc: 'pólizas y fianzas' },
  { id: 'oficina',       label: 'Oficina y suministros',    desc: 'suministros, papelería y materiales' },
  { id: 'otros',         label: 'Otros',                    desc: 'diversos, no deducibles, impuestos, multas, representación, publicidad' },
];
const RUBRO_LABEL = Object.fromEntries(RUBROS.map(r => [r.id, r.label]));
const NOMBRE_PROV = `REGEXP_REPLACE(p.nombre, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', '')`;
const CUENTA_EXPR = `COALESCE(SUBSTRING(a.codigo_articulo FROM '([0-9]{5})$'), a.codigo_articulo)`;
// Nombre más usado de la cuenta (las variantes difieren en tildes y mayúsculas)
const NOMBRE_CUENTA = `MODE() WITHIN GROUP (ORDER BY a.descripcion)`;
const CENTRO_EXPR = `COALESCE(NULLIF(TRIM(a.sublinea), ''), 'Sin centro')`;
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
const cuentaFmt = (c) => (/^\d{5}$/.test(c) ? `${c[0]}.${c[1]}.${c[2]}.${c.slice(3)}` : c);

function filtrosGasto(req, params, centroDefault) {
  const where = [`COALESCE(a.es_gasto_operativo, FALSE) = TRUE`];
  const centro = req.query.centro !== undefined ? String(req.query.centro) : centroDefault;
  if (centro) {
    params.push(centro);
    where.push(`${CENTRO_EXPR} = $${params.length}`);
  }
  if (req.query.rubro && RUBRO_LABEL[req.query.rubro]) {
    params.push(req.query.rubro);
    where.push(`${RUBRO_EXPR} = $${params.length}`);
  }
  if (req.query.proveedor) {
    params.push(String(req.query.proveedor));
    where.push(`p.codigo_proveedor = $${params.length}`);
  }
  return { where, centro: centro || null };
}

async function analisisGastos(req, centroDefault) {
  const P = parseWindow(req);
  const params = [];
  const { where, centro } = filtrosGasto(req, params, centroDefault);
  const w = where.join(' AND ');
  const act  = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
  const prev = `f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}`;
  const ambos = `((${act}) OR (${prev}))`;

  const [conceptos, porMes, cargos, provs, porCentro, operativo, ventas, centrosLista] = await Promise.all([
    // Conceptos (cuenta contable, sumada entre centros)
    db.allAsync(`
      SELECT ${CUENTA_EXPR} AS codigo, ${NOMBRE_CUENTA} AS concepto, MAX(${RUBRO_EXPR}) AS rubro,
             COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)  AS gasto,
             COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0) AS gasto_prev,
             COUNT(DISTINCT f.fact_num)     FILTER (WHERE ${act})     AS facturas,
             COUNT(DISTINCT f.proveedor_id) FILTER (WHERE ${act})     AS proveedores,
             COUNT(DISTINCT ${CENTRO_EXPR}) FILTER (WHERE ${act})     AS centros,
             MAX(f.fecha_emision) FILTER (WHERE ${act})               AS ultima
      ${JOINS_G}
      WHERE ${ambos} AND ${w}
      GROUP BY 1
      ORDER BY gasto DESC`, params),
    // Serie mensual por rubro y centro
    db.allAsync(`
      SELECT TO_CHAR(f.fecha_emision, 'YYYY-MM') AS mes, ${RUBRO_EXPR} AS rubro, ${CENTRO_EXPR} AS centro,
             (${act}) AS actual, SUM(f.total_sin_iva) AS gasto
      ${JOINS_G}
      WHERE ${ambos} AND ${w}
      GROUP BY 1, 2, 3, 4`, params),
    // Cargos por concepto + proveedor + mes (proveedor principal y recurrentes)
    db.allAsync(`
      SELECT ${CUENTA_EXPR} AS codigo, p.codigo_proveedor AS prov, MAX(${NOMBRE_PROV}) AS proveedor,
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
    // Centro de costo × concepto (para el desglose por centro)
    db.allAsync(`
      SELECT ${CENTRO_EXPR} AS centro, ${CUENTA_EXPR} AS codigo, ${NOMBRE_CUENTA} AS concepto, MAX(${RUBRO_EXPR}) AS rubro,
             COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)  AS gasto,
             COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0) AS gasto_prev,
             COUNT(DISTINCT f.fact_num) FILTER (WHERE ${act})         AS facturas
      ${JOINS_G}
      WHERE ${ambos} AND ${w}
      GROUP BY 1, 2`, params),
    // Todo el gasto operativo del período (para el % que representa el filtro)
    db.getAsync(`
      SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE ${act} AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE`, []),
    // Ventas del período, del año anterior y por mes (gasto como % de las ventas)
    db.allAsync(`
      SELECT TO_CHAR(fecha_emision, 'YYYY-MM') AS mes, (fecha_emision BETWEEN ${P.D} AND ${P.H}) AS actual,
             SUM(total_sin_iva) AS ventas
      FROM thermoplastica.fact_ventas_linea f
      WHERE tipo_doc = 'FACT' AND ${ambos}
      GROUP BY 1, 2`, []),
    // Todos los centros con gasto en el período (para el selector, sin filtros)
    db.allAsync(`
      SELECT ${CENTRO_EXPR} AS centro, SUM(f.total_sin_iva) AS gasto
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE ${act} AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE
      GROUP BY 1 ORDER BY gasto DESC`, []),
  ]);

  const meses = mesesDe(P.desde, P.hasta);
  // Meses completos del período (un mes cortado por el filtro o el mes en curso no
  // cuentan para decidir si algo es recurrente)
  const ultimoDia = (m) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10); };
  const mesesCompletos = meses.filter(m => m < P.hasta.slice(0, 7) || P.hasta >= ultimoDia(m)).length;
  const nMeses = Math.max(P.dias / 30.44, 1);

  const total = conceptos.reduce((s, c) => s + num(c.gasto), 0);
  const totalPrev = conceptos.reduce((s, c) => s + num(c.gasto_prev), 0);
  const ventasAct = ventas.filter(v => v.actual).reduce((s, v) => s + num(v.ventas), 0);
  const ventasPrev = ventas.filter(v => !v.actual).reduce((s, v) => s + num(v.ventas), 0);

  // Proveedores por concepto
  const porConcepto = {};
  for (const c of cargos) {
    porConcepto[c.codigo] = porConcepto[c.codigo] || {};
    const pv = porConcepto[c.codigo][c.prov] = porConcepto[c.codigo][c.prov] || { codigo: c.prov, nombre: c.proveedor, gasto: 0, meses: {}, ultima: null };
    pv.gasto += num(c.gasto);
    pv.meses[c.mes] = (pv.meses[c.mes] || 0) + num(c.gasto);
    if (!pv.ultima || c.ultima > pv.ultima) pv.ultima = c.ultima;
  }

  const listaConceptos = conceptos.map(c => {
    const g = num(c.gasto), gp = num(c.gasto_prev);
    const pvs = Object.values(porConcepto[c.codigo] || {}).sort((a, b) => b.gasto - a.gasto);
    return {
      codigo: c.codigo,
      cuenta: cuentaFmt(c.codigo),
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
      centros: parseInt(c.centros) || 0,
      proveedor_principal: pvs[0] ? pvs[0].nombre : null,
      pct_proveedor_principal: pvs[0] && g > 0 ? Math.round(pvs[0].gasto / g * 100) : null,
      ultima: c.ultima,
      nuevo: g > 0 && gp === 0,
      dejado: g === 0 && gp > 0,
    };
  });

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

  // Centros de costo (con su mezcla por rubro y sus conceptos principales)
  const centrosMap = {};
  for (const r of porCentro) {
    const c = centrosMap[r.centro] = centrosMap[r.centro] || { centro: r.centro, gasto: 0, gasto_prev: 0, facturas: 0, rubros: {}, conceptos: [] };
    const g = num(r.gasto);
    c.gasto += g;
    c.gasto_prev += num(r.gasto_prev);
    c.facturas += parseInt(r.facturas) || 0;
    c.rubros[r.rubro] = (c.rubros[r.rubro] || 0) + g;
    if (g > 0) c.conceptos.push({ codigo: r.codigo, concepto: r.concepto, gasto: g });
  }
  const centros = Object.values(centrosMap).map(c => ({
    ...c,
    variacion: c.gasto - c.gasto_prev,
    variacion_pct: varPct(c.gasto, c.gasto_prev),
    participacion: total > 0 ? Math.round(c.gasto / total * 1000) / 10 : 0,
    mensual: c.gasto / nMeses,
    conceptos: c.conceptos.sort((a, b) => b.gasto - a.gasto).slice(0, 4),
    concepto_principal_pct: c.gasto > 0 && c.conceptos[0] ? Math.round(c.conceptos[0].gasto / c.gasto * 100) : null,
  })).filter(c => c.gasto > 0 || c.gasto_prev > 0).sort((a, b) => b.gasto - a.gasto || b.gasto_prev - a.gasto_prev);

  // Serie mensual: por rubro, por centro (top 5 + otros), año anterior y % de ventas
  const topCentros = centros.slice(0, 5).map(c => c.centro);
  const vacio = () => ({ total: 0, total_prev: 0, ventas: 0, ventas_prev: 0, ...Object.fromEntries(RUBROS.map(r => [r.id, 0])), centros: Object.fromEntries([...topCentros, 'Otros'].map(c => [c, 0])) });
  const serie = Object.fromEntries(meses.map(m => [m, { periodo: m, ...vacio() }]));
  const alinear = P.dias <= 366;
  const mesActual = (mes, actual) => (actual ? mes : alinear ? `${Number(mes.slice(0, 4)) + 1}${mes.slice(4)}` : null);
  for (const r of porMes) {
    const m = mesActual(r.mes, r.actual);
    if (!m || !serie[m]) continue;
    const g = num(r.gasto);
    if (r.actual) {
      serie[m].total += g;
      serie[m][r.rubro] += g;
      serie[m].centros[topCentros.includes(r.centro) ? r.centro : 'Otros'] += g;
    } else serie[m].total_prev += g;
  }
  for (const v of ventas) {
    const m = mesActual(v.mes, v.actual);
    if (!m || !serie[m]) continue;
    if (v.actual) serie[m].ventas += num(v.ventas); else serie[m].ventas_prev += num(v.ventas);
  }
  const serieMensual = Object.values(serie).map(s => ({
    ...s,
    pct_ventas: s.ventas > 0 ? Math.round(s.total / s.ventas * 1000) / 10 : null,
    pct_ventas_prev: s.ventas_prev > 0 ? Math.round(s.total_prev / s.ventas_prev * 1000) / 10 : null,
  }));

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

  return {
    ventana: P.ventana(),
    centro,
    gasto: total,
    gasto_prev: totalPrev,
    variacion_pct: varPct(total, totalPrev),
    pct_del_operativo: totalOperativo > 0 ? Math.round(total / totalOperativo * 1000) / 10 : null,
    gasto_operativo_total: totalOperativo,
    ventas: ventasAct,
    ventas_prev: ventasPrev,
    pct_ventas: ventasAct > 0 ? Math.round(total / ventasAct * 1000) / 10 : null,
    pct_ventas_prev: ventasPrev > 0 ? Math.round(totalPrev / ventasPrev * 1000) / 10 : null,
    gasto_mensual: gastoMensual,
    recurrente_mensual: recurrenteMensual,
    pct_recurrente: gastoMensual > 0 ? Math.round(recurrenteMensual / gastoMensual * 1000) / 10 : null,
    meses_completos: mesesRef.length,
    n_conceptos: listaConceptos.filter(c => c.gasto > 0).length,
    n_proveedores: provs.length,
    n_centros: centros.filter(c => c.gasto > 0).length,
    facturas: listaConceptos.reduce((s, c) => s + c.facturas, 0),
    rubros,
    rubros_def: RUBROS,
    centros,
    centros_serie: [...topCentros, 'Otros'],
    centros_lista: centrosLista.map(c => c.centro),
    conceptos: listaConceptos.filter(c => !c.dejado),
    conceptos_dejados: listaConceptos.filter(c => c.dejado),
    recurrentes,
    proveedores: provs.map(p => ({
      codigo: p.codigo, nombre: p.nombre, generico: /^GEN/i.test(p.codigo),
      gasto: num(p.gasto), gasto_prev: num(p.gasto_prev), variacion_pct: varPct(num(p.gasto), num(p.gasto_prev)),
      participacion: total > 0 ? Math.round(num(p.gasto) / total * 1000) / 10 : 0,
      facturas: parseInt(p.facturas) || 0, conceptos: p.conceptos, ultima: p.ultima,
    })),
    serie_mensual: serieMensual,
  };
}

const handlerAnalisis = (centroDefault) => async (req, res) => {
  try {
    res.json({ status: 'success', data: await analisisGastos(req, centroDefault) });
  } catch (error) {
    console.error('gastos analisis error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// GET /api/gastos/analisis               Todo el gasto operativo (o ?centro=)
// GET /api/gastos/administracion         Igual, con centro = Administración por defecto
router.get('/analisis', handlerAnalisis(null));
router.get('/administracion', handlerAnalisis('Administración'));

// GET /api/gastos/analisis/concepto/:cuenta   Detalle de un concepto (cuenta contable):
// últimos 24 meses, proveedores, centros de costo y facturas del período.
const handlerConcepto = (centroDefault) => async (req, res) => {
  try {
    const P = parseWindow(req);
    const params = [];
    const { where } = filtrosGasto(req, params, centroDefault);
    params.push(String(req.params.cuenta));
    where.push(`${CUENTA_EXPR} = $${params.length}`);
    const ws = where.join(' AND ');
    const act = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
    const desde24 = `(date_trunc('month', ${P.H}) - INTERVAL '23 months')::date`;

    const [info, serie, provs, centros, lineas] = await Promise.all([
      db.getAsync(`SELECT ${NOMBRE_CUENTA} AS concepto, MAX(${RUBRO_EXPR}) AS rubro ${JOINS_G} WHERE ${ws}`, params),
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
        SELECT ${CENTRO_EXPR} AS centro, SUM(f.total_sin_iva) AS gasto
        ${JOINS_G}
        WHERE ${act} AND ${ws}
        GROUP BY 1 ORDER BY gasto DESC`, params),
      db.allAsync(`
        SELECT f.compra_id AS id, f.fact_num, f.fecha_emision, ${NOMBRE_PROV} AS proveedor, p.codigo_proveedor,
               ${CENTRO_EXPR} AS centro, f.total_sin_iva, f.iva, f.total_con_iva, c.factura_proveedor
        ${JOINS_G}
        LEFT JOIN thermoplastica.fact_cxp_factura c
               ON c.numero_interno::text = f.fact_num::text AND c.proveedor_id = f.proveedor_id
        WHERE ${act} AND ${ws}
        ORDER BY f.fecha_emision DESC, f.total_sin_iva DESC
        LIMIT 200`, params),
    ]);

    // Últimos 24 meses hasta el fin del período, con cero en los meses sin gasto
    const fin = P.hasta.slice(0, 7);
    const meses = mesesDe(`${restarAnio(restarAnio(fin))}-01`, P.hasta).slice(-24);
    const porMes = Object.fromEntries(serie.map(s => [s.mes, s]));
    const total = provs.reduce((s, p) => s + num(p.gasto), 0);
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        codigo: req.params.cuenta,
        cuenta: cuentaFmt(req.params.cuenta),
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
        centros: centros.map(c => ({
          centro: c.centro, gasto: num(c.gasto),
          participacion: total > 0 ? Math.round(num(c.gasto) / total * 1000) / 10 : 0,
        })),
        lineas: lineas.map(l => ({
          id: parseInt(l.id), fact_num: l.fact_num, factura_proveedor: l.factura_proveedor, fecha: l.fecha_emision,
          proveedor: l.proveedor, codigo_proveedor: l.codigo_proveedor, centro: l.centro,
          total_sin_iva: num(l.total_sin_iva), iva: num(l.iva), total_con_iva: num(l.total_con_iva),
        })),
      },
    });
  } catch (error) {
    console.error('gastos concepto error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
router.get('/analisis/concepto/:cuenta', handlerConcepto(null));
router.get('/administracion/concepto/:cuenta', handlerConcepto('Administración'));

module.exports = router;
