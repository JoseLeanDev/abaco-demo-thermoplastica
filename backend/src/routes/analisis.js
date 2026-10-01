const express = require('express');
const router = express.Router();

// NUEVO: Importar abaco Core v2.0
const CFOAICore = require('../agents');

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

// Cache simple en memoria para insights (TTL: 5 minutos)
const insightsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Helper: Generar insights desde la base de datos
async function generateInsightsFromDB(db, empresaId) {
  const insights = [];
  
  try {
    // === INSIGHTS ESTRATÉGICOS (no solo conteos) ===
    
    // 1. CONCENTRACIÓN DE CLIENTES - Riesgo estratégico
    const concentracionClientes = await db.allAsync(`
      SELECT 
        cliente_nombre,
        SUM(monto_total) as total_ventas,
        COUNT(*) as facturas
      FROM cuentas_cobrar 
      WHERE empresa_id = ? 
        AND fecha_emision >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY cliente_nombre
      ORDER BY total_ventas DESC
      LIMIT 5
    `, [empresaId]);
    
    if (concentracionClientes && concentracionClientes.length > 0) {
      const totalVentas = concentracionClientes.reduce((s, c) => s + parseFloat(c.total_ventas), 0);
      const topCliente = concentracionClientes[0];
      const pctTopCliente = ((parseFloat(topCliente.total_ventas) / totalVentas) * 100).toFixed(1);
      
      if (parseFloat(pctTopCliente) > 30) {
        insights.push({
          tipo: 'cliente_en_riesgo',
          severidad: 'alta',
          titulo: `Alto riesgo: ${pctTopCliente}% de ventas dependen de ${topCliente.cliente_nombre}`,
          descripcion: `Tu cliente más grande representa ${pctTopCliente}% de ventas trimestrales. Perderlo afectaría gravemente el flujo de caja. Considera diversificar cartera.`,
          monto_impacto: parseFloat(topCliente.total_ventas),
          accion_sugerida: 'Ver plan de diversificación',
          categoria: 'analisis'
        });
      }
    }
    
    // 2. EFICIENCIA DE COBRANZA vs BENCHMARK
    const eficienciaCobranza = await db.getAsync(`
      SELECT 
        AVG(CASE WHEN dias_atraso <= 0 THEN 1 ELSE 0 END) * 100 as tasa_puntual,
        AVG(dias_atraso) as dias_promedio_atraso
      FROM cuentas_cobrar 
      WHERE empresa_id = ? AND estado != 'cobrada'
    `, [empresaId]);
    
    if (eficienciaCobranza && parseFloat(eficienciaCobranza.dias_promedio_atraso) > 15) {
      const dias = Math.round(parseFloat(eficienciaCobranza.dias_promedio_atraso));
      insights.push({
        tipo: 'deterioro_flujo_caja',
        severidad: dias > 30 ? 'alta' : 'media',
        titulo: `Cobranza lenta: ${dias} días promedio de atraso`,
        descripcion: `Tus clientes pagan en promedio ${dias} días tarde. El benchmark del sector es 15 días. Cada día de retraso cuesta aproximadamente Q${(dias * 2500).toLocaleString()} en costo de oportunidad.`,
        monto_impacto: dias * 2500,
        accion_sugerida: 'Implementar descuento 2% pronto pago',
        categoria: 'tesoreria'
      });
    }
    
    // 3. MARGEN EN DETERIORO - Alerta de rentabilidad
    const margenTendencia = await db.allAsync(`
      SELECT 
        TO_CHAR(fecha_emision, 'YYYY-MM') as mes,
        SUM(monto_total) as ventas,
        AVG(margen_estimado) as margen_promedio
      FROM cuentas_cobrar 
      WHERE empresa_id = ? 
        AND fecha_emision >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY TO_CHAR(fecha_emision, 'YYYY-MM')
      ORDER BY mes DESC
      LIMIT 3
    `, [empresaId]);
    
    if (margenTendencia && margenTendencia.length >= 2) {
      const mesActual = parseFloat(margenTendencia[0].margen_promedio) || 35;
      const mesAnterior = parseFloat(margenTendencia[1].margen_promedio) || 35;
      const variacionMargen = mesActual - mesAnterior;
      
      if (variacionMargen < -3) {
        insights.push({
          tipo: 'margen_decreciente',
          severidad: 'alta',
          titulo: `Margen cayendo: ${variacionMargen.toFixed(1)}pp este mes`,
          descripcion: `Tu margen promedio bajó de ${mesAnterior.toFixed(1)}% a ${mesActual.toFixed(1)}%. Revisa descuentos otorgados y costos de materia prima. Un ajuste de precio del 3% recuperaría Q${Math.round(parseFloat(margenTendencia[0].ventas) * 0.03).toLocaleString()}.`,
          monto_impacto: Math.abs(variacionMargen) * parseFloat(margenTendencia[0].ventas) / 100,
          accion_sugerida: 'Revisar política de descuentos',
          categoria: 'contabilidad'
        });
      }
    }
    
    // 4. OPORTUNIDAD DE VENTAS CRUZADAS
    const ventasCruzadas = await db.allAsync(`
      SELECT 
        c1.cliente_nombre,
        COUNT(DISTINCT c1.producto_linea) as lineas_compradas,
        (SELECT COUNT(DISTINCT producto_linea) FROM cuentas_cobrar WHERE empresa_id = ?) as lineas_totales
      FROM cuentas_cobrar c1
      WHERE c1.empresa_id = ? 
        AND c1.fecha_emision >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY c1.cliente_nombre
      HAVING COUNT(DISTINCT c1.producto_linea) = 1
      ORDER BY SUM(c1.monto_total) DESC
      LIMIT 3
    `, [empresaId, empresaId]);
    
    if (ventasCruzadas && ventasCruzadas.length > 0) {
      const cliente = ventasCruzadas[0];
      insights.push({
        tipo: 'oportunidad',
        severidad: 'info',
        titulo: `Oportunidad: ${cliente.cliente_nombre} solo compra 1 línea`,
        descripcion: `Este cliente compra solo 1 de ${cliente.lineas_totales} líneas de producto. Hay potencial de venta cruzada estimado en Q${Math.round(parseFloat(cliente.lineas_compradas) * 150000).toLocaleString()} anuales.`,
        monto_impacto: 150000,
        accion_sugerida: 'Contactar con propuesta de líneas adicionales',
        categoria: 'analisis'
      });
    }
    
    // 5. PODER DE NEGOCIACIÓN CON PROVEEDORES
    const poderNegociacion = await db.getAsync(`
      SELECT 
        AVG(EXTRACT(DAY FROM (fecha_vencimiento - fecha_emision))) as dias_credito_promedio,
        COUNT(DISTINCT proveedor_nombre) as total_proveedores
      FROM cuentas_pagar 
      WHERE empresa_id = ? AND estado = 'pendiente'
    `, [empresaId]);
    
    if (poderNegociacion && parseFloat(poderNegociacion.dias_credito_promedio) < 20) {
      const dias = Math.round(parseFloat(poderNegociacion.dias_credito_promedio));
      insights.push({
        tipo: 'oportunidad',
        severidad: 'info',
        titulo: `Negocia mejores plazos: solo ${dias} días de crédito`,
        descripcion: `Tus proveedores te dan ${dias} días promedio. El sector promedio es 30 días. Extender a 30 días liberaría Q${Math.round(parseFloat(poderNegociacion.total_proveedores) * 50000).toLocaleString()} en efectivo.`,
        monto_impacto: parseFloat(poderNegociacion.total_proveedores) * 50000,
        accion_sugerida: 'Renegociar plazos con top 3 proveedores',
        categoria: 'tesoreria'
      });
    }
    
    // 6. SEASONALITY / TENDENCIA DE VENTAS
    const tendenciaVentas = await db.allAsync(`
      SELECT 
        TO_CHAR(fecha_emision, 'YYYY-MM') as mes,
        SUM(monto_total) as total
      FROM cuentas_cobrar 
      WHERE empresa_id = ? 
        AND fecha_emision >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(fecha_emision, 'YYYY-MM')
      ORDER BY mes DESC
      LIMIT 3
    `, [empresaId]);
    
    if (tendenciaVentas && tendenciaVentas.length >= 2) {
      const actual = parseFloat(tendenciaVentas[0].total);
      const anterior = parseFloat(tendenciaVentas[1].total);
      const variacion = ((actual - anterior) / anterior * 100).toFixed(1);
      
      if (parseFloat(variacion) < -10) {
        insights.push({
          tipo: 'caida_ingresos_brusca',
          severidad: 'alta',
          titulo: `Alerta: Ventas cayeron ${Math.abs(parseFloat(variacion)).toFixed(0)}% vs mes anterior`,
          descripcion: `Las ventas pasaron de Q${Math.round(anterior).toLocaleString()} a Q${Math.round(actual).toLocaleString()}. Revisa si es estacionalidad o pérdida de clientes.`,
          monto_impacto: anterior - actual,
          accion_sugerida: 'Ver análisis de clientes perdidos',
          categoria: 'analisis'
        });
      } else if (parseFloat(variacion) > 20) {
        insights.push({
          tipo: 'aumento_ingresos_brusco',
          severidad: 'info',
          titulo: `Ventas crecieron ${parseFloat(variacion).toFixed(0)}% - ¿Capacidad suficiente?`,
          descripcion: `Crecimiento fuerte detectado. Verifica que tu capacidad operativa pueda sostener esta tendencia sin afectar calidad o márgenes.`,
          monto_impacto: actual - anterior,
          accion_sugerida: 'Ver capacidad operativa',
          categoria: 'analisis'
        });
      }
    }
    
    // 7. EFECTIVO vs BURN RATE (Runway)
    const posicionLiquidez = await db.getAsync(`
      SELECT SUM(saldo) as total_disponible
      FROM cuentas_bancarias 
      WHERE empresa_id = ? AND activa = TRUE
    `, [empresaId]);
    
    const burnRate = await db.getAsync(`
      SELECT COALESCE(AVG(monto), 0) as gasto_diario
      FROM (
        SELECT SUM(ABS(monto)) as monto, fecha
        FROM transacciones t
        JOIN cuentas_contables c ON t.cuenta_id = c.id
        WHERE t.tipo = 'debe' AND c.codigo LIKE '5%'
        AND t.fecha >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY fecha
      ) daily
    `);
    
    const efectivo = parseFloat(posicionLiquidez?.total_disponible) || 0;
    const gastoDiario = parseFloat(burnRate?.gasto_diario) || 50000;
    const runway = Math.floor(efectivo / gastoDiario);
    
    if (runway < 60 && runway > 0) {
      insights.push({
        tipo: 'deterioro_flujo_caja',
        severidad: runway < 30 ? 'alta' : 'media',
        titulo: `Runway: ${runway} días de operación restantes`,
        descripcion: `Con tu burn rate actual de Q${Math.round(gastoDiario).toLocaleString()}/día, el efectivo alcanza para ${runway} días. Umbral recomendado: 90 días.`,
        monto_impacto: efectivo,
        accion_sugerida: runway < 30 ? 'Acordar línea de crédito' : 'Acelerar cobranzas',
        categoria: 'tesoreria'
      });
    }
    
    // 8. PRODUCTOS ESTRELLA vs VAMPIROS
    const productosRentabilidad = await db.allAsync(`
      SELECT 
        producto_linea,
        SUM(monto_total) as ventas,
        AVG(margen_estimado) as margen
      FROM cuentas_cobrar 
      WHERE empresa_id = ? 
        AND fecha_emision >= CURRENT_DATE - INTERVAL '3 months'
        AND producto_linea IS NOT NULL
      GROUP BY producto_linea
      ORDER BY ventas DESC
    `, [empresaId]);
    
    if (productosRentabilidad && productosRentabilidad.length > 0) {
      const estrella = productosRentabilidad.reduce((max, p) => 
        parseFloat(p.ventas) * (parseFloat(p.margen)/100) > parseFloat(max.ventas) * (parseFloat(max.margen)/100) ? p : max
      );
      const vampiro = productosRentabilidad.reduce((min, p) => 
        parseFloat(p.margen) < parseFloat(min.margen) ? p : min
      );
      
      if (parseFloat(vampiro.margen) < 20 && parseFloat(vampiro.ventas) > 100000) {
        insights.push({
          tipo: 'margen_decreciente',
          severidad: 'media',
          titulo: `"Vampiro" detectado: ${vampiro.producto_linea} margen ${parseFloat(vampiro.margen).toFixed(0)}%`,
          descripcion: `Esta línea genera Q${Math.round(parseFloat(vampiro.ventas)).toLocaleString()} pero con margen de solo ${parseFloat(vampiro.margen).toFixed(0)}%. Considera subir precio 5% o reducir costos.`,
          monto_impacto: parseFloat(vampiro.ventas) * 0.05,
          accion_sugerida: 'Revisar precios de línea',
          categoria: 'contabilidad'
        });
      }
    }
    
    // 9. OPORTUNIDAD DE PRONTO PAGO
    const oportunidadDescuento = await db.getAsync(`
      SELECT SUM(monto_pendiente) as total_vencido
      FROM cuentas_cobrar 
      WHERE empresa_id = ? AND estado != 'cobrada' AND dias_atraso > 30
    `, [empresaId]);
    
    if (oportunidadDescuento && parseFloat(oportunidadDescuento.total_vencido) > 100000) {
      const monto = parseFloat(oportunidadDescuento.total_vencido);
      insights.push({
        tipo: 'oportunidad',
        severidad: 'info',
        titulo: `Descuento pronto pago recuperaría Q${Math.round(monto * 0.15).toLocaleString()}`,
        descripcion: `Ofrecer 5% de descuento por pronto pago en facturas vencidas podría recuperar Q${Math.round(monto * 0.15).toLocaleString()} este mes, mejorando liquidez inmediatamente.`,
        monto_impacto: monto * 0.15,
        accion_sugerida: 'Enviar oferta de descuento',
        categoria: 'tesoreria'
      });
    }
    
  } catch (error) {
    console.error('[generateInsightsFromDB] Error:', error.message);
  }
  
  return { insights };
}

// Helper: Detectar anomalías desde la base de datos
async function detectAnomaliesFromDB(db, empresaId, umbral) {
  const anomalias = [];
  const alertas = [];
  
  try {
    // Anomalía 1: Transacciones inusualmente grandes (últimos 30 días)
    const transaccionesGrandes = await db.allAsync(`
      SELECT t.*, c.nombre as cuenta_nombre
      FROM transacciones t
      JOIN cuentas_contables c ON t.cuenta_id = c.id
      WHERE t.fecha >= CURRENT_DATE - INTERVAL '30 days'
      AND ABS(t.monto) > (
        SELECT AVG(ABS(monto)) * 3 
        FROM transacciones 
        WHERE fecha >= CURRENT_DATE - INTERVAL '90 days'
      )
      ORDER BY ABS(t.monto) DESC
      LIMIT 5
    `);
    
    for (const t of transaccionesGrandes) {
      anomalias.push({
        tipo: 'transaccion_anomala',
        categoria: 'contabilidad',
        severidad: 'alta',
        titulo: `Transacción inusual: ${t.cuenta_nombre}`,
        descripcion: `Monto de Q${Math.round(parseFloat(t.monto)).toLocaleString()} es significativamente mayor al promedio histórico.`,
        datos: { monto_total: parseFloat(t.monto), cuenta: t.cuenta_nombre },
        accion_recomendada: 'Verificar transacción manualmente'
      });
    }
    
    // Anomalía 2: Clientes con caída repentina de compras (simplificado)
    const clienteCaida = await db.allAsync(`
      SELECT 
        cc.cliente_nombre,
        SUM(CASE WHEN cc.fecha_emision >= CURRENT_DATE - INTERVAL '30 days' THEN cc.monto_total ELSE 0 END) as mes_actual,
        SUM(CASE WHEN cc.fecha_emision >= CURRENT_DATE - INTERVAL '60 days' AND cc.fecha_emision < CURRENT_DATE - INTERVAL '30 days' THEN cc.monto_total ELSE 0 END) as mes_anterior
      FROM cuentas_cobrar cc
      WHERE cc.empresa_id = ? AND cc.estado != 'cobrada'
      GROUP BY cc.cliente_nombre
      HAVING mes_anterior > 0
    `, [empresaId]);
    
    for (const c of clienteCaida) {
      const variacion = ((parseFloat(c.mes_actual) - parseFloat(c.mes_anterior)) / parseFloat(c.mes_anterior)) * 100;
      if (variacion < -50) {
        anomalias.push({
          tipo: 'cliente_en_riesgo',
          categoria: 'analisis',
          severidad: 'alta',
          titulo: `${c.cliente_nombre}: caída del ${Math.abs(variacion).toFixed(0)}%`,
          descripcion: `Este cliente ha reducido significativamente sus compras en el último mes.`,
          datos: { monto_actual: parseFloat(c.mes_actual), monto_anterior: parseFloat(c.mes_anterior) },
          accion_recomendada: 'Contactar al cliente para evaluar relación comercial'
        });
      }
    }
    
  } catch (error) {
    console.error('[detectAnomaliesFromDB] Error:', error.message);
  }
  
  return { anomalias, alertas };
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
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
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

// GET /api/analisis/salud  Ciclo de caja, tendencia, capital inmovilizado y capital de trabajo
router.get('/salud', async (req, res) => {
  try {
    const db = req.app.get('db');
    const [ciclo, mensual, capital, porClase, porLinea, topInmovilizado] = await Promise.all([
      db.getAsync('SELECT * FROM analitica.v_ciclo_caja'),
      db.allAsync('SELECT * FROM analitica.v_ciclo_caja_mensual ORDER BY anio_mes'),
      db.getAsync('SELECT * FROM analitica.v_capital_trabajo'),
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

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ciclo: numerosFila(ciclo),
        ciclo_mensual: mensual.map(numerosFila),
        capital_trabajo: numerosFila(capital),
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
