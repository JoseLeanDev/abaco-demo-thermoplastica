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
