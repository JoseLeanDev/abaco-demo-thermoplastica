const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// -------------------------------------------------------------------
// Semáforo: comparación actual vs histórico (mismo período 12 meses atrás).
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

// Q dejados de ganar = ventas_actuales × (delta puntos negativos / 100)
// Solo aplica cuando el margen actual es MENOR al histórico.
function qPerdidos(ventasActuales, deltaPuntos) {
  const d = parseFloat(deltaPuntos) || 0;
  if (d >= 0) return 0;
  return Math.round(parseFloat(ventasActuales) * Math.abs(d) / 100);
}

// GET /api/margenes   Resumen + top productos con margen comparado YoY
router.get('/', async (req, res) => {
  try {
    // Producto: margen actual (últ 12m) vs histórico (12m anteriores)
    // Solo artículos con ventas materiales en el período actual (>= Q1000).
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT f.articulo_id,
               SUM(f.unidades)              AS unidades,
               SUM(f.total_sin_iva)         AS ventas,
               SUM(f.costo_total_facturado) AS costo,
               SUM(f.margen_bruto)          AS margen
        FROM thermoplastica.fact_ventas_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND f.tipo_doc = 'FACT'
          -- Excluir "articulo generico" y similares placeholders sin costo real
          AND UPPER(a.codigo_articulo) NOT IN ('GENARTICULO','GENARTICULOEXENTO','GENSERV','GENSERVICIO')
        GROUP BY f.articulo_id
        HAVING SUM(f.total_sin_iva) >= 1000 AND SUM(f.unidades) > 0
      ),
      historico AS (
        SELECT articulo_id,
               SUM(unidades)              AS unidades,
               SUM(total_sin_iva)         AS ventas,
               SUM(margen_bruto)          AS margen
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
          AND fecha_emision <  CURRENT_DATE - INTERVAL '12 months'
          AND tipo_doc = 'FACT'
        GROUP BY articulo_id
      )
      SELECT
        a.articulo_id                                              AS id,
        art.codigo_articulo                                        AS sku,
        art.descripcion                                            AS nombre,
        a.unidades                                                 AS unidades_12m,
        a.ventas                                                   AS ventas_12m,
        CASE WHEN a.unidades > 0 THEN a.ventas / a.unidades ELSE NULL END          AS precio_actual,
        CASE WHEN a.unidades > 0 THEN a.costo  / a.unidades ELSE NULL END          AS costo_actual,
        CASE WHEN a.ventas   > 0 THEN a.margen / a.ventas * 100 ELSE NULL END      AS margen_pct_actual,
        CASE WHEN h.ventas   > 0 THEN h.margen / h.ventas * 100 ELSE NULL END      AS margen_pct_historico
      FROM actual a
      JOIN thermoplastica.dim_articulo art ON art.articulo_id = a.articulo_id
      LEFT JOIN historico h                ON h.articulo_id   = a.articulo_id
      WHERE a.ventas > 0
      ORDER BY a.ventas DESC
      LIMIT 50
    `);

    // Rango razonable para comparación: descartar históricos con márgenes absurdos
    // que suelen indicar mala data de costo en el ERP (ajustes contables, no cambios reales de precio)
    const productos = rows
      .filter(r => {
        const hist = parseFloat(r.margen_pct_historico);
        // Si no hay histórico está OK (se marcará como verde). Si hay pero es > 90% o < -10%,
        // probablemente es un rebalance de costo, no un comparable real.
        return r.margen_pct_historico === null || (hist <= 90 && hist >= -10);
      })
      .map(r => {
      const margenAct = parseFloat(r.margen_pct_actual);
      const margenHist = r.margen_pct_historico !== null ? parseFloat(r.margen_pct_historico) : margenAct;
      const delta = Number((margenAct - margenHist).toFixed(2));
      const perdidos = qPerdidos(r.ventas_12m, delta);
      const costo = parseFloat(r.costo_actual) || 0;
      const precio = parseFloat(r.precio_actual) || 0;
      // Precio sugerido: costo / (1 - margen_historico/100), tope de subida 30%
      let precioSugerido = precio;
      if (margenHist > margenAct && margenHist < 90 && costo > 0) {
        precioSugerido = Math.min(costo / (1 - margenHist / 100), precio * 1.3);
      }
      return {
        id: parseInt(r.id),
        sku: r.sku,
        nombre: r.nombre,
        precio_actual: Number(precio.toFixed(4)),
        costo_actual:  Number(costo.toFixed(4)),
        margen_pct_actual:    Number(margenAct.toFixed(2)),
        margen_pct_historico: Number(margenHist.toFixed(2)),
        delta_puntos: delta,
        quetzales_perdidos: perdidos,
        semaforo: semaforo(delta),
        unidades_12m: Math.round(parseFloat(r.unidades_12m) || 0),
        precio_sugerido: Number(precioSugerido.toFixed(4)),
      };
    });

    // Resumen global desde el mismo dataset
    const totalRow = await db.getAsync(`
      SELECT COALESCE(SUM(total_sin_iva), 0)         AS ventas,
             COALESCE(SUM(margen_bruto), 0)          AS margen
      FROM thermoplastica.fact_ventas_linea
      WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND tipo_doc = 'FACT'
    `);
    const totalVentas = parseFloat(totalRow.ventas) || 0;
    const totalMargen = parseFloat(totalRow.margen) || 0;
    const margenGlobal = totalVentas > 0 ? (totalMargen / totalVentas * 100) : 0;
    const totalPerdido = productos.reduce((s, p) => s + (p.quetzales_perdidos || 0), 0);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        resumen: {
          total_margen_bruto_q: Math.round(totalMargen),
          margen_global_pct:    Number(margenGlobal.toFixed(1)),
          total_margen_perdido_12m: totalPerdido,
          total_ventas_q:       Math.round(totalVentas),
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
    const articuloId = parseInt(req.params.id);
    if (!articuloId) return res.status(400).json({ status: 'error', message: 'id inválido' });

    const producto = await db.getAsync(`
      WITH agg AS (
        SELECT SUM(unidades)              AS unidades,
               SUM(total_sin_iva)         AS ventas,
               SUM(costo_total_facturado) AS costo,
               SUM(margen_bruto)          AS margen
        FROM thermoplastica.fact_ventas_linea
        WHERE articulo_id = ? AND tipo_doc = 'FACT'
          AND fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
      )
      SELECT a.articulo_id AS id, a.codigo_articulo AS sku, a.descripcion AS nombre,
             agg.unidades AS unidades_12m, agg.ventas AS ventas_12m,
             CASE WHEN agg.unidades > 0 THEN agg.ventas / agg.unidades ELSE NULL END AS precio_actual,
             CASE WHEN agg.unidades > 0 THEN agg.costo  / agg.unidades ELSE NULL END AS costo_actual,
             CASE WHEN agg.ventas   > 0 THEN agg.margen / agg.ventas * 100 ELSE NULL END AS margen_pct_actual
      FROM thermoplastica.dim_articulo a
      LEFT JOIN agg ON true
      WHERE a.articulo_id = ?
    `, [articuloId, articuloId]);

    if (!producto) return res.status(404).json({ status: 'error', message: 'Artículo no encontrado' });

    // Historial: precio promedio, costo unitario y margen % por mes últimos 24 meses
    const historial = await db.allAsync(`
      SELECT TO_CHAR(DATE_TRUNC('month', fecha_emision), 'YYYY-MM-DD') AS fecha,
             CASE WHEN SUM(unidades) > 0 THEN SUM(total_sin_iva) / SUM(unidades) ELSE NULL END      AS precio_promedio_realizado,
             CASE WHEN SUM(unidades) > 0 THEN SUM(costo_total_facturado) / SUM(unidades) ELSE NULL END AS costo_unitario,
             CASE WHEN SUM(total_sin_iva) > 0 THEN SUM(margen_bruto) / SUM(total_sin_iva) * 100 ELSE NULL END AS margen_pct,
             SUM(unidades)      AS unidades,
             SUM(total_sin_iva) AS ventas
      FROM thermoplastica.fact_ventas_linea
      WHERE articulo_id = ? AND tipo_doc = 'FACT'
        AND fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
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
          margen_pct_actual: parseFloat(producto.margen_pct_actual) || 0,
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
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT vendedor_id,
               SUM(total_sin_iva)         AS ventas,
               SUM(margen_bruto)          AS margen
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
          AND tipo_doc = 'FACT' AND vendedor_id IS NOT NULL
        GROUP BY vendedor_id
      ),
      historico AS (
        SELECT vendedor_id,
               SUM(total_sin_iva) AS ventas,
               SUM(margen_bruto)  AS margen
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
          AND fecha_emision <  CURRENT_DATE - INTERVAL '12 months'
          AND tipo_doc = 'FACT' AND vendedor_id IS NOT NULL
        GROUP BY vendedor_id
      )
      SELECT v.vendedor_id AS id, v.nombre,
             a.ventas AS ventas_12m,
             CASE WHEN a.ventas > 0 THEN a.margen / a.ventas * 100 ELSE NULL END AS margen_pct_actual,
             CASE WHEN h.ventas > 0 THEN h.margen / h.ventas * 100 ELSE NULL END AS margen_pct_historico
      FROM actual a
      JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = a.vendedor_id
      LEFT JOIN historico h ON h.vendedor_id = a.vendedor_id
      ORDER BY a.ventas DESC
    `);

    const vendedores = rows.map(r => {
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
        quetzales_perdidos: qPerdidos(r.ventas_12m, delta),
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
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT cliente_id,
               SUM(total_sin_iva) AS ventas,
               SUM(margen_bruto)  AS margen
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND tipo_doc = 'FACT'
        GROUP BY cliente_id
      ),
      historico AS (
        SELECT cliente_id,
               SUM(total_sin_iva) AS ventas,
               SUM(margen_bruto)  AS margen
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
          AND fecha_emision <  CURRENT_DATE - INTERVAL '12 months'
          AND tipo_doc = 'FACT'
        GROUP BY cliente_id
      )
      SELECT c.cliente_id AS id, c.nombre,
             a.ventas AS ventas_12m,
             CASE WHEN a.ventas > 0 THEN a.margen / a.ventas * 100 ELSE NULL END AS margen_pct_actual,
             CASE WHEN h.ventas > 0 THEN h.margen / h.ventas * 100 ELSE NULL END AS margen_pct_historico
      FROM actual a
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = a.cliente_id
      LEFT JOIN historico h ON h.cliente_id = a.cliente_id
      WHERE a.ventas >= 10000
      ORDER BY a.ventas DESC
      LIMIT 30
    `);

    const clientes = rows.map(r => {
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
        quetzales_perdidos: qPerdidos(r.ventas_12m, delta),
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
    const rows = await db.allAsync(`
      WITH actual AS (
        SELECT a.linea       AS linea,
               SUM(f.unidades)      AS unidades,
               SUM(f.total_sin_iva) AS ventas,
               SUM(f.margen_bruto)  AS margen
        FROM thermoplastica.fact_ventas_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND f.tipo_doc = 'FACT'
          AND a.linea IS NOT NULL
        GROUP BY a.linea
      ),
      historico AS (
        SELECT a.linea       AS linea,
               SUM(f.total_sin_iva) AS ventas,
               SUM(f.margen_bruto)  AS margen
        FROM thermoplastica.fact_ventas_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
          AND f.fecha_emision <  CURRENT_DATE - INTERVAL '12 months'
          AND f.tipo_doc = 'FACT' AND a.linea IS NOT NULL
        GROUP BY a.linea
      )
      SELECT a.linea AS nombre,
             a.unidades AS unidades_12m,
             a.ventas   AS ventas_12m,
             CASE WHEN a.ventas > 0 THEN a.margen / a.ventas * 100 ELSE NULL END AS margen_pct_actual,
             CASE WHEN h.ventas > 0 THEN h.margen / h.ventas * 100 ELSE NULL END AS margen_pct_historico
      FROM actual a
      LEFT JOIN historico h ON h.linea = a.linea
      ORDER BY a.ventas DESC
    `);

    const lineas = rows.map((r, i) => {
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
        quetzales_perdidos: qPerdidos(r.ventas_12m, delta),
        semaforo: semaforo(delta),
      };
    });

    res.json({ status: 'success', data: lineas });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
