const express = require('express');
const router = express.Router();

// NUEVO: Importar abaco Core v2.0
const CFOAICore = require('../agents');
const { parsePeriodo } = require('../services/periodo');
const M = require('../services/margen');

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

// Cache simple en memoria para insights (TTL: 5 minutos)
const insightsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Insights en vivo sobre los datos reales de Thermoplastica (esquema thermoplastica.*).
// Ventanas móviles cortas a propósito: son alertas de lo que está pasando ahora,
// no dependen del filtro de fechas. Cada regla corre aparte para que una consulta
// rota no apague las demás. Los montos de impacto salen de los datos, no de supuestos.
const fmtQ = (n) => `Q${Math.round(n).toLocaleString('es-GT')}`;

async function regla(nombre, fn) {
  try { await fn(); } catch (error) { console.error(`[insights:${nombre}] Error:`, error.message); }
}

async function generateInsightsFromDB(db) {
  const insights = [];

  // 1. Concentración de clientes (ventas últimos 90 días)
  await regla('concentracion', async () => {
    const top = await db.getAsync(`
      WITH v AS (
        SELECT cliente_id, SUM(total_sin_iva) AS ventas
        FROM thermoplastica.fact_ventas_linea
        WHERE tipo_doc = 'FACT' AND fecha_emision >= CURRENT_DATE - 90
        GROUP BY cliente_id
      )
      SELECT c.nombre, v.ventas, v.ventas / NULLIF((SELECT SUM(ventas) FROM v), 0) * 100 AS pct
      FROM v JOIN thermoplastica.dim_cliente c ON c.cliente_id = v.cliente_id
      ORDER BY v.ventas DESC LIMIT 1
    `);
    const pct = parseFloat(top?.pct) || 0;
    if (pct > 20) {
      insights.push({
        tipo: 'cliente_en_riesgo',
        severidad: pct > 30 ? 'alta' : 'media',
        titulo: `${pct.toFixed(1)}% de las ventas dependen de ${top.nombre}`,
        descripcion: `En los últimos 90 días este cliente compró ${fmtQ(parseFloat(top.ventas))}. Perderlo golpearía directo el flujo de caja; conviene diversificar.`,
        monto_impacto: parseFloat(top.ventas),
        accion_sugerida: 'Revisar concentración en Ventas',
        categoria: 'analisis',
      });
    }
  });

  // 2. Cartera vencida y atraso promedio (snapshot CxC más reciente, ponderado por saldo)
  await regla('cobranza', async () => {
    const r = await db.getAsync(`
      SELECT SUM(saldo_total) AS total,
             SUM(saldo_total) FILTER (WHERE CURRENT_DATE - fecha_vencimiento > 30) AS vencido_30,
             SUM(GREATEST(CURRENT_DATE - fecha_vencimiento, 0) * saldo_total) / NULLIF(SUM(saldo_total), 0) AS dias_atraso
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)
        AND saldo_total > 0
    `);
    const total = parseFloat(r?.total) || 0;
    const vencido = parseFloat(r?.vencido_30) || 0;
    const dias = Math.round(parseFloat(r?.dias_atraso) || 0);
    if (total > 0 && vencido / total > 0.10) {
      insights.push({
        tipo: 'cxc_vencidas',
        severidad: vencido / total > 0.25 ? 'alta' : 'media',
        titulo: `${fmtQ(vencido)} de cartera con más de 30 días de atraso`,
        descripcion: `Es el ${(vencido / total * 100).toFixed(1)}% de la cartera (${fmtQ(total)}). Atraso promedio ponderado por saldo: ${dias} días.`,
        monto_impacto: vencido,
        accion_sugerida: 'Ver Cuentas por Cobrar',
        categoria: 'tesoreria',
      });
    }
  });

  // 3. Margen bruto: mes en curso vs mes anterior
  await regla('margen', async () => {
    const meses = await db.allAsync(`
      SELECT DATE_TRUNC('month', fecha_emision) AS mes,
             SUM(total_sin_iva) AS ventas,
             ${M.pct()} AS margen_pct
      FROM thermoplastica.fact_ventas_linea
      WHERE tipo_doc = 'FACT' AND fecha_emision >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
      GROUP BY 1 ORDER BY 1 DESC
    `);
    if (meses.length < 2) return;
    const actual = parseFloat(meses[0].margen_pct), anterior = parseFloat(meses[1].margen_pct);
    const delta = actual - anterior;
    if (delta < -3) {
      insights.push({
        tipo: 'margen_decreciente',
        severidad: delta < -6 ? 'alta' : 'media',
        titulo: `Margen bruto bajó ${Math.abs(delta).toFixed(1)} pp este mes`,
        descripcion: `Pasó de ${anterior.toFixed(1)}% a ${actual.toFixed(1)}%. Sobre las ventas del mes (${fmtQ(parseFloat(meses[0].ventas))}) son ${fmtQ(Math.abs(delta) / 100 * parseFloat(meses[0].ventas))} menos de margen.`,
        monto_impacto: Math.abs(delta) / 100 * parseFloat(meses[0].ventas),
        accion_sugerida: 'Revisar Márgenes',
        categoria: 'contabilidad',
      });
    }
  });

  // 4. Venta cruzada: clientes grandes que compran una sola línea (6 meses)
  await regla('venta_cruzada', async () => {
    const r = await db.getAsync(`
      SELECT c.nombre, MIN(a.linea) AS linea, SUM(f.total_sin_iva) AS ventas
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      JOIN thermoplastica.dim_cliente  c ON c.cliente_id  = f.cliente_id
      WHERE f.tipo_doc = 'FACT' AND f.fecha_emision >= CURRENT_DATE - INTERVAL '6 months'
        AND a.linea IS NOT NULL
      GROUP BY c.nombre
      HAVING COUNT(DISTINCT a.linea) = 1 AND SUM(f.total_sin_iva) >= 100000
      ORDER BY ventas DESC LIMIT 1
    `);
    if (r) {
      insights.push({
        tipo: 'oportunidad',
        severidad: 'info',
        titulo: `${r.nombre} solo compra la línea ${r.linea}`,
        descripcion: `Compró ${fmtQ(parseFloat(r.ventas))} en 6 meses, todo de una sola línea. Candidato para ofrecer otras líneas.`,
        monto_impacto: parseFloat(r.ventas),
        accion_sugerida: 'Ver cliente en Ventas',
        categoria: 'analisis',
      });
    }
  });

  // 5. Plazos de proveedores: crédito pactado promedio vs 30 días
  await regla('plazos_proveedores', async () => {
    const r = await db.getAsync(`
      SELECT
        (SELECT SUM(dias_credito_ficha * saldo) / NULLIF(SUM(saldo), 0)
           FROM thermoplastica.fact_cxp_factura WHERE saldo > 0 AND dias_credito_ficha > 0) AS dias,
        (SELECT SUM(total_sin_iva) / 90.0 FROM thermoplastica.fact_compras_linea
          WHERE tipo_doc = 'FACT' AND fecha_emision >= CURRENT_DATE - 90) AS compra_diaria
    `);
    const dias = parseFloat(r?.dias), diaria = parseFloat(r?.compra_diaria) || 0;
    if (dias && dias < 25 && diaria > 0) {
      const libera = (30 - dias) * diaria;
      insights.push({
        tipo: 'oportunidad',
        severidad: 'info',
        titulo: `Crédito de proveedores: ${Math.round(dias)} días promedio`,
        descripcion: `Llevar el plazo a 30 días, al ritmo de compra actual (${fmtQ(diaria)}/día), liberaría unos ${fmtQ(libera)} de caja.`,
        monto_impacto: libera,
        accion_sugerida: 'Renegociar plazos con los principales proveedores',
        categoria: 'tesoreria',
      });
    }
  });

  // 6. Tendencia de ventas: último mes completo vs el anterior
  await regla('tendencia_ventas', async () => {
    const meses = await db.allAsync(`
      SELECT DATE_TRUNC('month', fecha_emision) AS mes, SUM(total_sin_iva) AS total
      FROM thermoplastica.fact_ventas_linea
      WHERE tipo_doc = 'FACT'
        AND fecha_emision >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
        AND fecha_emision <  DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY 1 ORDER BY 1 DESC
    `);
    if (meses.length < 2) return;
    const actual = parseFloat(meses[0].total), anterior = parseFloat(meses[1].total);
    if (!anterior) return;
    const variacion = (actual - anterior) / anterior * 100;
    if (variacion < -10) {
      insights.push({
        tipo: 'caida_ingresos_brusca',
        severidad: variacion < -20 ? 'alta' : 'media',
        titulo: `Ventas cayeron ${Math.abs(variacion).toFixed(0)}% el mes pasado`,
        descripcion: `Pasaron de ${fmtQ(anterior)} a ${fmtQ(actual)}. Revisar si es estacionalidad o pérdida de clientes.`,
        monto_impacto: anterior - actual,
        accion_sugerida: 'Ver Ventas',
        categoria: 'analisis',
      });
    } else if (variacion > 20) {
      insights.push({
        tipo: 'aumento_ingresos_brusco',
        severidad: 'info',
        titulo: `Ventas crecieron ${variacion.toFixed(0)}% el mes pasado`,
        descripcion: `Pasaron de ${fmtQ(anterior)} a ${fmtQ(actual)}. Verificar inventario y capacidad para sostenerlo.`,
        monto_impacto: actual - anterior,
        accion_sugerida: 'Ver Inventario',
        categoria: 'analisis',
      });
    }
  });

  // 7. Líneas con margen bajo y volumen material (90 días)
  await regla('lineas_margen_bajo', async () => {
    const r = await db.getAsync(`
      SELECT a.linea, SUM(f.total_sin_iva) AS ventas,
             ${M.pct('f')} AS margen
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.tipo_doc = 'FACT' AND f.fecha_emision >= CURRENT_DATE - 90 AND a.linea IS NOT NULL
      GROUP BY a.linea
      HAVING SUM(f.total_sin_iva) > 100000
         AND ${M.pct('f')} < 20
      ORDER BY ventas DESC LIMIT 1
    `);
    if (r) {
      insights.push({
        tipo: 'margen_decreciente',
        severidad: 'media',
        titulo: `Línea ${r.linea}: margen de ${parseFloat(r.margen).toFixed(0)}%`,
        descripcion: `Vendió ${fmtQ(parseFloat(r.ventas))} en 90 días con margen bajo. Cada punto de precio son ${fmtQ(parseFloat(r.ventas) / 100)}.`,
        monto_impacto: parseFloat(r.ventas) * 0.05,
        accion_sugerida: 'Revisar precios en Márgenes',
        categoria: 'contabilidad',
      });
    }
  });

  return { insights };
}

// Anomalías: clientes cuya compra de los últimos 30 días cayó a menos de la mitad
// de los 30 días previos (solo clientes con compra previa material).
async function detectAnomaliesFromDB(db) {
  const anomalias = [];
  await regla('caida_clientes', async () => {
    const filas = await db.allAsync(`
      SELECT c.nombre,
             COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision >= CURRENT_DATE - 30), 0) AS actual,
             COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision <  CURRENT_DATE - 30), 0) AS anterior
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE f.tipo_doc = 'FACT' AND f.fecha_emision >= CURRENT_DATE - 60
      GROUP BY c.nombre
      HAVING COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision < CURRENT_DATE - 30), 0) >= 50000
         AND COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision >= CURRENT_DATE - 30), 0)
           < 0.5 * SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision < CURRENT_DATE - 30)
      ORDER BY anterior DESC LIMIT 5
    `);
    for (const c of filas) {
      const actual = parseFloat(c.actual), anterior = parseFloat(c.anterior);
      const variacion = (actual - anterior) / anterior * 100;
      anomalias.push({
        tipo: 'cliente_en_riesgo',
        categoria: 'analisis',
        severidad: 'alta',
        titulo: `${c.nombre}: compras cayeron ${Math.abs(variacion).toFixed(0)}% en 30 días`,
        descripcion: `Compró ${fmtQ(actual)} en los últimos 30 días contra ${fmtQ(anterior)} en los 30 previos.`,
        datos: { monto_actual: actual, monto_anterior: anterior },
        accion_recomendada: 'Contactar al cliente para evaluar la relación comercial',
      });
    }
  });
  return { anomalias, alertas: [] };
}

/**
 * GET /api/analisis/insights
 * Genera insights automáticos de análisis financiero usando el Analista Financiero
 * Cachea resultados por 1 hora
 */
router.get('/insights', async (req, res) => {
  try {
    const db = req.app.get('db');
    const empresaId = req.query.empresa_id || 1;
    const context = req.query.context || 'all';
    const skipCache = req.query.skip_cache === 'true';
    const umbral = parseFloat(req.query.umbral) || 20;

    // Verificar cache
    const cacheKey = `insights_${empresaId}_${context}`;
    const cached = insightsCache.get(cacheKey);
    
    if (!skipCache && cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return res.json({
        ...cached.data,
        source: 'cache',
        cached_at: new Date(cached.timestamp).toISOString(),
        expires_at: new Date(cached.timestamp + CACHE_TTL_MS).toISOString()
      });
    }

    // Instanciar agentes (o usar wrappers si no tienen los métodos esperados)
    // Nota: Agentes v1.0 eliminados. Usando abaco Core v2.0
    // Datos se obtienen directamente de DB o vía CFOAICore
    const analista = CFOAICore;
    const predictor = CFOAICore;

    // Ejecutar análisis en paralelo (con wrappers para compatibilidad)
    let insightsResult, anomaliesResult;
    
    try {
      // Intentar usar métodos nativos primero
      if (typeof analista.generateInsights === 'function') {
        insightsResult = await analista.generateInsights(db, empresaId);
      } else {
        // Fallback: generar insights desde DB
        insightsResult = await generateInsightsFromDB(db, empresaId);
      }
    } catch (e) {
      console.warn('[Insights] Error en analista:', e.message);
      insightsResult = await generateInsightsFromDB(db, empresaId);
    }
    
    try {
      if (typeof predictor.detectAnomalies === 'function') {
        anomaliesResult = await predictor.detectAnomalies(db, empresaId, umbral);
      } else {
        // Fallback: detectar anomalías desde DB
        anomaliesResult = await detectAnomaliesFromDB(db, empresaId, umbral);
      }
    } catch (e) {
      console.warn('[Insights] Error en predictor:', e.message);
      anomaliesResult = await detectAnomaliesFromDB(db, empresaId, umbral);
    }

    // Combinar insights financieros con anomalías de cash flow
    // Mapear tipos del backend a tipos del frontend
    const mapTipoInsight = (tipoBackend) => {
      const tipoMap = {
        'gasto_anormal': 'gasto',
        'gasto_reducido': 'gasto',
        'gasto_inusual_alto': 'gasto',
        'cliente_en_riesgo': 'alerta',
        'cliente_crecimiento': 'ingreso',
        'tendencia_negativa_cliente': 'alerta',
        'transaccion_anomala': 'alerta',
        'caida_ingresos_brusca': 'alerta',
        'aumento_ingresos_brusco': 'ingreso',
        'tendencia_ingresos_decreciente': 'alerta',
        'deterioro_flujo_caja': 'alerta',
        'proyeccion_variacion': 'oportunidad',
        'margen_decreciente': 'alerta',
        'cxp_vencidas': 'alerta',
        'cxc_vencidas': 'alerta',
        'variacion_umbral': 'alerta',
        'transaccion_fin_semana': 'alerta'
      };
      return tipoMap[tipoBackend] || 'oportunidad';
    };

    // Mapear cada tipo de insight a su contexto de negocio
    const mapContextoInsight = (tipoBackend, category) => {
      const contexts = [];
      
      // Tesorería: flujo de caja, pagos, cobros
      if (['cxp_vencidas', 'cxc_vencidas', 'deterioro_flujo_caja', 'transaccion_fin_semana'].includes(tipoBackend)) {
        contexts.push('tesoreria');
      }
      
      // Contabilidad: gastos, márgenes, transacciones, auditoría
      if (['margen_decreciente', 'gasto_anormal', 'gasto_reducido', 'gasto_inusual_alto', 'variacion_umbral', 'transaccion_anomala'].includes(tipoBackend)) {
        contexts.push('contabilidad');
      }
      
      // Análisis: clientes, proyecciones, tendencias, comparativas
      if (['cliente_en_riesgo', 'cliente_crecimiento', 'tendencia_negativa_cliente', 'proyeccion_variacion', 'caida_ingresos_brusca', 'aumento_ingresos_brusco', 'tendencia_ingresos_decreciente'].includes(tipoBackend)) {
        contexts.push('analisis');
      }
      
      return contexts.length > 0 ? contexts : ['general'];
    };

    const combinedInsights = [
      ...insightsResult.insights.map(i => ({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: mapTipoInsight(i.tipo || i.type),
        severity: i.severidad === 'alta' ? 'critical' : i.severidad === 'media' ? 'warning' : 'info',
        title: i.titulo || i.title || 'Insight',
        description: i.descripcion || i.description || '',
        impact: i.monto_impacto || i.impact || 0,
        currency: i.currency || 'GTQ',
        category: i.categoria || i.category || 'general',
        contexts: mapContextoInsight(i.tipo || i.type, i.categoria || i.category),
        action: i.accion_sugerida || i.action,
        actionLabel: i.actionLabel || 'Ver detalle',
        change: i.cambio || i.change || 0,
        isNew: true
      })),
      ...anomaliesResult.anomalias.map((a, idx) => ({
        id: `anomalia_${Date.now()}_${idx}`,
        type: mapTipoInsight(a.tipo || a.categoria),
        severity: a.severidad === 'critica' ? 'critical' : a.severidad === 'alta' ? 'warning' : 'info',
        title: a.titulo,
        description: a.descripcion,
        impact: a.datos?.monto_actual || a.datos?.monto_total || 0,
        currency: 'GTQ',
        category: a.categoria,
        contexts: mapContextoInsight(a.tipo || a.categoria, a.categoria),
        action: a.accion_recomendada,
        actionLabel: 'Revisar',
        isNew: true
      })),
      ...anomaliesResult.alertas.map((a, idx) => ({
        id: `alerta_${Date.now()}_${idx}`,
        type: mapTipoInsight(a.tipo || a.categoria),
        severity: a.severidad === 'critica' ? 'critical' : a.severidad === 'alta' ? 'warning' : 'info',
        title: a.titulo,
        description: a.descripcion,
        impact: a.datos?.monto_actual || a.datos?.monto_total || a.datos?.flujo_actual || 0,
        currency: 'GTQ',
        category: a.categoria,
        contexts: mapContextoInsight(a.tipo || a.categoria, a.categoria),
        action: a.accion_recomendada,
        actionLabel: 'Revisar',
        isNew: true
      }))
    ];

    // Ordenar por severidad
    const severidadOrder = { critical: 0, warning: 1, info: 2 };
    combinedInsights.sort((a, b) => severidadOrder[a.severity] - severidadOrder[b.severity]);

    // Filtrar por contexto si se solicita
    const filteredInsights = context === 'all' || context === 'dashboard'
      ? combinedInsights
      : combinedInsights.filter(i => i.contexts.includes(context) || i.contexts.includes('general'));

    // Calcular métricas resumen
    const metricas = {
      total_insights: filteredInsights.length,
      por_severidad: {
        critical: filteredInsights.filter(i => i.severity === 'critical').length,
        warning: filteredInsights.filter(i => i.severity === 'warning').length,
        info: filteredInsights.filter(i => i.severity === 'info').length
      },
      por_tipo: filteredInsights.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      }, {}),
      impacto_total_estimado: filteredInsights.reduce((sum, i) => sum + (i.impact || 0), 0)
    };

    const responseData = {
      status: 'success',
      timestamp: new Date().toISOString(),
      source: 'real-time',
      empresa_id: empresaId,
      context: context,
      periodo_analisis: {
        desde: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        hasta: new Date().toISOString().split('T')[0]
      },
      metricas_resumen: metricas,
      insights: filteredInsights,
      acciones_prioritarias: filteredInsights
        .filter(i => i.severity === 'critical' || i.severity === 'warning')
        .slice(0, 5)
        .map(i => i.action),
      _meta: {
        agentes_utilizados: ['Análisis', 'Caja'],
        cache_ttl_minutos: 5,
        parametros: { umbral, context }
      }
    };

    // Guardar en cache
    insightsCache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData
    });

    // Guardar insights en histórico (async, no bloquea response)
    const saveToHistory = async () => {
      try {
        const db = req.app.get('db');
        for (const insight of combinedInsights) {
          await db.runAsync(`
            INSERT INTO insights_historico 
            (insight_id, empresa_id, type, severity, title, description, impact, currency, 
             category, action, action_label, change_percent, periodo_desde, periodo_hasta,
             agent_source, agent_version)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (insight_id) DO UPDATE SET
              type = EXCLUDED.type,
              severity = EXCLUDED.severity,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              impact = EXCLUDED.impact,
              updated_at = CURRENT_TIMESTAMP
          `, [
            insight.id, empresaId, insight.type, insight.severity, insight.title,
            insight.description, insight.impact || 0, insight.currency || 'GTQ',
            insight.category, insight.action, insight.actionLabel, insight.change || 0,
            responseData.periodo_analisis.desde, responseData.periodo_analisis.hasta,
            'abaco Core', '1.0'
          ]);
        }
      } catch (err) {
        console.error('[Insights] Error guardando en histórico:', err.message);
      }
    };
    saveToHistory();

    // Limpiar cache antiguo periódicamente (simple cleanup)
    if (insightsCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of insightsCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
          insightsCache.delete(key);
        }
      }
    }

    res.json(responseData);

  } catch (error) {
    console.error('[GET /api/analisis/insights] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar insights financieros',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/analisis/insights/cache - Limpiar cache (para admin)
router.delete('/insights/cache', async (req, res) => {
  try {
    const empresaId = req.query.empresa_id;
    
    if (empresaId) {
      insightsCache.delete(`insights_${empresaId}`);
      res.json({
        status: 'success',
        message: `Cache limpiado para empresa ${empresaId}`,
        timestamp: new Date().toISOString()
      });
    } else {
      insightsCache.clear();
      res.json({
        status: 'success',
        message: 'Cache de insights completamente limpiado',
        entries_cleared: insightsCache.size,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/analisis/insights/historico - Obtener histórico de insights
router.get('/insights/historico', async (req, res) => {
  try {
    const db = req.app.get('db');
    const empresaId = req.query.empresa_id || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || 'active';
    const type = req.query.type;
    const severity = req.query.severity;
    const days = parseInt(req.query.days) || 30;
    // Con ?desde/&hasta (filtro global de fechas) manda la ventana; si no, los últimos N días.
    const rangoCreacion = (req.query.desde || req.query.hasta)
      ? (({ D, H }) => `created_at >= ${D} AND created_at < ${H} + 1`)(parsePeriodo(req))
      : `created_at >= CURRENT_DATE - INTERVAL '${days} days'`;
    
    // Detectar PostgreSQL
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');
    
    let query = `
      SELECT 
        insight_id as id,
        type,
        severity,
        title,
        description,
        impact,
        currency,
        category,
        action,
        action_label,
        change_percent as change,
        status,
        created_at,
        periodo_desde,
        periodo_hasta,
        agent_source
      FROM insights_historico
      WHERE empresa_id = ? 
        AND status = ?
        AND ${rangoCreacion}
    `;
    
    const params = [empresaId, status];
    
    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }
    
    if (severity) {
      query += ` AND severity = ?`;
      params.push(severity);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const insights = await db.allAsync(query, params);
    
    // Mapear snake_case a camelCase
    const insightsMapped = insights.map(i => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      title: i.title,
      description: i.description,
      impact: i.impact,
      currency: i.currency,
      category: i.category,
      action: i.action,
      actionLabel: i.action_label,
      change: i.change,
      status: i.status,
      createdAt: i.created_at,
      periodoDesde: i.periodo_desde,
      periodoHasta: i.periodo_hasta,
      agentSource: i.agent_source,
      isNew: false
    }));
    
    // Obtener conteos
    const counts = await db.getAsync(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info
      FROM insights_historico
      WHERE empresa_id = ? AND status = 'active'
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `, [empresaId]);
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        insights: insightsMapped,
        pagination: {
          total: counts?.total || 0,
          limit,
          offset,
          hasMore: (offset + insights.length) < (counts?.total || 0)
        },
        summary: {
          total: counts?.total || 0,
          critical: counts?.critical || 0,
          warning: counts?.warning || 0,
          info: counts?.info || 0
        }
      }
    });
  } catch (error) {
    console.error('[GET /insights/historico] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener histórico de insights',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PATCH /api/analisis/insights/:id/dismiss - Marcar insight como visto
router.patch('/insights/:id/dismiss', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const userId = req.body.user_id || 1;
    
    await db.runAsync(`
      UPDATE insights_historico 
      SET status = 'dismissed', 
          dismissed_at = CURRENT_TIMESTAMP,
          dismissed_by = ?
      WHERE insight_id = ?
    `, [userId, id]);
    
    res.json({
      status: 'success',
      message: 'Insight marcado como visto',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[PATCH /insights/dismiss] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar insight',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===========================================================================
// Salud financiera — métricas cruzadas sobre datos reales del ERP.
// Las métricas fijas salen de las vistas de analitica (migración 015); las
// proyecciones, de services/proyecciones.
// ===========================================================================
const proyecciones = require('../services/proyecciones');

const num = (v) => (v === null || v === undefined ? null : Number(v));
const numerosFila = (fila) => Object.fromEntries(
  Object.entries(fila || {}).map(([k, v]) => [k, typeof v === 'string' && v !== '' && !isNaN(v) ? Number(v) : v])
);

// Ciclo de caja del período: services/cicloCaja.js (lo comparte el Panel).
const { cicloPeriodo } = require('../services/cicloCaja');

// Días reales de cobro y pago por mes, solo los meses del período.
// Misma lógica que analitica.v_ciclo_caja_mensual.
function cicloMensualPeriodo(db, P) {
  return db.allAsync(`
    WITH cobros AS (
      SELECT to_char(fecha_ultimo_cobro, 'YYYY-MM') AS anio_mes,
             sum((fecha_ultimo_cobro - fecha_emision) * valor) / nullif(sum(valor), 0) AS dias,
             sum(valor) AS monto
      FROM thermoplastica.fact_cxc_factura
      WHERE saldo <= 0 AND fecha_ultimo_cobro >= fecha_emision
        AND fecha_ultimo_cobro BETWEEN ${P.D} AND ${P.H}
      GROUP BY 1
    ),
    pagos AS (
      SELECT to_char(fecha_ultimo_pago, 'YYYY-MM') AS anio_mes,
             sum((fecha_ultimo_pago - fecha_emision) * valor) / nullif(sum(valor), 0) AS dias,
             sum(valor) AS monto
      FROM thermoplastica.fact_cxp_factura
      WHERE saldo <= 0 AND fecha_ultimo_pago >= fecha_emision
        AND fecha_ultimo_pago BETWEEN ${P.D} AND ${P.H}
      GROUP BY 1
    )
    SELECT coalesce(c.anio_mes, p.anio_mes) AS anio_mes,
           round(c.dias, 1) AS dias_cobro_real, round(c.monto) AS monto_cobrado,
           round(p.dias, 1) AS dias_pago_real,  round(p.monto) AS monto_pagado,
           round(c.dias - p.dias, 1) AS brecha_dias
    FROM cobros c FULL JOIN pagos p ON p.anio_mes = c.anio_mes
    ORDER BY 1
  `);
}

// Capital de trabajo con ventas del período vs período de comparación.
// Las ventas se anualizan (× 365 / días) para que los % sean comparables
// sin importar el largo de la ventana.
async function capitalTrabajoPeriodo(db, P, ciclo) {
  const v = await db.getAsync(`
    SELECT coalesce(sum(total_sin_iva) FILTER (WHERE fecha_emision BETWEEN ${P.D} AND ${P.H}), 0)         AS actual,
           coalesce(sum(total_sin_iva) FILTER (WHERE fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}), 0) AS previo
    FROM thermoplastica.fact_ventas_linea
    WHERE tipo_doc = 'FACT'
  `);
  const anual = (x) => Number(x) * 365 / P.dias;
  const ventas = Number(v.actual), previo = Number(v.previo);
  const ventasAnual = anual(ventas), previoAnual = anual(previo);
  const capital = Number(ciclo.cxc_operativa) + Number(ciclo.inventario) - Number(ciclo.cxp_operativa);
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    fecha_corte: ciclo.fecha_corte,
    cxc_operativa: Number(ciclo.cxc_operativa),
    inventario: Number(ciclo.inventario),
    cxp_operativa: Number(ciclo.cxp_operativa),
    capital_trabajo: capital,
    ventas_periodo: Math.round(ventas),
    ventas_periodo_previo: Math.round(previo),
    crecimiento_pct: previo > 0 ? r1((ventas / previo - 1) * 100) : null,
    capital_trabajo_pct_ventas: ventasAnual > 0 ? r1(capital / ventasAnual * 100) : null,
    caja_requerida_crecimiento: ventasAnual > 0 ? Math.round(capital / ventasAnual * Math.max(ventasAnual - previoAnual, 0)) : null,
    ciclo_caja: Number(ciclo.ciclo_caja),
    caja_por_dia_de_ciclo: Math.round(Number(ciclo.valor_dia_cobro) + Number(ciclo.valor_dia_inventario)),
  };
}

// GET /api/analisis/salud?desde=&hasta=  Ciclo de caja, tendencia, capital inmovilizado y capital de trabajo
router.get('/salud', async (req, res) => {
  try {
    const db = req.app.get('db');
    const P = parsePeriodo(req);
    const [ciclo, mensual, porClase, porLinea, topInmovilizado] = await Promise.all([
      cicloPeriodo(db, P),
      cicloMensualPeriodo(db, P),
      db.allAsync(`
        SELECT clase, estado, count(*)::int AS articulos, round(sum(valor_inventario)) AS valor
        FROM analitica.v_inventario_salud
        GROUP BY clase, estado
      `),
      db.allAsync(`
        SELECT coalesce(linea, 'Sin línea') AS linea,
               round(sum(valor_inventario) FILTER (WHERE estado = 'inmovilizado')) AS inmovilizado,
               round(sum(valor_inventario) FILTER (WHERE estado = 'lento'))        AS lento,
               round(sum(valor_inventario))                                         AS total
        FROM analitica.v_inventario_salud
        GROUP BY 1
        HAVING sum(valor_inventario) FILTER (WHERE estado IN ('inmovilizado', 'lento')) > 0
        ORDER BY coalesce(sum(valor_inventario) FILTER (WHERE estado IN ('inmovilizado', 'lento')), 0) DESC
        LIMIT 10
      `),
      db.allAsync(`
        SELECT codigo_articulo, articulo, linea, clase, round(valor_inventario) AS valor,
               ultima_venta, ultima_compra, dias_sin_venta, dias_sin_compra
        FROM analitica.v_inventario_salud
        WHERE estado = 'inmovilizado'
        ORDER BY valor_inventario DESC
        LIMIT 15
      `),
    ]);
    const capital = await capitalTrabajoPeriodo(db, P, ciclo);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        ciclo: numerosFila(ciclo),
        ciclo_mensual: mensual.map(numerosFila),
        capital_trabajo: capital,
        inventario: {
          por_clase_estado: porClase.map(r => ({ ...r, valor: num(r.valor) })),
          por_linea: porLinea.map(numerosFila),
          top_inmovilizado: topInmovilizado.map(numerosFila),
        },
      },
    });
  } catch (error) {
    console.error('[GET /analisis/salud] Error:', error);
    res.status(500).json({ status: 'error', message: 'Error al calcular la salud financiera' });
  }
});

// ---------------------------------------------------------------------------
// Capital inmovilizado por categoría
// ---------------------------------------------------------------------------
// Misma jerarquía de producto que Ventas: categoría (marca) › subcategoría (línea)
// › sublínea › artículo. Es la foto del stock al corte (v_inventario_salud), no
// depende del período.
//
// La vista es cara (agrega toda la historia de ventas y compras) y son ~1,200
// artículos con stock, así que se lee una sola vez, se guarda 5 minutos en
// memoria y los filtros/agrupaciones se hacen aquí.
let cacheInv = { t: 0, filas: null, corte: null };
async function inventarioSalud(db) {
  if (cacheInv.filas && Date.now() - cacheInv.t < 5 * 60 * 1000) return cacheInv;
  const limpio = (e, vacio) => `COALESCE(NULLIF(TRIM(${e}), ''), '${vacio}')`;
  const [filas, corte] = await Promise.all([
    db.allAsync(`
      SELECT s.articulo_id, s.codigo_articulo, s.articulo, s.clase, s.estado, s.stock_actual,
             s.valor_inventario, s.dias_cobertura, s.ultima_venta, s.ultima_compra,
             s.dias_sin_venta, s.dias_sin_compra,
             ${limpio('a.marca', 'Sin categoría')}       AS categoria,
             ${limpio('a.linea', 'Sin subcategoría')}    AS subcategoria,
             ${limpio('a.sublinea', 'Sin sublínea')}     AS sublinea
      FROM analitica.v_inventario_salud s
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = s.articulo_id
      WHERE s.valor_inventario > 0
    `),
    db.getAsync(`SELECT MAX(fecha_snapshot) AS f FROM thermoplastica.fact_inventario_snapshot`),
  ]);
  const num = (x) => (x === null || x === undefined ? null : Number(x));
  cacheInv = {
    t: Date.now(),
    corte: corte?.f,
    filas: filas.map(r => {
      const dias = r.clase === 'producto' ? num(r.dias_sin_venta) : r.clase === 'materia_prima' ? num(r.dias_sin_compra) : null;
      return {
        ...r,
        valor: Number(r.valor_inventario) || 0,
        stock_actual: num(r.stock_actual),
        dias_cobertura: num(r.dias_cobertura),
        dias_sin_venta: num(r.dias_sin_venta),
        dias_sin_compra: num(r.dias_sin_compra),
        // Días desde el último movimiento relevante: venta (producto) o compra (materia prima)
        dias_sin_mov: dias,
      };
    }),
  };
  return cacheInv;
}

function resumirInv(filas) {
  const suma = (f) => filas.reduce((s, r) => s + (f(r) ? r.valor : 0), 0);
  const total = suma(() => true);
  const lento = suma(r => r.estado === 'lento');
  const inmovilizado = suma(r => r.estado === 'inmovilizado');
  // Cobertura del grupo = valor / consumo diario (consumo implícito = valor / días de cobertura)
  const consumo = filas.reduce((s, r) => s + (r.dias_cobertura > 0 ? r.valor / r.dias_cobertura : 0), 0);
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    articulos: filas.length,
    articulos_quietos: filas.filter(r => r.estado !== 'activo').length,
    total: Math.round(total),
    activo: Math.round(total - lento - inmovilizado),
    lento: Math.round(lento),
    inmovilizado: Math.round(inmovilizado),
    quieto: Math.round(lento + inmovilizado),
    pct_quieto: total > 0 ? r1((lento + inmovilizado) / total * 100) : 0,
    pct_inmovilizado: total > 0 ? r1(inmovilizado / total * 100) : 0,
    dias_cobertura: consumo > 0 ? Math.round(total / consumo) : null,
  };
}

const TRAMOS_INV = [
  { id: '0_90', hasta: 90 }, { id: '91_180', hasta: 180 }, { id: '181_365', hasta: 365 },
  { id: '366_730', hasta: 730 }, { id: 'mas_730', hasta: Infinity },
];

// Texto comparable: minúsculas y sin tildes
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// GET /api/analisis/inventario-quieto?dim=categoria&categoria=&subcategoria=&sublinea=&estado=&q=
//   q: búsqueda por código o nombre de artículo; todas las palabras deben aparecer
router.get('/inventario-quieto', async (req, res) => {
  try {
    const db = req.app.get('db');
    const dim = ['categoria', 'subcategoria', 'sublinea', 'articulo'].includes(req.query.dim) ? req.query.dim : 'categoria';
    const { filas: todas, corte } = await inventarioSalud(db);

    let filas = todas;
    for (const k of ['categoria', 'subcategoria', 'sublinea']) {
      if (req.query[k]) filas = filas.filter(r => r[k] === req.query[k]);
    }
    const palabras = normalizar(req.query.q).split(/\s+/).filter(Boolean);
    if (palabras.length) {
      filas = filas.filter(r => {
        const texto = normalizar(`${r.codigo_articulo} ${r.articulo}`);
        return palabras.every(p => texto.includes(p));
      });
    }
    const totales = resumirInv(filas);

    // Agrupación por el nivel pedido
    const grupos = new Map();
    for (const r of filas) {
      const clave = dim === 'articulo' ? r.codigo_articulo : r[dim];
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(r);
    }
    const items = [...grupos.entries()].map(([clave, rs]) => {
      const g = resumirInv(rs);
      const a = rs[0];
      return {
        clave,
        nombre: dim === 'articulo' ? a.articulo : clave,
        ...g,
        participacion_quieto: totales.quieto > 0 ? Math.round(g.quieto / totales.quieto * 1000) / 10 : 0,
        ...(dim === 'articulo' ? {
          clase: a.clase, estado: a.estado, dias_sin_mov: a.dias_sin_mov, stock_actual: a.stock_actual,
          ultima_venta: a.ultima_venta, ultima_compra: a.ultima_compra,
        } : {}),
      };
    }).sort((x, y) => y.quieto - x.quieto || y.total - x.total);

    const antiguedad = [
      ...TRAMOS_INV.map((t, i) => {
        const desde = i === 0 ? -Infinity : TRAMOS_INV[i - 1].hasta;
        const rs = filas.filter(r => r.dias_sin_mov !== null && r.dias_sin_mov > desde && r.dias_sin_mov <= t.hasta);
        return { tramo: t.id, articulos: rs.length, valor: Math.round(rs.reduce((s, r) => s + r.valor, 0)) };
      }),
      (() => {
        const rs = filas.filter(r => r.dias_sin_mov === null);
        return { tramo: 'sin_registro', articulos: rs.length, valor: Math.round(rs.reduce((s, r) => s + r.valor, 0)) };
      })(),
    ];

    const porClase = [];
    for (const clase of ['materia_prima', 'producto', 'sin_movimiento']) {
      for (const estado of ['activo', 'lento', 'inmovilizado']) {
        const rs = filas.filter(r => r.clase === clase && r.estado === estado);
        if (rs.length) porClase.push({ clase, estado, articulos: rs.length, valor: Math.round(rs.reduce((s, r) => s + r.valor, 0)) });
      }
    }

    // Artículos de la selección, de mayor valor. Sin estado: los quietos, salvo que
    // se esté buscando un artículo (entonces todos los que coinciden).
    const estado = ['inmovilizado', 'lento', 'activo'].includes(req.query.estado) ? req.query.estado : null;
    const articulos = filas
      .filter(r => (estado ? r.estado === estado : palabras.length > 0 || r.estado !== 'activo'))
      .sort((x, y) => y.valor - x.valor)
      .slice(0, 100)
      .map(r => ({
        codigo_articulo: r.codigo_articulo, articulo: r.articulo, clase: r.clase, estado: r.estado,
        stock_actual: r.stock_actual, valor: Math.round(r.valor), dias_cobertura: r.dias_cobertura,
        dias_sin_mov: r.dias_sin_mov, ultima_venta: r.ultima_venta, ultima_compra: r.ultima_compra,
        categoria: r.categoria, subcategoria: r.subcategoria, sublinea: r.sublinea,
      }));

    res.json({
      status: 'success',
      data: { dim, q: palabras.join(' '), fecha_corte: corte, totales, items: items.slice(0, 500), antiguedad, por_clase_estado: porClase, articulos },
    });
  } catch (error) {
    console.error('[GET /analisis/inventario-quieto] Error:', error);
    res.status(500).json({ status: 'error', message: 'Error al calcular el inventario inmovilizado' });
  }
});

// ---------------------------------------------------------------------------
// Rotación de inventarios
// ---------------------------------------------------------------------------
// Rotación = costo de ventas anualizado ÷ inventario promedio (fórmula clásica).
//
// - Empresa, categoría, subcategoría y sublínea: COSTO DE VENTAS ÷ inventario. El
//   costo de ventas ya incluye la materia prima consumida, así que no se le suman
//   las compras de materia prima (sería contarla dos veces).
// - Un artículo de materia prima no se vende: se consume en producción. Para
//   él (y para un grupo que solo tiene materia prima) la salida es lo COMPRADO en
//   el período, como aproximación del consumo (lo que se consume se repone).
//   Sin esto, el ~60% del inventario saldría con rotación cero.
// - Costo de ventas por artículo: mismo criterio que el resto del sitio (margen
//   solo con líneas con costo); si el artículo no tiene ninguna línea con costo
//   se usa el margen global del período.
// - Inventario promedio: promedio de las fotos diarias de analitica.hist_inventario
//   dentro del período. Si no hay fotos en el período (historial desde 2026-10-09),
//   se usa el inventario de hoy y la respuesta lo indica.
const TRAMOS_ROT = [
  { id: 'd30',     hasta: 30 },
  { id: 'd60',     hasta: 60 },
  { id: 'd90',     hasta: 90 },
  { id: 'd180',    hasta: 180 },
  { id: 'd365',    hasta: 365 },
  { id: 'mas_365', hasta: Infinity },
];

// Salida por artículo de un período (caché 5 min por rango: la consulta recorre
// ventas y compras completas)
const cacheSalida = new Map();
async function salidaPorArticulo(db, P) {
  const key = `${P.desde}|${P.hasta}`;
  const hit = cacheSalida.get(key);
  if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit;
  const limpio = (e, vacio) => `COALESCE(NULLIF(TRIM(${e}), ''), '${vacio}')`;
  const enP = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
  const enPrev = `f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}`;
  const [filas, hist, serie] = await Promise.all([
    db.allAsync(`
      WITH g AS (
        SELECT ${M.pct('f', enP)} AS pct, ${M.pct('f', enPrev)} AS pct_prev
        FROM thermoplastica.fact_ventas_linea f WHERE f.tipo_doc = 'FACT'
      ), v AS (
        SELECT f.articulo_id,
          COALESCE(${M.costo('f', enP)},
                   SUM(f.total_sin_iva) FILTER (WHERE ${enP}) * (1 - (SELECT pct FROM g) / 100), 0)          AS cogs,
          COALESCE(${M.costo('f', enPrev)},
                   SUM(f.total_sin_iva) FILTER (WHERE ${enPrev}) * (1 - (SELECT pct_prev FROM g) / 100), 0)  AS cogs_prev,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${enP}), 0) AS ventas,
          COUNT(*) > 0 AS alguna_venta
        FROM thermoplastica.fact_ventas_linea f
        WHERE f.tipo_doc = 'FACT'
        GROUP BY f.articulo_id
      ), c AS (
        SELECT f.articulo_id,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${enP}), 0)    AS compras,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${enPrev}), 0) AS compras_prev
        FROM thermoplastica.fact_compras_linea f
        WHERE f.tipo_doc = 'FACT' AND NOT COALESCE(f.es_outlier_fecha, false)
          AND NOT COALESCE(f.es_gasto_operativo, false) AND f.fecha_emision <= CURRENT_DATE
        GROUP BY f.articulo_id
      )
      SELECT a.articulo_id, a.codigo_articulo, a.descripcion AS articulo,
        ${limpio('a.marca', 'Sin categoría')}    AS categoria,
        ${limpio('a.linea', 'Sin subcategoría')} AS subcategoria,
        ${limpio('a.sublinea', 'Sin sublínea')}  AS sublinea,
        COALESCE(v.cogs, 0) AS cogs, COALESCE(v.cogs_prev, 0) AS cogs_prev, COALESCE(v.ventas, 0) AS ventas,
        COALESCE(v.alguna_venta, false) AS alguna_venta,
        COALESCE(c.compras, 0) AS compras, COALESCE(c.compras_prev, 0) AS compras_prev
      FROM thermoplastica.dim_articulo a
      LEFT JOIN v ON v.articulo_id = a.articulo_id
      LEFT JOIN c ON c.articulo_id = a.articulo_id
      WHERE v.articulo_id IS NOT NULL OR c.articulo_id IS NOT NULL`),
    // Inventario promedio del período según las fotos diarias
    db.allAsync(`
      WITH d AS (SELECT DISTINCT fecha FROM analitica.hist_inventario WHERE fecha BETWEEN ${P.D} AND ${P.H})
      SELECT h.articulo_id, SUM(h.valor) / (SELECT count(*) FROM d) AS promedio,
             (SELECT count(*) FROM d) AS fotos, (SELECT min(fecha) FROM d)::text AS primera, (SELECT max(fecha) FROM d)::text AS ultima
      FROM analitica.hist_inventario h
      WHERE h.fecha BETWEEN ${P.D} AND ${P.H}
      GROUP BY h.articulo_id`).catch(() => []),
    // Salida mensual por artículo, 12 meses hasta el fin del período
    db.allAsync(`
      WITH m AS (SELECT date_trunc('month', ${P.H}) - interval '11 months' AS desde)
      SELECT articulo_id, mes, SUM(cogs) AS cogs, SUM(compras) AS compras FROM (
        SELECT f.articulo_id, to_char(f.fecha_emision, 'YYYY-MM') AS mes,
               COALESCE(${M.costo('f')}, SUM(f.costo_total_facturado), 0) AS cogs, 0 AS compras
        FROM thermoplastica.fact_ventas_linea f, m
        WHERE f.tipo_doc = 'FACT' AND f.fecha_emision >= m.desde AND f.fecha_emision <= ${P.H}
        GROUP BY 1, 2
        UNION ALL
        SELECT f.articulo_id, to_char(f.fecha_emision, 'YYYY-MM'), 0, SUM(f.total_sin_iva)
        FROM thermoplastica.fact_compras_linea f, m
        WHERE f.tipo_doc = 'FACT' AND NOT COALESCE(f.es_outlier_fecha, false) AND NOT COALESCE(f.es_gasto_operativo, false)
          AND f.fecha_emision >= m.desde AND f.fecha_emision <= LEAST(${P.H}, CURRENT_DATE)
        GROUP BY 1, 2
      ) x GROUP BY 1, 2`),
  ]);
  const r = { t: Date.now(), filas, hist, serie };
  cacheSalida.set(key, r);
  if (cacheSalida.size > 20) cacheSalida.delete(cacheSalida.keys().next().value);
  return r;
}

// Métricas de un grupo de artículos. `anual` = factor para anualizar la salida.
function resumirRot(rs, anual) {
  const suma = (k) => rs.reduce((s, r) => s + r[k], 0);
  const inventario = suma('inventario');
  const salida = suma('salida');
  const cogs = suma('cogs');
  const sinSalida = rs.filter(r => r.inventario > 0 && r.salida <= 0);
  const rot = (sal, inv) => (inv > 0 ? Math.round(sal * anual / inv * 100) / 100 : null);
  const dias = (sal, inv) => (sal > 0 && inv > 0 ? Math.round(inv / (sal * anual / 365)) : null);
  // Costo de ventas si el grupo vende algo; si solo tiene materia prima, su consumo (compras)
  const consumo = suma('consumo_mp');
  const base = cogs > 0 ? 'costo_ventas' : consumo > 0 ? 'consumo' : null;
  const flujo = base === 'costo_ventas' ? cogs : base === 'consumo' ? consumo : 0;
  return {
    articulos: rs.filter(r => r.inventario > 0).length,
    inventario: Math.round(inventario),
    inventario_hoy: Math.round(suma('inventario_hoy')),
    cogs: Math.round(cogs),
    cogs_prev: Math.round(suma('cogs_prev')),
    consumo_mp: Math.round(consumo),
    base_rotacion: base,
    rotacion: base ? rot(flujo, inventario) : (inventario > 0 ? 0 : null),
    dias: dias(flujo, inventario),
    // Salida artículo por artículo (costo de ventas o consumo de materia prima)
    salida: Math.round(salida),
    sin_salida_valor: Math.round(sinSalida.reduce((s, r) => s + r.inventario, 0)),
    sin_salida_articulos: sinSalida.length,
  };
}

// GET /api/analisis/rotacion-inventario?desde=&hasta=&dim=categoria&categoria=&subcategoria=&sublinea=&q=&tipo=
router.get('/rotacion-inventario', async (req, res) => {
  try {
    const db = req.app.get('db');
    const P = parsePeriodo(req);
    const dim = ['categoria', 'subcategoria', 'sublinea', 'articulo'].includes(req.query.dim) ? req.query.dim : 'categoria';
    const [{ filas: stock, corte }, sal] = await Promise.all([inventarioSalud(db), salidaPorArticulo(db, P)]);

    // Inventario promedio por artículo (o el de hoy si no hay fotos en el período)
    const fotos = sal.hist.length ? Number(sal.hist[0].fotos) : 0;
    const promedio = new Map(sal.hist.map(h => [Number(h.articulo_id), Number(h.promedio)]));
    const base = {
      fotos,
      primera_foto: sal.hist[0]?.primera || null,
      ultima_foto: sal.hist[0]?.ultima || null,
      usa_inventario_hoy: fotos === 0,
    };

    // Unir stock de hoy (con su clase) y salidas del período
    const porCodigo = new Map();
    for (const s of stock) {
      porCodigo.set(s.codigo_articulo, {
        articulo_id: Number(s.articulo_id), codigo_articulo: s.codigo_articulo, articulo: s.articulo, clase: s.clase,
        categoria: s.categoria, subcategoria: s.subcategoria, sublinea: s.sublinea,
        inventario_hoy: s.valor, stock_actual: s.stock_actual, ultima_venta: s.ultima_venta, ultima_compra: s.ultima_compra,
        cogs: 0, cogs_prev: 0, compras: 0, compras_prev: 0, ventas: 0, alguna_venta: false,
      });
    }
    for (const f of sal.filas) {
      const r = porCodigo.get(f.codigo_articulo) || {
        codigo_articulo: f.codigo_articulo, articulo: f.articulo, clase: null,
        categoria: f.categoria, subcategoria: f.subcategoria, sublinea: f.sublinea,
        inventario_hoy: 0, stock_actual: 0,
      };
      Object.assign(r, {
        articulo_id: Number(f.articulo_id),
        cogs: Number(f.cogs) || 0, cogs_prev: Number(f.cogs_prev) || 0,
        compras: Number(f.compras) || 0, compras_prev: Number(f.compras_prev) || 0,
        ventas: Number(f.ventas) || 0, alguna_venta: f.alguna_venta,
      });
      porCodigo.set(f.codigo_articulo, r);
    }
    let filas = [...porCodigo.values()].map(r => {
      // Misma clasificación que capital inmovilizado; sin stock hoy, se deduce de la historia
      const clase = r.clase || (r.alguna_venta ? 'producto' : r.compras > 0 || r.compras_prev > 0 ? 'materia_prima' : 'sin_movimiento');
      const inventario = base.usa_inventario_hoy ? r.inventario_hoy : (promedio.get(r.articulo_id) || 0);
      const salida = clase === 'producto' ? r.cogs : clase === 'materia_prima' ? r.compras : 0;
      const salida_prev = clase === 'producto' ? r.cogs_prev : clase === 'materia_prima' ? r.compras_prev : 0;
      return { ...r, clase, inventario, salida, salida_prev, consumo_mp: clase === 'materia_prima' ? r.compras : 0 };
    }).filter(r => r.inventario > 0 || r.salida > 0);

    // Filtros de producto, búsqueda y tipo
    for (const k of ['categoria', 'subcategoria', 'sublinea']) {
      if (req.query[k]) filas = filas.filter(r => r[k] === req.query[k]);
    }
    const palabras = normalizar(req.query.q).split(/\s+/).filter(Boolean);
    if (palabras.length) {
      filas = filas.filter(r => {
        const texto = normalizar(`${r.codigo_articulo} ${r.articulo}`);
        return palabras.every(p => texto.includes(p));
      });
    }
    const tipo = ['producto', 'materia_prima', 'sin_movimiento'].includes(req.query.tipo) ? req.query.tipo : null;
    if (tipo) filas = filas.filter(r => r.clase === tipo);

    const anual = 365 / P.dias;
    const totales = resumirRot(filas, anual);
    totales.cogs_variacion_pct = totales.cogs_prev > 0 ? Math.round((totales.cogs / totales.cogs_prev - 1) * 1000) / 10 : null;

    // Por tipo de artículo
    const porTipo = ['producto', 'materia_prima', 'sin_movimiento']
      .map(c => ({ clase: c, ...resumirRot(filas.filter(r => r.clase === c), anual) }))
      .filter(t => t.inventario > 0 || t.salida > 0);

    // Agrupación por el nivel pedido
    const grupos = new Map();
    for (const r of filas) {
      const clave = dim === 'articulo' ? r.codigo_articulo : r[dim];
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(r);
    }
    const items = [...grupos.entries()].map(([clave, rs]) => {
      const g = resumirRot(rs, anual);
      const a = rs[0];
      return {
        clave,
        nombre: dim === 'articulo' ? a.articulo : clave,
        ...g,
        pct_inventario: totales.inventario > 0 ? Math.round(g.inventario / totales.inventario * 1000) / 10 : 0,
        // Participación en la salida que define la rotación de la selección
        // (costo de ventas; o consumo si la selección es solo materia prima)
        pct_cogs: totales.base_rotacion === 'consumo'
          ? (totales.consumo_mp > 0 ? Math.round(g.consumo_mp / totales.consumo_mp * 1000) / 10 : 0)
          : (totales.cogs > 0 ? Math.round(g.cogs / totales.cogs * 1000) / 10 : 0),
        pct_materia_prima: g.inventario > 0 ? Math.round(rs.filter(r => r.clase === 'materia_prima').reduce((s, r) => s + r.inventario, 0) / g.inventario * 100) : 0,
        ...(dim === 'articulo' ? { clase: a.clase, stock_actual: a.stock_actual, ultima_venta: a.ultima_venta, ultima_compra: a.ultima_compra } : {}),
      };
    }).sort((x, y) => y.inventario - x.inventario || y.salida - x.salida);
    // Grupos sin inventario (servicios, maquila…): no rotan, pero su costo sí entra al total
    const sinInv = items.filter(i => i.inventario <= 0);
    const sinInventario = {
      grupos: sinInv.map(i => i.nombre),
      cogs: Math.round(sinInv.reduce((s, i) => s + i.cogs, 0)),
      pct_cogs: totales.cogs > 0 ? Math.round(sinInv.reduce((s, i) => s + i.cogs, 0) / totales.cogs * 1000) / 10 : 0,
    };

    // Inventario según sus días de inventario (artículo por artículo)
    const conStock = filas.filter(r => r.inventario > 0);
    const diasArt = (r) => (r.salida > 0 ? r.inventario / (r.salida * anual / 365) : null);
    const distribucion = [
      ...TRAMOS_ROT.map((t, i) => {
        const desde = i === 0 ? -Infinity : TRAMOS_ROT[i - 1].hasta;
        const rs = conStock.filter(r => { const d = diasArt(r); return d !== null && d > desde && d <= t.hasta; });
        return { tramo: t.id, articulos: rs.length, valor: Math.round(rs.reduce((s, r) => s + r.inventario, 0)) };
      }),
      (() => {
        const rs = conStock.filter(r => diasArt(r) === null);
        return { tramo: 'sin_salida', articulos: rs.length, valor: Math.round(rs.reduce((s, r) => s + r.inventario, 0)) };
      })(),
    ];

    // Salida mensual (costo de ventas y compras) de la selección
    const codigos = new Set(filas.map(r => r.articulo_id).filter(Boolean));
    const meses = new Map();
    for (const s of sal.serie) {
      if (!codigos.has(Number(s.articulo_id))) continue;
      const m = meses.get(s.mes) || { mes: s.mes, cogs: 0, compras: 0 };
      m.cogs += Number(s.cogs) || 0;
      m.compras += Number(s.compras) || 0;
      meses.set(s.mes, m);
    }
    const serie = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes))
      .map(m => ({ mes: m.mes, cogs: Math.round(m.cogs), compras: Math.round(m.compras) }));

    // Artículos de la selección: los de más inventario
    const articulos = conStock
      .sort((x, y) => y.inventario - x.inventario)
      .slice(0, 100)
      .map(r => {
        const d = diasArt(r);
        return {
          codigo_articulo: r.codigo_articulo, articulo: r.articulo, clase: r.clase,
          categoria: r.categoria, subcategoria: r.subcategoria, sublinea: r.sublinea,
          stock_actual: r.stock_actual, inventario: Math.round(r.inventario), salida: Math.round(r.salida),
          rotacion: r.inventario > 0 ? Math.round(r.salida * anual / r.inventario * 100) / 100 : null,
          dias: d === null ? null : Math.round(d),
          ultima_venta: r.ultima_venta, ultima_compra: r.ultima_compra,
        };
      });

    res.json({
      status: 'success',
      data: {
        periodo: P.ventana(), dim, q: palabras.join(' '), tipo, fecha_corte: corte,
        base_inventario: base, totales, por_tipo: porTipo, items: items.filter(i => i.inventario > 0).slice(0, 500),
        sin_inventario: sinInventario, distribucion, serie, articulos,
      },
    });
  } catch (error) {
    console.error('[GET /analisis/rotacion-inventario] Error:', error);
    res.status(500).json({ status: 'error', message: 'Error al calcular la rotación de inventarios' });
  }
});

// GET /api/analisis/proyeccion-ventas?meses=6
router.get('/proyeccion-ventas', async (req, res) => {
  try {
    const meses = Math.min(Math.max(parseInt(req.query.meses) || 6, 1), 12);
    const data = await proyecciones.proyectarVentas({ meses });
    res.json({ status: 'success', timestamp: new Date().toISOString(), data });
  } catch (error) {
    console.error('[GET /analisis/proyeccion-ventas] Error:', error);
    res.status(500).json({ status: 'error', message: 'Error al proyectar ventas' });
  }
});

// GET /api/analisis/flujo-caja?semanas=13
router.get('/flujo-caja', async (req, res) => {
  try {
    const semanas = Math.min(Math.max(parseInt(req.query.semanas) || 13, 1), 26);
    const data = await proyecciones.proyectarFlujo({ semanas });
    res.json({ status: 'success', timestamp: new Date().toISOString(), data });
  } catch (error) {
    console.error('[GET /analisis/flujo-caja] Error:', error);
    res.status(500).json({ status: 'error', message: 'Error al proyectar el flujo de caja' });
  }
});

module.exports = router;
