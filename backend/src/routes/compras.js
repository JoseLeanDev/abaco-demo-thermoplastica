const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// Helpers ------------------------------------------------------------------

// Ventana default: 12 meses hacia atrás terminando en el mes actual.
function parseWindow(req) {
  const hasta = req.query.hasta ? new Date(req.query.hasta) : new Date();
  const desde = req.query.desde ? new Date(req.query.desde)
                                : new Date(new Date().setMonth(hasta.getMonth() - 11, 1));
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };
}

// El toggle "incluir gastos" define si mezclamos compras de materia prima
// con la categoría "Gastos de Operación" (que en el ERP son gastos contables
// registrados como líneas de factura sin ser materia prima real).
function gastoFilter(incluirGastos) {
  return incluirGastos ? '' : 'AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE';
}

// GET /api/compras   Resumen: KPIs + serie mensual
router.get('/', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const incluirGastos = req.query.incluir_gastos === 'true';
    const filtroGasto = gastoFilter(incluirGastos);

    const kpis = await db.getAsync(`
      SELECT
        COALESCE(SUM(f.total_sin_iva), 0)                                  AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)                                  AS gasto_con_iva,
        COALESCE(SUM(f.iva), 0)                                            AS iva_acreditable,
        COALESCE(SUM(f.total_sin_iva_dev), 0)                              AS devoluciones_sin_iva,
        COUNT(DISTINCT f.fact_num)                                         AS facturas,
        COUNT(DISTINCT f.proveedor_id)                                     AS proveedores,
        COUNT(*)                                                           AS lineas
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${filtroGasto}
    `, [desde, hasta]);

    const mensual = await db.allAsync(`
      SELECT
        TO_CHAR(f.fecha_emision, 'YYYY-MM')                                AS periodo,
        COALESCE(SUM(f.total_sin_iva), 0)                                  AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)                                  AS gasto_con_iva,
        COUNT(DISTINCT f.fact_num)                                         AS facturas
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${filtroGasto}
      GROUP BY 1
      ORDER BY 1
    `, [desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta, incluye_gastos_operativos: incluirGastos },
        gasto_sin_iva: parseFloat(kpis.gasto_sin_iva) || 0,
        gasto_con_iva: parseFloat(kpis.gasto_con_iva) || 0,
        iva_acreditable: parseFloat(kpis.iva_acreditable) || 0,
        devoluciones_sin_iva: parseFloat(kpis.devoluciones_sin_iva) || 0,
        gasto_neto_sin_iva: (parseFloat(kpis.gasto_sin_iva) || 0) - (parseFloat(kpis.devoluciones_sin_iva) || 0),
        facturas: parseInt(kpis.facturas) || 0,
        proveedores: parseInt(kpis.proveedores) || 0,
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

// GET /api/compras/categorias    Breakdown por categoría (top N)
router.get('/categorias', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const incluirGastos = req.query.incluir_gastos === 'true';
    const filtroGasto = gastoFilter(incluirGastos);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ? AND ?
          ${filtroGasto}
      )
      SELECT
        COALESCE(a.categoria, 'Sin categoría')                             AS categoria,
        COALESCE(a.linea, 'Sin línea')                                     AS linea,
        COUNT(*)                                                           AS lineas,
        COALESCE(SUM(f.total_sin_iva), 0)                                  AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)                                  AS gasto_con_iva,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                                                    AS porcentaje
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${filtroGasto}
      GROUP BY a.categoria, a.linea
      ORDER BY gasto_sin_iva DESC
      LIMIT ${limit}
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta, incluye_gastos_operativos: incluirGastos },
        categorias: rows.map(r => ({
          categoria: r.categoria,
          linea: r.linea,
          lineas: parseInt(r.lineas) || 0,
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

// GET /api/compras/proveedores    Top proveedores por gasto (concentración)
router.get('/proveedores', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const incluirGastos = req.query.incluir_gastos === 'true';
    const filtroGasto = gastoFilter(incluirGastos);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ? AND ?
          ${filtroGasto}
      )
      SELECT
        p.codigo_proveedor,
        p.nombre                                                           AS proveedor,
        p.rif,
        COUNT(DISTINCT f.fact_num)                                         AS facturas,
        COUNT(*)                                                           AS lineas,
        COALESCE(SUM(f.total_sin_iva), 0)                                  AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)                                  AS gasto_con_iva,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                                                    AS porcentaje,
        MAX(f.fecha_emision)                                               AS ultima_compra
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${filtroGasto}
      GROUP BY p.codigo_proveedor, p.nombre, p.rif
      ORDER BY gasto_sin_iva DESC
      LIMIT ${limit}
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta, incluye_gastos_operativos: incluirGastos },
        proveedores: rows.map(r => ({
          codigo: r.codigo_proveedor,
          proveedor: r.proveedor,
          rif: r.rif,
          facturas: parseInt(r.facturas) || 0,
          lineas: parseInt(r.lineas) || 0,
          gasto_sin_iva: parseFloat(r.gasto_sin_iva) || 0,
          gasto_con_iva: parseFloat(r.gasto_con_iva) || 0,
          porcentaje: parseFloat(r.porcentaje) || 0,
          ultima_compra: r.ultima_compra,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/compras/detalle    Listado paginado de líneas
router.get('/detalle', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const incluirGastos = req.query.incluir_gastos === 'true';
    const filtroGasto = gastoFilter(incluirGastos);
    const limit  = Math.min(parseInt(req.query.limit)  || 200, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const proveedor = req.query.codigo_proveedor || '';
    const categoria = req.query.categoria || '';

    const where = [`f.fecha_emision BETWEEN $1 AND $2`];
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
    if (categoria) {
      params.push(categoria);
      where.push(`a.categoria = $${params.length}`);
    }

    const whereSql = where.join(' AND ') + ' ' + (filtroGasto ? filtroGasto : '');

    const rows = await db.allAsync(`
      SELECT
        f.compra_id                                                        AS id,
        f.fact_num, f.tipo_doc, f.fecha_emision,
        p.codigo_proveedor, p.nombre AS proveedor, p.rif,
        s.codigo_sucursal, s.nombre AS sucursal,
        a.codigo_articulo, a.descripcion AS articulo, a.categoria, a.linea, a.sublinea,
        a.es_gasto_operativo,
        f.unidades, f.unidades_dev,
        f.total_sin_iva, f.total_sin_iva_dev,
        f.total_con_iva, f.total_con_iva_dev,
        f.iva, f.saldo,
        f.costo_promedio_facturado, f.costo_ultimo_facturado
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
        ventana: { desde, hasta, incluye_gastos_operativos: incluirGastos },
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
          categoria: r.categoria,
          linea: r.linea,
          sublinea: r.sublinea,
          es_gasto_operativo: r.es_gasto_operativo,
          unidades: parseFloat(r.unidades) || 0,
          unidades_dev: parseFloat(r.unidades_dev) || 0,
          total_sin_iva: parseFloat(r.total_sin_iva) || 0,
          total_con_iva: parseFloat(r.total_con_iva) || 0,
          iva: parseFloat(r.iva) || 0,
          saldo: parseFloat(r.saldo) || 0,
          costo_promedio_facturado: parseFloat(r.costo_promedio_facturado) || 0,
          costo_ultimo_facturado: parseFloat(r.costo_ultimo_facturado) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
