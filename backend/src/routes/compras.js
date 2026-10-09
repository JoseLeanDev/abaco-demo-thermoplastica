const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// Ventana default: año en curso (ver services/periodo.js).
const { parsePeriodo: parseWindow } = require('../services/periodo');

// ---------------------------------------------------------------------------
// Tipo de compra
//
// En el ERP todo entra como "factura de compra", pero no todo es inventario.
// Se clasifica cada línea por la jerarquía del artículo:
//   - Gastos de operación: categoría contable "Gastos de Operación" (es_gasto_operativo),
//     costos administrativos y servicios sin clasificar.
//   - Costos de producción: servicios, repuestos y mantenimiento cargados al costo.
//   - Gastos de importación: fletes, aduana y demás costos de traer mercadería.
//   - Activo fijo: compras de mobiliario/equipo.
//   - Materiales e insumos: todo lo demás (lo que entra al inventario).
// ---------------------------------------------------------------------------
const TIPO_EXPR = `(CASE
  WHEN COALESCE(a.es_gasto_operativo, FALSE)
       OR a.linea IN ('Gastos de Operación', 'Costos Administrativos')          THEN 'gasto'
  WHEN a.linea ILIKE 'activo fijo%'                                            THEN 'activo'
  WHEN a.linea ILIKE 'gastos de importaci%'                                    THEN 'importacion'
  WHEN a.linea ILIKE 'costo% de producci%'                                     THEN 'produccion'
  WHEN a.marca IN ('Contable', 'Articulos de Servicio')                        THEN 'gasto'
  ELSE 'inventario' END)`;

const TIPOS = [
  { id: 'inventario',  label: 'Materiales e insumos' },
  { id: 'produccion',  label: 'Costos de producción' },
  { id: 'importacion', label: 'Gastos de importación' },
  { id: 'gasto',       label: 'Gastos de operación' },
  { id: 'activo',      label: 'Activo fijo' },
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.id, t.label]));

// Jerarquía de producto igual que en Ventas:
//   Categoría = marca · Subcategoría = linea · Sublínea = sublinea
const limpio = (e, vacio) => `COALESCE(NULLIF(TRIM(${e}), ''), '${vacio}')`;
// El ERP antepone el código al nombre del proveedor ("1004-Klockner ..."); se quita para mostrar
const NOMBRE_PROV = `REGEXP_REPLACE(p.nombre, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', '')`;
const DIMS = {
  categoria:    { expr: limpio('a.marca', 'Sin categoría') },
  subcategoria: { expr: limpio('a.linea', 'Sin subcategoría') },
  sublinea:     { expr: limpio('a.sublinea', 'Sin sublínea') },
  proveedor:    { expr: 'p.codigo_proveedor', label: `MAX(${NOMBRE_PROV})` },
  articulo:     { expr: 'a.codigo_articulo',  label: 'MAX(a.descripcion)', extra: `MAX(${limpio('a.marca', 'Sin categoría')})` },
  tipo:         { expr: TIPO_EXPR },
};
const dimDe = (x, def) => (DIMS[x] ? x : def);

const JOINS = `
  FROM thermoplastica.fact_compras_linea f
  JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
  JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id`;

// Filtros comunes a todos los endpoints:
//   ?tipo=inventario,gasto  ?categoria= ?subcategoria= ?sublinea= ?proveedor=<código> ?articulo=<código>
function filtros(q, params) {
  const where = [];
  for (const k of ['categoria', 'subcategoria', 'sublinea', 'proveedor', 'articulo']) {
    const val = q[k];
    if (val === undefined || val === '') continue;
    params.push(String(val));
    where.push(`${DIMS[k].expr} = $${params.length}`);
  }
  const tipos = String(q.tipo || '').split(',').filter(t => TIPO_LABEL[t]);
  if (tipos.length) {
    params.push(tipos);
    where.push(`${TIPO_EXPR} = ANY($${params.length})`);
  }
  return where;
}

const n = (x) => parseFloat(x) || 0;
const r1 = (x) => (x === null || x === undefined ? null : Math.round(parseFloat(x) * 10) / 10);
const varPct = (v, vp) => (vp > 0 ? Math.round((v - vp) / vp * 1000) / 10 : null);

// Ranking del período por `dim` con comparación contra el período anterior y la
// descomposición de la variación del gasto:
//   - Precio:   mismo artículo comprado en ambos períodos → (precio actual − precio anterior) × unidades actuales.
//               Positivo = se pagó más caro (inflación de compras).
//   - Volumen:  mismo artículo → (unidades actuales − anteriores) × precio anterior.
//   - Nuevos:   artículos que solo se compraron en el período actual.
//   - Dejados:  artículos que solo se compraron en el anterior.
//   - Servicios y gastos: la variación de todo lo que no es inventario (no tiene un
//     "precio unitario" comparable: fletes, servicios, gastos contables).
async function calcularDesglose(req, dim, forzar = {}) {
  const P = parseWindow(req);
  const D = DIMS[dim];
  const params = [];
  const fs = filtros({ ...req.query, ...forzar }, params);
  const act  = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
  const prev = `f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}`;
  const where = [`((${act}) OR (${prev}))`, ...fs].join(' AND ');
  const esArticulo = dim === 'articulo';
  const pu = `f.total_sin_iva / NULLIF(f.unidades, 0)`;

  const [rows, efectos, pagos] = await Promise.all([
    db.allAsync(`
      SELECT
        ${D.expr}                                                     AS clave,
        ${D.label || D.expr}                                          AS nombre,
        ${D.extra || 'NULL'}                                          AS extra,
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)       AS gasto,
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0)      AS gasto_prev,
        COALESCE(SUM(f.iva) FILTER (WHERE ${act}), 0)                 AS iva,
        COALESCE(SUM(f.unidades) FILTER (WHERE ${act}), 0)            AS unidades,
        COALESCE(SUM(f.unidades) FILTER (WHERE ${prev}), 0)           AS unidades_prev,
        COUNT(DISTINCT f.fact_num)     FILTER (WHERE ${act})          AS facturas,
        COUNT(DISTINCT f.proveedor_id) FILTER (WHERE ${act})          AS proveedores,
        COUNT(DISTINCT f.articulo_id)  FILTER (WHERE ${act})          AS articulos,
        MAX(f.fecha_emision) FILTER (WHERE ${act})                    AS ultima_compra,
        MAX(f.fecha_emision)                                          AS ultima_compra_total
        ${esArticulo ? `,
        MIN(${pu}) FILTER (WHERE ${act} AND f.unidades > 0)           AS precio_min,
        MAX(${pu}) FILTER (WHERE ${act} AND f.unidades > 0)           AS precio_max,
        (ARRAY_AGG(${pu} ORDER BY f.fecha_emision DESC, f.compra_id DESC)
           FILTER (WHERE ${act} AND f.unidades > 0))[1]               AS precio_ultimo,
        (ARRAY_AGG(${NOMBRE_PROV} ORDER BY f.fecha_emision DESC, f.compra_id DESC)
           FILTER (WHERE ${act}))[1]                                  AS proveedor_ultimo` : ''}
      ${JOINS}
      WHERE ${where}
      GROUP BY ${D.expr}
      ORDER BY gasto DESC, gasto_prev DESC
    `, params),
    db.allAsync(`
      WITH base AS (
        SELECT ${D.expr} AS clave, f.articulo_id, ${TIPO_EXPR} = 'inventario' AS inv,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)  AS v1,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0) AS v0,
               COALESCE(SUM(f.unidades) FILTER (WHERE ${act}), 0)       AS u1,
               COALESCE(SUM(f.unidades) FILTER (WHERE ${prev}), 0)      AS u0
        ${JOINS}
        WHERE ${where}
        GROUP BY 1, 2, 3
      )
      SELECT clave,
        SUM(CASE WHEN inv AND v1 > 0 AND v0 > 0 AND u1 > 0 AND u0 > 0 THEN (v1 / u1 - v0 / u0) * u1 ELSE 0 END) AS precio,
        SUM(CASE WHEN inv AND v1 > 0 AND v0 > 0 AND u1 > 0 AND u0 > 0 THEN (u1 - u0) * (v0 / u0)    ELSE 0 END) AS volumen,
        -- Base del índice de precios: lo comprado este período valorado a precios del anterior
        SUM(CASE WHEN inv AND v1 > 0 AND v0 > 0 AND u1 > 0 AND u0 > 0 THEN u1 * (v0 / u0)            ELSE 0 END) AS base_precio,
        SUM(CASE WHEN inv AND v1 > 0 AND v0 <= 0 THEN v1  ELSE 0 END)                                             AS nuevos,
        SUM(CASE WHEN inv AND v0 > 0 AND v1 <= 0 THEN -v0 ELSE 0 END)                                             AS dejados,
        SUM(CASE WHEN NOT inv THEN v1 - v0 ELSE 0 END)                                                            AS servicios
      FROM base GROUP BY clave
    `, params),
    // Para proveedores: cómo se les paga (de las facturas por pagar del ERP)
    dim !== 'proveedor' ? Promise.resolve([]) : db.allAsync(`
      SELECT p.codigo_proveedor AS clave,
        SUM((c.fecha_ultimo_pago - c.fecha_emision) * c.valor)
          FILTER (WHERE c.saldo <= 0.01 AND c.fecha_ultimo_pago IS NOT NULL AND c.fecha_emision BETWEEN ${P.D} AND ${P.H})
          / NULLIF(SUM(c.valor)
          FILTER (WHERE c.saldo <= 0.01 AND c.fecha_ultimo_pago IS NOT NULL AND c.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS dias_pago,
        AVG(c.dias_credito_ficha) FILTER (WHERE c.dias_credito_ficha > 0)                    AS dias_credito,
        COALESCE(SUM(c.saldo) FILTER (WHERE c.saldo > 0.01), 0)                              AS saldo
      FROM thermoplastica.fact_cxp_factura c
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = c.proveedor_id
      GROUP BY 1
    `, []),
  ]);

  const ef = Object.fromEntries(efectos.map(e => [e.clave, e]));
  const pg = Object.fromEntries(pagos.map(e => [e.clave, e]));
  const total = rows.reduce((s, r) => s + n(r.gasto), 0);
  let acumulado = 0;
  const items = rows.map(r => {
    const v = n(r.gasto), vp = n(r.gasto_prev);
    const e = ef[r.clave] || {};
    const precio = n(e.precio), volumen = n(e.volumen), nuevos = n(e.nuevos), dejados = n(e.dejados), servicios = n(e.servicios);
    const basePrecio = n(e.base_precio);
    acumulado += v;
    const it = {
      clave: r.clave,
      nombre: dim === 'tipo' ? TIPO_LABEL[r.clave] : r.nombre,
      extra: r.extra,
      gasto: v,
      gasto_prev: vp,
      variacion: v - vp,
      variacion_pct: varPct(v, vp),
      efecto_precio: precio,
      efecto_volumen: volumen,
      efecto_nuevos: nuevos,
      efecto_dejados: dejados,
      efecto_servicios: servicios,
      // Redondeos y unidades en cero
      efecto_otros: (v - vp) - precio - volumen - nuevos - dejados - servicios,
      // Variación de precio de lo que se compró en ambos períodos (índice tipo Paasche)
      inflacion_pct: basePrecio > 0 ? Math.round(precio / basePrecio * 1000) / 10 : null,
      iva: n(r.iva),
      unidades: n(r.unidades),
      unidades_prev: n(r.unidades_prev),
      precio_promedio: n(r.unidades) > 0 ? v / n(r.unidades) : null,
      precio_promedio_prev: n(r.unidades_prev) > 0 ? vp / n(r.unidades_prev) : null,
      facturas: parseInt(r.facturas) || 0,
      proveedores: parseInt(r.proveedores) || 0,
      articulos: parseInt(r.articulos) || 0,
      participacion: total > 0 ? Math.round(v / total * 1000) / 10 : 0,
      acumulado_pct: total > 0 ? Math.round(acumulado / total * 1000) / 10 : 0,
      ultima_compra: r.ultima_compra || r.ultima_compra_total,
      nuevo: v > 0 && vp === 0,
      dejado: v === 0 && vp > 0,
    };
    if (esArticulo) {
      Object.assign(it, {
        precio_min: r.precio_min === null ? null : n(r.precio_min),
        precio_max: r.precio_max === null ? null : n(r.precio_max),
        precio_ultimo: r.precio_ultimo === null ? null : n(r.precio_ultimo),
        proveedor_ultimo: r.proveedor_ultimo,
        variacion_precio_pct: it.precio_promedio && it.precio_promedio_prev
          ? Math.round((it.precio_promedio / it.precio_promedio_prev - 1) * 1000) / 10 : null,
      });
    }
    if (dim === 'proveedor') {
      const x = pg[r.clave] || {};
      Object.assign(it, {
        dias_pago: x.dias_pago == null ? null : Math.round(n(x.dias_pago)),
        dias_credito: x.dias_credito == null ? null : Math.round(n(x.dias_credito)),
        saldo_por_pagar: n(x.saldo),
      });
    }
    return it;
  });
  const suma = (k) => items.reduce((s, i) => s + i[k], 0);
  const totalPrev = suma('gasto_prev');
  const basePrecio = efectos.reduce((s, e) => s + n(e.base_precio), 0);
  return {
    P, items, total, totalPrev,
    puente: {
      anterior: totalPrev,
      precio: suma('efecto_precio'),
      volumen: suma('efecto_volumen'),
      nuevos: suma('efecto_nuevos'),
      dejados: suma('efecto_dejados'),
      servicios: suma('efecto_servicios'),
      otros: suma('efecto_otros'),
      actual: total,
      inflacion_pct: basePrecio > 0 ? Math.round(suma('efecto_precio') / basePrecio * 1000) / 10 : null,
      cobertura_precio: basePrecio,
    },
  };
}

// Mes "YYYY-MM" desplazado k meses
function sumarMeses(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
const mesesEntre = (a, b) => {
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
};

// ---------------------------------------------------------------------------
// GET /api/compras   Resumen: KPIs vs año anterior, composición por tipo,
// serie mensual (con el año anterior superpuesto), concentración y puente.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const P = parseWindow(req);
    const params = [];
    const fs = filtros(req.query, params);
    const w = fs.length ? 'AND ' + fs.join(' AND ') : '';
    const act  = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
    const prev = `f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}`;

    const [tipos, provs, k, serie] = await Promise.all([
      calcularDesglose(req, 'tipo'),
      // Concentración: solo compras por proveedor (sin el detalle que arma calcularDesglose)
      db.allAsync(`
        SELECT f.proveedor_id, MAX(${NOMBRE_PROV}) AS nombre, MAX(p.codigo_proveedor) AS codigo,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)  AS gasto,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0) AS gasto_prev
        ${JOINS}
        WHERE ((${act}) OR (${prev})) ${w}
        GROUP BY 1
        ORDER BY gasto DESC
      `, params),
      db.getAsync(`
        SELECT
          COALESCE(SUM(f.total_con_iva) FILTER (WHERE ${act}), 0)       AS gasto_con_iva,
          COALESCE(SUM(f.iva) FILTER (WHERE ${act}), 0)                 AS iva,
          COALESCE(SUM(f.iva) FILTER (WHERE ${prev}), 0)                AS iva_prev,
          COUNT(DISTINCT f.fact_num)     FILTER (WHERE ${act})          AS facturas,
          COUNT(DISTINCT f.fact_num)     FILTER (WHERE ${prev})         AS facturas_prev,
          COUNT(DISTINCT f.proveedor_id) FILTER (WHERE ${act})          AS proveedores,
          COUNT(DISTINCT f.proveedor_id) FILTER (WHERE ${prev})         AS proveedores_prev,
          COUNT(DISTINCT f.articulo_id)  FILTER (WHERE ${act})          AS articulos,
          COUNT(*) FILTER (WHERE ${act})                                AS lineas
        ${JOINS}
        WHERE ((${act}) OR (${prev})) ${w}
      `, params),
      db.allAsync(`
        SELECT TO_CHAR(f.fecha_emision, 'YYYY-MM') AS mes, ${TIPO_EXPR} AS tipo,
               (${act}) AS actual,
               SUM(f.total_sin_iva) AS gasto
        ${JOINS}
        WHERE ((${act}) OR (${prev})) ${w}
        GROUP BY 1, 2, 3
      `, params),
    ]);

    const { total, totalPrev, puente } = tipos;

    // Serie mensual: meses del período actual (total y por tipo); el anterior se alinea
    // al mes equivalente (total_prev)
    const desp = mesesEntre(P.prevDesde.slice(0, 7), P.desde.slice(0, 7));
    const meses = [];
    for (let m = P.desde.slice(0, 7); m <= P.hasta.slice(0, 7); m = sumarMeses(m, 1)) meses.push(m);
    const porMes = Object.fromEntries(meses.map(m => [m, { periodo: m, total: 0, total_prev: 0, ...Object.fromEntries(TIPOS.map(t => [t.id, 0])) }]));
    for (const r of serie) {
      const g = n(r.gasto);
      if (r.actual) {
        if (porMes[r.mes]) { porMes[r.mes].total += g; porMes[r.mes][r.tipo] += g; }
      } else {
        const m = sumarMeses(r.mes, desp);
        if (porMes[m]) porMes[m].total_prev += g;
      }
    }

    // Concentración de proveedores
    const filas = provs.map(p => ({ ...p, gasto: n(p.gasto), gasto_prev: n(p.gasto_prev) }));
    const activos = filas.filter(i => i.gasto > 0);
    const share = (k) => (total > 0 ? Math.round(activos.slice(0, k).reduce((s, i) => s + i.gasto, 0) / total * 1000) / 10 : 0);
    let acum = 0;
    const n80 = activos.findIndex(i => (acum += i.gasto) >= total * 0.8) + 1;
    const nuevos = activos.filter(i => i.gasto_prev === 0);

    const facturas = parseInt(k.facturas) || 0;
    const facturasPrev = parseInt(k.facturas_prev) || 0;
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        gasto_sin_iva: total,
        gasto_prev_sin_iva: totalPrev,
        variacion_pct: varPct(total, totalPrev),
        gasto_con_iva: n(k.gasto_con_iva),
        iva_acreditable: n(k.iva),
        iva_prev: n(k.iva_prev),
        facturas,
        facturas_prev: facturasPrev,
        proveedores: parseInt(k.proveedores) || 0,
        proveedores_prev: parseInt(k.proveedores_prev) || 0,
        articulos: parseInt(k.articulos) || 0,
        lineas: parseInt(k.lineas) || 0,
        factura_promedio: facturas > 0 ? total / facturas : null,
        factura_promedio_prev: facturasPrev > 0 ? totalPrev / facturasPrev : null,
        gasto_mensual_promedio: total / Math.max(P.dias / 30.44, 1),
        composicion: tipos.items.map(i => ({
          tipo: i.clave, label: i.nombre, gasto: i.gasto, gasto_prev: i.gasto_prev,
          participacion: i.participacion, variacion_pct: i.variacion_pct,
        })),
        concentracion: {
          top1_pct: share(1),
          top5_pct: share(5),
          top1: activos[0] ? { codigo: activos[0].codigo, nombre: activos[0].nombre } : null,
          proveedores_80: n80 || activos.length,
          proveedores_nuevos: nuevos.length,
          gasto_nuevos: nuevos.reduce((s, i) => s + i.gasto, 0),
          proveedores_dejados: filas.filter(i => i.gasto === 0 && i.gasto_prev > 0).length,
        },
        puente,
        serie_mensual: Object.values(porMes),
        tipos: TIPOS,
      },
    });
  } catch (error) {
    console.error('compras resumen error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/compras/desglose?dim=categoria|subcategoria|sublinea|proveedor|articulo|tipo
// Ranking con comparación contra el año anterior. Acepta los filtros comunes.
// También alimenta las opciones del filtro de producto (fuente "compras").
// ---------------------------------------------------------------------------
router.get('/desglose', async (req, res) => {
  try {
    const dim = dimDe(req.query.dim, 'categoria');
    const limit = Math.min(parseInt(req.query.limit) || 200, 2000);
    const { P, items, total, totalPrev, puente } = await calcularDesglose(req, dim);
    const dejados = items.filter(i => i.dejado);
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        dim,
        total,
        total_prev: totalPrev,
        variacion_pct: varPct(total, totalPrev),
        puente,
        n_items: items.filter(i => i.gasto > 0).length,
        n_items_prev: items.filter(i => i.gasto_prev > 0).length,
        items: items.filter(i => !i.dejado).slice(0, limit),
        // Se les compró en el período anterior y en este no
        dejados: dejados.sort((a, b) => b.gasto_prev - a.gasto_prev).slice(0, 25),
        gasto_dejados: dejados.reduce((s, i) => s + i.gasto_prev, 0),
      },
    });
  } catch (error) {
    console.error('compras desglose error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/compras/precios   Variación de precio unitario por artículo
// Solo materiales e insumos comprados en ambos períodos (los servicios no tienen
// un precio unitario comparable). Ordenado por impacto en Q.
// ---------------------------------------------------------------------------
router.get('/precios', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    // Precios solo tienen sentido para inventario; respeta los demás filtros
    const { P, items, puente } = await calcularDesglose(req, 'articulo', { tipo: 'inventario' });
    const comparables = items
      .filter(i => i.precio_promedio && i.precio_promedio_prev && i.gasto > 0 && i.gasto_prev > 0)
      .map(i => ({ ...i, impacto: i.efecto_precio }));
    const subieron = comparables.filter(i => i.variacion_precio_pct > 0.5);
    const bajaron  = comparables.filter(i => i.variacion_precio_pct < -0.5);
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        inflacion_pct: puente.inflacion_pct,
        efecto_precio: puente.precio,
        base_comparable: puente.cobertura_precio,
        gasto_inventario: items.reduce((s, i) => s + i.gasto, 0),
        n_comparables: comparables.length,
        n_subieron: subieron.length,
        n_bajaron: bajaron.length,
        sobrecosto: subieron.reduce((s, i) => s + i.impacto, 0),
        ahorro: bajaron.reduce((s, i) => s + i.impacto, 0),
        items: comparables.sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto)).slice(0, limit),
      },
    });
  } catch (error) {
    console.error('compras precios error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/compras/detalle   Líneas de compra (paginado; limit alto para exportar)
// ---------------------------------------------------------------------------
router.get('/detalle', async (req, res) => {
  try {
    const P = parseWindow(req);
    const limit  = Math.min(parseInt(req.query.limit) || 200, 20000);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const busqueda = String(req.query.busqueda || '').trim();

    const params = [];
    const where = [`f.fecha_emision BETWEEN ${P.D} AND ${P.H}`, ...filtros(req.query, params)];
    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(p.nombre ILIKE ${p} OR p.codigo_proveedor ILIKE ${p} OR a.descripcion ILIKE ${p}
                   OR a.codigo_articulo ILIKE ${p} OR f.fact_num::text ILIKE ${p})`);
    }
    const whereSql = where.join(' AND ');

    const [rows, totalRow] = await Promise.all([
      db.allAsync(`
        SELECT
          f.compra_id AS id, f.fact_num, f.tipo_doc, f.fecha_emision,
          p.codigo_proveedor, ${NOMBRE_PROV} AS proveedor,
          s.nombre AS sucursal,
          a.codigo_articulo, a.descripcion AS articulo,
          ${DIMS.categoria.expr} AS categoria, ${DIMS.subcategoria.expr} AS subcategoria, ${DIMS.sublinea.expr} AS sublinea,
          ${TIPO_EXPR} AS tipo,
          f.unidades, f.total_sin_iva, f.total_con_iva, f.iva, f.saldo
        ${JOINS}
        JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = f.sucursal_id
        WHERE ${whereSql}
        ORDER BY f.fecha_emision DESC, f.total_sin_iva DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params),
      db.getAsync(`
        SELECT COUNT(*) AS total, COALESCE(SUM(f.total_sin_iva), 0) AS suma_sin_iva,
               COUNT(DISTINCT f.fact_num) AS facturas
        ${JOINS}
        WHERE ${whereSql}
      `, params),
    ]);

    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        total_filas: parseInt(totalRow.total) || 0,
        facturas: parseInt(totalRow.facturas) || 0,
        suma_sin_iva_filtrada: n(totalRow.suma_sin_iva),
        filas: rows.map(r => ({
          id: parseInt(r.id),
          fact_num: r.fact_num,
          tipo_doc: r.tipo_doc,
          fecha_emision: r.fecha_emision,
          codigo_proveedor: r.codigo_proveedor,
          proveedor: r.proveedor,
          sucursal: r.sucursal,
          codigo_articulo: r.codigo_articulo,
          articulo: r.articulo,
          categoria: r.categoria,
          subcategoria: r.subcategoria,
          sublinea: r.sublinea,
          tipo: r.tipo,
          tipo_label: TIPO_LABEL[r.tipo],
          unidades: n(r.unidades),
          precio_unitario: n(r.unidades) > 0 ? n(r.total_sin_iva) / n(r.unidades) : null,
          total_sin_iva: n(r.total_sin_iva),
          total_con_iva: n(r.total_con_iva),
          iva: n(r.iva),
          saldo: n(r.saldo),
        })),
      },
    });
  } catch (error) {
    console.error('compras detalle error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// =========================================================================
// GET /api/compras/recomendaciones
// Motor de recomendación de reposición:
//   - Consumo mensual = compras últ. N meses (default 6) / N
//   - Cobertura = (stock_actual + en_transito) / (consumo_mensual / 30)
//   - Lead time = por línea, default 45 días (importadores L/C)
//   - Prioridad: urgente < lead_time, alta < 1.5x, media < 2.5x, ok >= 2.5x
//   - Cantidad sugerida = (consumo × horizonte_meses) + safety_stock
//                         − stock_actual − stock_en_transito
//   - Valor sugerido = cantidad × costo_ultimo (fallback: costo_promedio)
//   - Proveedor sugerido = top proveedor histórico
// =========================================================================
router.get('/recomendaciones', async (req, res) => {
  try {
    const horizonteMeses = Math.min(Math.max(parseInt(req.query.horizonte_meses) || 3, 1), 12);
    const meses           = Math.min(Math.max(parseInt(req.query.meses_consumo) || 6, 3), 24);
    const leadTimeDefault = Math.min(Math.max(parseInt(req.query.lead_time) || 45, 7), 180);
    const factorSeguridad = Math.min(Math.max(parseFloat(req.query.safety) || 0.30, 0), 1.0);

    // ---------- 1) Consumo por artículo (últ N meses) ----------
    const rows = await db.allAsync(`
      WITH invsnap AS (
        SELECT articulo_id, stock_actual, stock_en_transito,
               costo_promedio, costo_ultimo, proveedor_id AS proveedor_snap_id
        FROM thermoplastica.fact_inventario_snapshot
        WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)
      ),
      consumo AS (
        SELECT f.articulo_id,
               SUM(f.unidades)                            AS unidades_periodo,
               SUM(f.total_sin_iva)                       AS gasto_periodo,
               COUNT(DISTINCT DATE_TRUNC('month', f.fecha_emision)) AS meses_activos,
               MAX(f.fecha_emision)                       AS ultima_compra,
               MIN(f.fecha_emision)                       AS primera_compra
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision >= CURRENT_DATE - (? || ' months')::interval
          AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE
        GROUP BY f.articulo_id
      ),
      -- Proveedor sugerido = el que más monto compró al artículo en 12m
      prov_rank AS (
        SELECT articulo_id, proveedor_id,
               SUM(total_sin_iva) AS gasto,
               ROW_NUMBER() OVER (PARTITION BY articulo_id ORDER BY SUM(total_sin_iva) DESC) AS rn
        FROM thermoplastica.fact_compras_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY articulo_id, proveedor_id
      ),
      -- Días crédito promedio del proveedor
      prov_credito AS (
        SELECT proveedor_id, AVG(dias_credito_ficha) FILTER (WHERE dias_credito_ficha > 0) AS dias_credito
        FROM thermoplastica.fact_cxp_factura
        GROUP BY proveedor_id
      )
      SELECT
        a.codigo_articulo, a.descripcion,
        COALESCE(NULLIF(a.linea, ''), 'Sin línea')        AS linea,
        COALESCE(NULLIF(a.sublinea, ''), '—')             AS sublinea,
        c.unidades_periodo, c.gasto_periodo, c.meses_activos,
        c.ultima_compra, c.primera_compra,
        i.stock_actual, i.stock_en_transito,
        i.costo_promedio, i.costo_ultimo,
        p.nombre AS proveedor_sugerido,
        p.codigo_proveedor AS proveedor_codigo,
        pc.dias_credito AS proveedor_dias_credito
      FROM consumo c
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = c.articulo_id
      LEFT JOIN invsnap i ON i.articulo_id = c.articulo_id
      LEFT JOIN prov_rank pr ON pr.articulo_id = c.articulo_id AND pr.rn = 1
      LEFT JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = pr.proveedor_id
      LEFT JOIN prov_credito pc ON pc.proveedor_id = pr.proveedor_id
      WHERE a.codigo_articulo NOT IN ('GENARTICULO','GENARTICULOEXENTO','GENSERV','GENSERVICIO')
        AND COALESCE(NULLIF(a.linea, ''), 'Sin línea') NOT IN ('Costo de Producción', 'No Aplica')
        AND c.unidades_periodo > 0
    `, [meses]);

    // ---------- 2) Calcular recomendaciones ----------
    const items = rows.map(r => {
      const unidadesPeriodo = parseFloat(r.unidades_periodo) || 0;
      const gastoPeriodo    = parseFloat(r.gasto_periodo) || 0;
      const consumoMensual  = unidadesPeriodo / meses;
      const consumoDiario   = unidadesPeriodo / (meses * 30);
      const stockActual     = parseFloat(r.stock_actual) || 0;
      const transito        = parseFloat(r.stock_en_transito) || 0;
      const stockTotal      = stockActual + transito;
      const costoUnit       = parseFloat(r.costo_ultimo) || parseFloat(r.costo_promedio) || 0;
      const valorInventario = stockActual * costoUnit;
      const diasCobertura   = consumoDiario > 0 ? (stockTotal / consumoDiario) : null;

      const leadTime        = leadTimeDefault;
      const safetyStock     = consumoDiario * leadTime * factorSeguridad;
      const rop             = (consumoDiario * leadTime) + safetyStock;

      // Cantidad sugerida = consumo del horizonte + safety - stock disponible
      const targetTotal     = (consumoMensual * horizonteMeses) + safetyStock;
      const cantidadSugerida = Math.max(0, targetTotal - stockTotal);
      const valorSugerido   = cantidadSugerida * costoUnit;

      let prioridad = 'ok';
      if (diasCobertura === null || diasCobertura < leadTime) prioridad = 'urgente';
      else if (diasCobertura < leadTime * 1.5) prioridad = 'alta';
      else if (diasCobertura < leadTime * 2.5) prioridad = 'media';

      return {
        codigo: r.codigo_articulo,
        descripcion: r.descripcion,
        linea: r.linea,
        sublinea: r.sublinea,
        consumo_mensual: consumoMensual,
        consumo_diario: consumoDiario,
        stock_actual: stockActual,
        stock_transito: transito,
        stock_total: stockTotal,
        dias_cobertura: diasCobertura !== null ? Math.round(diasCobertura) : null,
        lead_time_dias: leadTime,
        safety_stock: Math.round(safetyStock),
        reorder_point: Math.round(rop),
        cantidad_sugerida: Math.round(cantidadSugerida),
        costo_unitario: costoUnit,
        valor_inventario: valorInventario,
        valor_sugerido: valorSugerido,
        gasto_periodo: gastoPeriodo,
        ultima_compra: r.ultima_compra,
        prioridad,
        proveedor_sugerido: r.proveedor_sugerido || '—',
        proveedor_codigo: r.proveedor_codigo,
        proveedor_dias_credito: r.proveedor_dias_credito ? Math.round(parseFloat(r.proveedor_dias_credito)) : null,
      };
    });

    // ---------- 3) Agregación por línea ----------
    const porLinea = {};
    items.forEach(it => {
      const key = it.linea;
      if (!porLinea[key]) {
        porLinea[key] = {
          linea: key,
          skus: 0,
          skus_urgentes: 0,
          skus_alta: 0,
          skus_media: 0,
          skus_ok: 0,
          consumo_mensual_gasto: 0,
          valor_inventario: 0,
          valor_sugerido_total: 0,
          proveedor_top: null,
          proveedores_por_gasto: {},
        };
      }
      const g = porLinea[key];
      g.skus++;
      if (it.prioridad === 'urgente') g.skus_urgentes++;
      else if (it.prioridad === 'alta') g.skus_alta++;
      else if (it.prioridad === 'media') g.skus_media++;
      else g.skus_ok++;
      g.consumo_mensual_gasto += it.consumo_mensual * it.costo_unitario;
      g.valor_inventario      += it.valor_inventario;
      g.valor_sugerido_total  += it.valor_sugerido;

      if (it.proveedor_sugerido && it.proveedor_sugerido !== '—') {
        g.proveedores_por_gasto[it.proveedor_sugerido] =
          (g.proveedores_por_gasto[it.proveedor_sugerido] || 0) + it.gasto_periodo;
      }
    });

    const lineas = Object.values(porLinea)
      .map(g => {
        const provs = Object.entries(g.proveedores_por_gasto).sort((a,b) => b[1] - a[1]);
        const consumoDiarioGasto = g.consumo_mensual_gasto / 30;
        const coberturaDias = consumoDiarioGasto > 0 ? (g.valor_inventario / consumoDiarioGasto) : null;
        return {
          linea: g.linea,
          skus: g.skus,
          skus_urgentes: g.skus_urgentes,
          skus_alta: g.skus_alta,
          skus_media: g.skus_media,
          skus_ok: g.skus_ok,
          consumo_mensual_valor: g.consumo_mensual_gasto,
          valor_inventario: g.valor_inventario,
          valor_sugerido_total: g.valor_sugerido_total,
          cobertura_dias: coberturaDias !== null ? Math.round(coberturaDias) : null,
          proveedor_top: provs[0]?.[0] || null,
        };
      })
      .sort((a, b) => (b.valor_sugerido_total || 0) - (a.valor_sugerido_total || 0));

    // ---------- 4) KPIs de resumen ----------
    const totales = items.reduce((acc, it) => {
      acc.valor_sugerido += it.valor_sugerido;
      acc.valor_inventario += it.valor_inventario;
      if (it.prioridad === 'urgente') acc.urgentes++;
      else if (it.prioridad === 'alta') acc.alta++;
      else if (it.prioridad === 'media') acc.media++;
      else acc.ok++;
      return acc;
    }, { valor_sugerido: 0, valor_inventario: 0, urgentes: 0, alta: 0, media: 0, ok: 0 });

    const consumoDiarioTotal = items.reduce((s, it) => s + (it.consumo_diario * it.costo_unitario), 0);
    const coberturaProm = consumoDiarioTotal > 0 ? (totales.valor_inventario / consumoDiarioTotal) : null;

    // ---------- 5) Top urgentes ----------
    const orden = { urgente: 0, alta: 1, media: 2, ok: 3 };
    const urgentes = items
      .filter(it => it.prioridad !== 'ok')
      .sort((a, b) => {
        const p = orden[a.prioridad] - orden[b.prioridad];
        if (p !== 0) return p;
        return (b.valor_sugerido || 0) - (a.valor_sugerido || 0);
      })
      .slice(0, 30);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      parametros: {
        horizonte_meses: horizonteMeses,
        meses_consumo: meses,
        lead_time_dias: leadTimeDefault,
        factor_seguridad: factorSeguridad,
      },
      data: {
        kpis: {
          skus_activos: items.length,
          skus_urgentes: totales.urgentes,
          skus_alta: totales.alta,
          skus_media: totales.media,
          skus_ok: totales.ok,
          valor_sugerido_total: totales.valor_sugerido,
          valor_inventario_total: totales.valor_inventario,
          cobertura_promedio_dias: coberturaProm !== null ? Math.round(coberturaProm) : null,
        },
        lineas,
        urgentes,
        total_items: items.length,
      },
    });
  } catch (error) {
    console.error('recomendaciones error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
