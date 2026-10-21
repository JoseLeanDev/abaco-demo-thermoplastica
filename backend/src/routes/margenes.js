const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const { parsePeriodo } = require('../services/periodo');
const M = require('../services/margen');
const { middlewareLaminados } = require('../services/laminadosHttp');
router.use(middlewareLaminados('margenes', db.pool));

// -------------------------------------------------------------------
// Semáforo: margen del período del filtro global vs el mismo período un año antes.
// Verde  => delta_puntos >= -1  (estable o mejor)
// Ámbar  => delta_puntos entre -5 y -1
// Rojo   => delta_puntos < -5
// -------------------------------------------------------------------
function semaforo(delta) {
  if (delta === null || delta === undefined || isNaN(delta)) return 'verde';
  if (delta >= -1) return 'verde';
  if (delta >= -5) return 'ambar';
  return 'rojo';
}

// Filtro de producto ?categoria=&subcategoria=&sublinea= (misma jerarquía que Ventas:
// categoría = marca, subcategoría = linea, sublínea = sublinea del ERP).
const limpio = (e, vacio) => `COALESCE(NULLIF(TRIM(${e}), ''), '${vacio}')`;
const DIMS_PRODUCTO = {
  categoria:    limpio('a.marca', 'Sin categoría'),
  subcategoria: limpio('a.linea', 'Sin subcategoría'),
  sublinea:     limpio('a.sublinea', 'Sin sublínea'),
};
function filtroProducto(req) {
  const params = [];
  const where = [];
  for (const [k, expr] of Object.entries(DIMS_PRODUCTO)) {
    const val = req.query[k];
    if (val === undefined || val === '') continue;
    params.push(String(val));
    where.push(`${expr} = ?`);
  }
  return { params, and: where.length ? 'AND ' + where.join(' AND ') : '' };
}

// Líneas de venta facturadas del período (o del año anterior) con el filtro de
// producto, como subconsulta con las columnas de fact_ventas_linea.
function ventas(P, fp, anterior = false) {
  return `(SELECT f.* FROM thermoplastica.v_ventas_costeadas f
           JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
           WHERE f.tipo_doc = 'FACT' AND f.fecha_emision BETWEEN ${anterior ? P.prevD : P.D} AND ${anterior ? P.prevH : P.H}
           ${fp.and})`;
}

// GET /api/margenes   Resumen + top productos con margen comparado YoY
router.get('/', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const fp = filtroProducto(req);
    // Producto: margen del período vs el mismo período del año anterior.
    // Solo artículos con ventas materiales en el período (>= Q1,000).
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT f.articulo_id,
               SUM(f.unidades)              AS unidades,
               SUM(f.total_sin_iva)         AS ventas,
               ${M.costo('f')} AS costo,
               ${M.margen('f')} AS margen, ${M.base('f')} AS base_margen
        FROM ${ventas(P, fp)} f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        -- Excluir "articulo generico" y similares placeholders sin costo real
        WHERE UPPER(a.codigo_articulo) NOT IN ('GENARTICULO','GENARTICULOEXENTO','GENSERV','GENSERVICIO')
        GROUP BY f.articulo_id
        HAVING SUM(f.total_sin_iva) >= 1000 AND SUM(f.unidades) > 0
      ),
      historico AS (
        SELECT articulo_id,
               SUM(unidades)              AS unidades,
               SUM(total_sin_iva)         AS ventas,
               ${M.margen()} AS margen, ${M.base()} AS base_margen
        FROM thermoplastica.v_ventas_costeadas
        WHERE fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}
          AND tipo_doc = 'FACT'
          AND articulo_id IN (SELECT articulo_id FROM actual)
        GROUP BY articulo_id
      )
      SELECT
        a.articulo_id                                              AS id,
        art.codigo_articulo                                        AS sku,
        art.descripcion                                            AS nombre,
        ${DIMS_PRODUCTO.categoria.replace(/a\./g, 'art.')}         AS categoria,
        ${DIMS_PRODUCTO.subcategoria.replace(/a\./g, 'art.')}      AS subcategoria,
        ${DIMS_PRODUCTO.sublinea.replace(/a\./g, 'art.')}          AS sublinea,
        a.unidades                                                 AS unidades_12m,
        a.ventas AS ventas_12m, a.margen AS margen_q_real,
        CASE WHEN a.unidades > 0 THEN a.ventas / a.unidades ELSE NULL END          AS precio_actual,
        CASE WHEN a.unidades > 0 THEN a.costo  / a.unidades ELSE NULL END          AS costo_actual,
        CASE WHEN a.ventas   > 0 THEN a.margen / NULLIF(a.base_margen,0) * 100 ELSE NULL END      AS margen_pct_actual,
        CASE WHEN h.ventas   > 0 THEN h.margen / NULLIF(h.base_margen,0) * 100 ELSE NULL END      AS margen_pct_historico
      FROM actual a
      JOIN thermoplastica.dim_articulo art ON art.articulo_id = a.articulo_id
      LEFT JOIN historico h                ON h.articulo_id   = a.articulo_id
      WHERE a.ventas > 0
      ORDER BY a.ventas DESC
    `, fp.params);

    // Rango razonable para comparación: descartar históricos con márgenes absurdos
    // que suelen indicar mala data de costo en el ERP (ajustes contables, no cambios reales de precio)
    const productos = rows
      .filter(r => {
        const hist = parseFloat(r.margen_pct_historico);
        // Si no hay histórico está OK (se marcará como verde). Si hay pero es > 90% o < -10%,
        // probablemente es un rebalance de costo, no un comparable real.
        // Sin ninguna línea con costo no hay margen que comparar.
        if (r.margen_pct_actual === null) return false;
        return r.margen_pct_historico === null || (hist <= 90 && hist >= -10);
      })
      .map(r => {
      const margenAct = parseFloat(r.margen_pct_actual);
      const sinHist = r.margen_pct_historico === null;
      const margenHist = sinHist ? margenAct : parseFloat(r.margen_pct_historico);
      const delta = Number((margenAct - margenHist).toFixed(2));
      const costo = parseFloat(r.costo_actual) || 0;
      const precio = parseFloat(r.precio_actual) || 0;
      const ventasQ = parseFloat(r.ventas_12m) || 0;
      // Precio sugerido: costo / (1 - margen_historico/100), tope de subida 30%
      let precioSugerido = precio;
      if (margenHist > margenAct && margenHist < 90 && costo > 0) {
        precioSugerido = Math.min(costo / (1 - margenHist / 100), precio * 1.3);
      }
      return {
        id: parseInt(r.id),
        sku: r.sku,
        nombre: r.nombre,
        categoria: r.categoria,
        subcategoria: r.subcategoria,
        sublinea: r.sublinea,
        ventas: Math.round(ventasQ),
        margen_q: Math.round(Number(r.margen_q_real)),
        precio_actual: Number(precio.toFixed(4)),
        costo_actual:  Number(costo.toFixed(4)),
        margen_pct_actual:    Number(margenAct.toFixed(2)),
        margen_pct_historico: sinHist ? null : Number(margenHist.toFixed(2)),
        delta_puntos: sinHist ? null : delta,
        semaforo: semaforo(delta),
        unidades_12m: Math.round(parseFloat(r.unidades_12m) || 0),
        precio_sugerido: Number(precioSugerido.toFixed(4)),
      };
    });

    // Los productos Laminados del listado general conservan el CPP por kg
    // elegible, N/D y semáforos del mismo contrato que su selección exclusiva.
    if (!req.query.categoria) {
      const lam = await require('../services/laminados').obtenerReporte({query:{...req.query,categoria:'Laminados'}},db.pool);
      const otros = productos.filter((p)=>p.categoria!=='Laminados');
      productos.splice(0,productos.length,...otros,...lam.data.productos);
      productos.sort((a,b)=>b.ventas-a.ventas);
    }

    // Resumen global (mismo filtro de producto), este período y el año anterior
    const totalRow = await db.getAsync(`
      SELECT COALESCE(SUM(total_sin_iva), 0)         AS ventas,
             ${M.margen()} AS margen, ${M.base()} AS base_margen,
             ${M.pctSinCosto()}     AS pct_sin_costo,
             (SELECT ${M.pct()} FROM ${ventas(P, fp, true)} x) AS margen_pct_prev
      FROM ${ventas(P, fp)} x
    `, [...fp.params, ...fp.params]);
    const totalVentas = parseFloat(totalRow.ventas) || 0;
    const totalMargen = parseFloat(totalRow.margen) || 0;
    const margenGlobal = Number(totalRow.base_margen) > 0 ? totalMargen / Number(totalRow.base_margen) * 100 : null;
    const margenPrev = totalRow.margen_pct_prev !== null ? parseFloat(totalRow.margen_pct_prev) : null;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        resumen: {
          total_margen_bruto_q: Math.round(totalMargen),
          margen_global_pct:    margenGlobal === null ? null : Number(margenGlobal.toFixed(1)),
          margen_global_pct_prev: margenPrev === null ? null : Number(margenPrev.toFixed(1)),
          total_ventas_q:       Math.round(totalVentas),
          pct_ventas_sin_costo: Math.round((parseFloat(totalRow.pct_sin_costo) || 0) * 10) / 10,
          productos_rojo:  productos.filter(p => p.semaforo === 'rojo').length,
          productos_ambar: productos.filter(p => p.semaforo === 'ambar').length,
          productos_verde: productos.filter(p => p.semaforo === 'verde').length,
          total_productos: productos.length,
        },
        productos,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/margenes/producto/:id/detalle   Historial mensual precio/costo/margen
router.get('/producto/:id/detalle', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const articuloId = parseInt(req.params.id);
    if (!articuloId) return res.status(400).json({ status: 'error', message: 'id inválido' });

    const producto = await db.getAsync(`
      WITH agg AS (
        SELECT SUM(unidades)              AS unidades,
               SUM(total_sin_iva)         AS ventas,
               ${M.costo()} AS costo,
               ${M.margen()} AS margen, ${M.base()} AS base_margen
        FROM thermoplastica.v_ventas_costeadas
        WHERE articulo_id = ? AND tipo_doc = 'FACT'
          AND fecha_emision BETWEEN ${P.D} AND ${P.H}
      )
      SELECT a.articulo_id AS id, a.codigo_articulo AS sku, a.descripcion AS nombre,
             agg.unidades AS unidades_12m, agg.ventas AS ventas_12m,
             CASE WHEN agg.unidades > 0 THEN agg.ventas / agg.unidades ELSE NULL END AS precio_actual,
             CASE WHEN agg.unidades > 0 THEN agg.costo  / agg.unidades ELSE NULL END AS costo_actual,
             CASE WHEN agg.ventas   > 0 THEN agg.margen / NULLIF(agg.base_margen,0) * 100 ELSE NULL END AS margen_pct_actual
      FROM thermoplastica.dim_articulo a
      LEFT JOIN agg ON true
      WHERE a.articulo_id = ?
    `, [articuloId, articuloId]);

    if (!producto) return res.status(404).json({ status: 'error', message: 'Artículo no encontrado' });

    // Historial: precio promedio, costo unitario y margen % por mes (período + el año previo)
    const historial = await db.allAsync(`
      SELECT TO_CHAR(DATE_TRUNC('month', fecha_emision), 'YYYY-MM-DD') AS fecha,
             CASE WHEN SUM(unidades) > 0 THEN SUM(total_sin_iva) / SUM(unidades) ELSE NULL END      AS precio_promedio_realizado,
             CASE WHEN SUM(unidades) > 0 THEN (${M.costo()}) / SUM(unidades) ELSE NULL END AS costo_unitario,
             ${M.pct()} AS margen_pct,
             SUM(unidades)      AS unidades,
             SUM(total_sin_iva) AS ventas
      FROM thermoplastica.v_ventas_costeadas
      WHERE articulo_id = ? AND tipo_doc = 'FACT'
        AND fecha_emision BETWEEN (${P.D} - INTERVAL '1 year') AND ${P.H}
      GROUP BY 1 ORDER BY 1
    `, [articuloId]);

    res.json({
      status: 'success',
      data: {
        producto: {
          id: producto.id,
          sku: producto.sku,
          nombre: producto.nombre,
          precio_actual: parseFloat(producto.precio_actual) || 0,
          costo_actual:  parseFloat(producto.costo_actual) || 0,
          margen_pct_actual: producto.margen_pct_actual !== null ? parseFloat(producto.margen_pct_actual) : null,
          unidades_12m: Math.round(parseFloat(producto.unidades_12m) || 0),
          ventas_12m:   Math.round(parseFloat(producto.ventas_12m) || 0),
        },
        historial: historial.map(h => ({
          fecha: h.fecha,
          precio_promedio_realizado: Number((parseFloat(h.precio_promedio_realizado) || 0).toFixed(4)),
          costo_unitario:            Number((parseFloat(h.costo_unitario) || 0).toFixed(4)),
          margen_pct:                Number((parseFloat(h.margen_pct) || 0).toFixed(2)),
          unidades: Math.round(parseFloat(h.unidades) || 0),
          ventas:   Math.round(parseFloat(h.ventas) || 0),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/margenes/vendedores   Ranking vendedores con comparación YoY
router.get('/vendedores', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const fp = filtroProducto(req);
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT vendedor_id,
               SUM(total_sin_iva)         AS ventas,
               ${M.margen()} AS margen, ${M.base()} AS base_margen
        FROM ${ventas(P, fp)} x
        WHERE vendedor_id IS NOT NULL
        GROUP BY vendedor_id
      ),
      historico AS (
        SELECT vendedor_id,
               SUM(total_sin_iva) AS ventas,
               ${M.margen()} AS margen, ${M.base()} AS base_margen
        FROM ${ventas(P, fp, true)} x
        WHERE vendedor_id IS NOT NULL
        GROUP BY vendedor_id
      )
      SELECT v.vendedor_id AS id, v.nombre,
             a.ventas AS ventas_12m,
             CASE WHEN a.ventas > 0 THEN a.margen / NULLIF(a.base_margen,0) * 100 ELSE NULL END AS margen_pct_actual,
             CASE WHEN h.ventas > 0 THEN h.margen / NULLIF(h.base_margen,0) * 100 ELSE NULL END AS margen_pct_historico
      FROM actual a
      JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = a.vendedor_id
      LEFT JOIN historico h ON h.vendedor_id = a.vendedor_id
      ORDER BY a.ventas DESC
    `, [...fp.params, ...fp.params]);

    // Sin ninguna línea con costo no hay margen conocido: se omite.
    const vendedores = rows.filter(r => r.margen_pct_actual !== null).map(r => {
      const act  = parseFloat(r.margen_pct_actual)   || 0;
      const hist = r.margen_pct_historico !== null ? parseFloat(r.margen_pct_historico) : act;
      const delta = Number((act - hist).toFixed(2));
      return {
        id: parseInt(r.id),
        nombre: r.nombre,
        ventas_12m: Math.round(parseFloat(r.ventas_12m) || 0),
        margen_pct_actual:    Number(act.toFixed(2)),
        margen_pct_historico: Number(hist.toFixed(2)),
        delta_puntos: delta,
        semaforo: semaforo(delta),
      };
    });

    res.json({ status: 'success', data: vendedores });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/margenes/clientes   Top clientes con comparación YoY
router.get('/clientes', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const fp = filtroProducto(req);
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT cliente_id,
               SUM(total_sin_iva) AS ventas,
               ${M.margen()} AS margen, ${M.base()} AS base_margen
        FROM ${ventas(P, fp)} x
        GROUP BY cliente_id
      ),
      historico AS (
        SELECT cliente_id,
               SUM(total_sin_iva) AS ventas,
               ${M.margen()} AS margen, ${M.base()} AS base_margen
        FROM ${ventas(P, fp, true)} x
        GROUP BY cliente_id
      )
      SELECT c.cliente_id AS id, REGEXP_REPLACE(c.nombre, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', '') AS nombre,
             a.ventas AS ventas_12m,
             CASE WHEN a.ventas > 0 THEN a.margen / NULLIF(a.base_margen,0) * 100 ELSE NULL END AS margen_pct_actual,
             CASE WHEN h.ventas > 0 THEN h.margen / NULLIF(h.base_margen,0) * 100 ELSE NULL END AS margen_pct_historico
      FROM actual a
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = a.cliente_id
      LEFT JOIN historico h ON h.cliente_id = a.cliente_id
      WHERE a.ventas >= ${fp.and ? 1000 : 10000}
      ORDER BY a.ventas DESC
      LIMIT 30
    `, [...fp.params, ...fp.params]);

    // Sin ninguna línea con costo no hay margen conocido: se omite.
    const clientes = rows.filter(r => r.margen_pct_actual !== null).map(r => {
      const act  = parseFloat(r.margen_pct_actual) || 0;
      const hist = r.margen_pct_historico !== null ? parseFloat(r.margen_pct_historico) : act;
      const delta = Number((act - hist).toFixed(2));
      return {
        id: parseInt(r.id),
        nombre: r.nombre,
        ventas_12m: Math.round(parseFloat(r.ventas_12m) || 0),
        margen_pct_actual:    Number(act.toFixed(2)),
        margen_pct_historico: Number(hist.toFixed(2)),
        delta_puntos: delta,
        semaforo: semaforo(delta),
      };
    });

    res.json({ status: 'success', data: clientes });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/margenes/lineas   Ranking por línea de producto con YoY
router.get('/lineas', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT a.linea       AS linea,
               SUM(f.unidades)      AS unidades,
               SUM(f.total_sin_iva) AS ventas,
               ${M.margen('f')} AS margen, ${M.base('f')} AS base_margen
        FROM thermoplastica.v_ventas_costeadas f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H} AND f.tipo_doc = 'FACT'
          AND a.linea IS NOT NULL
        GROUP BY a.linea
      ),
      historico AS (
        SELECT a.linea       AS linea,
               SUM(f.total_sin_iva) AS ventas,
               ${M.margen('f')} AS margen, ${M.base('f')} AS base_margen
        FROM thermoplastica.v_ventas_costeadas f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}
          AND f.tipo_doc = 'FACT' AND a.linea IS NOT NULL
        GROUP BY a.linea
      )
      SELECT a.linea AS nombre,
             a.unidades AS unidades_12m,
             a.ventas   AS ventas_12m,
             CASE WHEN a.ventas > 0 THEN a.margen / NULLIF(a.base_margen,0) * 100 ELSE NULL END AS margen_pct_actual,
             CASE WHEN h.ventas > 0 THEN h.margen / NULLIF(h.base_margen,0) * 100 ELSE NULL END AS margen_pct_historico
      FROM actual a
      LEFT JOIN historico h ON h.linea = a.linea
      ORDER BY a.ventas DESC
    `);

    // Sin ninguna línea con costo no hay margen conocido: se omite.
    const lineas = rows.filter(r => r.margen_pct_actual !== null).map((r, i) => {
      const act  = parseFloat(r.margen_pct_actual) || 0;
      const hist = r.margen_pct_historico !== null ? parseFloat(r.margen_pct_historico) : act;
      const delta = Number((act - hist).toFixed(2));
      return {
        id: i + 1,
        nombre: r.nombre,
        unidades_12m: Math.round(parseFloat(r.unidades_12m) || 0),
        ventas_12m:   Math.round(parseFloat(r.ventas_12m) || 0),
        margen_pct_actual:    Number(act.toFixed(2)),
        margen_pct_historico: Number(hist.toFixed(2)),
        delta_puntos: delta,
        semaforo: semaforo(delta),
      };
    });

    res.json({ status: 'success', data: lineas });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
