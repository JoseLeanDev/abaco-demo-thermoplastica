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

// GET /api/analisis/rentabilidad
router.get('/rentabilidad', async (req, res) => {
  try {
    const dimension = req.query.dimension || 'producto';
    
    const metricas = [
      { categoria: 'Producto A - Detergentes', ventas: 1200000, costo: 780000, margen_bruto: 420000, margen_porcentaje: 35.0, unidades_vendidas: 4500, rentabilidad_rank: 1, trend: 'up' },
      { categoria: 'Producto B - Jabones', ventas: 800000, costo: 560000, margen_bruto: 240000, margen_porcentaje: 30.0, unidades_vendidas: 3200, rentabilidad_rank: 2, trend: 'down' },
      { categoria: 'Producto C - Suavizantes', ventas: 600000, costo: 450000, margen_bruto: 150000, margen_porcentaje: 25.0, unidades_vendidas: 2800, rentabilidad_rank: 3, trend: 'stable' },
      { categoria: 'Producto D - Desinfectantes', ventas: 450000, costo: 360000, margen_bruto: 90000, margen_porcentaje: 20.0, unidades_vendidas: 1800, rentabilidad_rank: 4, trend: 'down' }
    ];

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        dimension,
        periodo: '2026-Q1',
        metricas_agrupadas: metricas,
        insight_principal: 'Detergentes mantienen liderazgo con 35% margen. Jabones muestran contracción de 3pp vs Q4.',
        recomendaciones: [
          'Negociar volumen con proveedor de Producto B para recuperar 2pp de margen',
          'Evaluar descontinuar SKU de jabones líquidos (margen 18%, rotación baja)'
        ]
      },
      ui_components: {
        chart: 'profitability_waterfall',
        table: 'product_profitability'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/analisis/presupuesto
router.get('/presupuesto', async (req, res) => {
  try {
    const periodo = req.query.periodo || '2026';

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo,
        moneda: 'GTQ',
        resumen: {
          presupuesto_anual: 48000000,
          real_acumulado: 12500000,
          varianza_absoluta: 500000,
          varianza_porcentaje: 4.2,
          estado: 'dentro_rango'
        },
        detalle_mensual: [
          { mes: 'Enero', presupuesto: 3800000, real: 3900000, varianza: 100000, var_pct: 2.6, estado: 'verde' },
          { mes: 'Febrero', presupuesto: 3600000, real: 4100000, varianza: 500000, var_pct: 13.9, estado: 'rojo', explicacion: 'Gasto extraordinario mantenimiento' },
          { mes: 'Marzo', presupuesto: 4000000, real: 4500000, varianza: 500000, var_pct: 12.5, estado: 'naranja' }
        ],
        rubros_criticos: [
          { rubro: 'Gastos de viaje', presupuesto: 120000, real: 185000, var_pct: 54.2, accion: 'Congelar aprobaciones Q2' }
        ]
      },
      ui_components: {
        chart: 'budget_vs_actual_bars',
        variance_table: 'detailed_variance'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/analisis/ratios
router.get('/ratios', async (req, res) => {
  try {
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        fecha_calculo: new Date().toISOString().split('T')[0],
        ratios: {
          liquidez_corriente: { valor: 1.35, interpretacion: 'Tienes Q1.35 por cada Q1 de deuda corto plazo', benchmark_sector: 1.25, posicion: 'above_average', trend: 'stable', alerta: false },
          prueba_acida: { valor: 0.95, interpretacion: 'Sin inventarios, cubres 95% de deudas corto plazo', benchmark_sector: 0.90, posicion: 'average', trend: 'improving', alerta: false },
          rotacion_cartera: { valor: 45, unidad: 'días', interpretacion: 'Tus clientes te pagan en promedio a 45 días', benchmark_sector: 38, posicion: 'below_average', trend: 'worsening', alerta: true, recomendacion: 'Reducir a 40 días con incentivo 1% pronto pago' },
          roi: { valor: 16.9, unidad: '%', interpretacion: 'Por cada Q100 invertidos, generas Q16.90 de utilidad', benchmark_sector: 14.5, posicion: 'above_average', trend: 'improving', alerta: false }
        }
      },
      ui_components: {
        gauges: 'ratio_gauges_vs_benchmark'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/analisis/tendencias
router.get('/tendencias', async (req, res) => {
  try {
    const metrica = req.query.metrica || 'ventas';
    
    const datosHistoricos = [];
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - i);
      datosHistoricos.push({
        periodo: fecha.toISOString().slice(0, 7),
        valor: 3200000 + (11 - i) * 80000 + Math.random() * 200000,
        yoy_growth: i < 4 ? 12.3 - (3 - i) * 2 : null
      });
    }

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        metrica,
        datos_historicos: datosHistoricos,
        tendencia_detectada: 'crecimiento_acelerado',
        cagr_12m: 8.7,
        forecast_proximo_trimestre: [
          { mes: 'Abril', forecast: 4250000, intervalo_confianza: [4100000, 4400000] },
          { mes: 'Mayo', forecast: 4380000, intervalo_confianza: [4200000, 4560000] },
          { mes: 'Junio', forecast: 4520000, intervalo_confianza: [4300000, 4740000] }
        ]
      },
      ui_components: {
        chart: 'trend_line_with_forecast'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/analisis/working-capital
// Calcula métricas de capital de trabajo: DSO, DPO, DIO, C2C
router.get('/working-capital', async (req, res) => {
  try {
    const db = req.app.get('db');
    const empresaId = req.query.empresa_id || 1;
    const periodoMeses = parseInt(req.query.meses) || 6;
    
    console.log(`[working-capital] empresa_id=${empresaId}, meses=${periodoMeses}`);
    console.log(`[working-capital] DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    
    // Detectar si es PostgreSQL o SQLite
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');
    console.log(`[working-capital] isPostgres: ${isPostgres}`);
    
    // ===== DSO (Days Sales Outstanding) =====
    const dsoQuery = isPostgres ? `
      SELECT 
        COALESCE(AVG(dias_atraso), 35)::numeric as dias_promedio_atraso,
        COUNT(*)::integer as total_facturas,
        COALESCE(SUM(CASE WHEN dias_atraso > 0 THEN monto_pendiente ELSE 0 END), 0)::numeric as monto_vencido,
        COALESCE(SUM(monto_pendiente), 0)::numeric as monto_total_cxc
      FROM cuentas_cobrar 
      WHERE empresa_id = $1
    ` : `
      SELECT 
        COALESCE(AVG(dias_atraso), 35) as dias_promedio_atraso,
        COUNT(*) as total_facturas,
        COALESCE(SUM(CASE WHEN dias_atraso > 0 THEN monto ELSE 0 END), 0) as monto_vencido,
        COALESCE(SUM(monto), 0) as monto_total_cxc
      FROM cuentas_cobrar 
      WHERE empresa_id = ?
    `;
    
    console.log(`[working-capital] Executing DSO query...`);
    let dsoData;
    try {
      dsoData = await db.getAsync(dsoQuery, isPostgres ? [empresaId] : [empresaId]);
      console.log(`[working-capital] DSO raw result:`, JSON.stringify(dsoData));
    } catch (queryErr) {
      console.error(`[working-capital] DSO query error:`, queryErr.message);
      dsoData = null;
    }
    
    // FORZAR valores por defecto si no hay datos o si son null/undefined/0
    const dsoValorRaw = dsoData?.dias_promedio_atraso;
    const dsoCountRaw = dsoData?.total_facturas;
    const hasDsoData = dsoValorRaw !== null && dsoValorRaw !== undefined && parseFloat(dsoValorRaw) > 0;
    
    console.log(`[working-capital] hasDsoData: ${hasDsoData}, valor: ${dsoValorRaw}, count: ${dsoCountRaw}`);
    
    if (!hasDsoData) {
      console.log(`[working-capital] Using DEFAULT DSO values`);
      dsoData = {
        dias_promedio_atraso: 35,
        total_facturas: 0,
        monto_vencido: 0,
        monto_total_cxc: 0
      };
    }
    
    const dso = {
      valor: Math.round(parseFloat(dsoData?.dias_promedio_atraso) || 30),
      benchmark_sector: 38,
      monto_vencido: parseFloat(dsoData?.monto_vencido) || 0,
      monto_total: parseFloat(dsoData?.monto_total_cxc) || 0,
      porcentaje_vencido: dsoData?.monto_total_cxc > 0 
        ? ((parseFloat(dsoData?.monto_vencido) || 0) / parseFloat(dsoData?.monto_total_cxc) * 100).toFixed(1)
        : 0
    };
    
    // ===== DPO (Days Payable Outstanding) =====
    const dpoQuery = isPostgres ? `
      SELECT 
        COALESCE(AVG(EXTRACT(DAY FROM (fecha_vencimiento - fecha_emision))), 30)::numeric as dias_plazo_promedio,
        COUNT(*)::integer as total_facturas,
        COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE AND estado = 'pendiente' THEN monto_total ELSE 0 END), 0)::numeric as monto_vencido
      FROM cuentas_pagar 
      WHERE empresa_id = $1
    ` : `
      SELECT 
        COALESCE(AVG(CAST((fecha_vencimiento::date - fecha_emision::date) AS INTEGER)), 30) as dias_plazo_promedio,
        COUNT(*) as total_facturas,
        COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE AND estado = 'pendiente' THEN monto ELSE 0 END), 0) as monto_vencido
      FROM cuentas_pagar 
      WHERE empresa_id = ?
    `;
    
    console.log(`[working-capital] Executing DPO query...`);
    let dpoData;
    try {
      dpoData = await db.getAsync(dpoQuery, isPostgres ? [empresaId] : [empresaId]);
      console.log(`[working-capital] DPO raw result:`, JSON.stringify(dpoData));
    } catch (queryErr) {
      console.error(`[working-capital] DPO query error:`, queryErr.message);
      dpoData = null;
    }
    
    // FORZAR valores por defecto si no hay datos
    const dpoValorRaw = dpoData?.dias_plazo_promedio;
    const hasDpoData = dpoValorRaw !== null && dpoValorRaw !== undefined && parseFloat(dpoValorRaw) > 0;
    
    console.log(`[working-capital] hasDpoData: ${hasDpoData}, valor: ${dpoValorRaw}`);
    
    if (!hasDpoData) {
      console.log(`[working-capital] Using DEFAULT DPO values`);
      dpoData = {
        dias_plazo_promedio: 30,
        total_facturas: 0,
        monto_vencido: 0
      };
    }
    
    const dpo = {
      dias_plazo: Math.round(parseFloat(dpoData?.dias_plazo_promedio) || 30),
      dias_real: Math.round(parseFloat(dpoData?.dias_plazo_promedio) || 30),
      benchmark_sector: 45,
      monto_vencido: parseFloat(dpoData?.monto_vencido) || 0
    };
    
    console.log(`[working-capital] DPO final:`, dpo);
    
    // ===== DIO (Days Inventory Outstanding) =====
    const dio = {
      valor: 45,
      benchmark_sector: 40,
      nota: 'Requiere datos de inventario para cálculo real'
    };
    
    // ===== C2C (Cash Conversion Cycle) =====
    const c2c = dio.valor + dso.valor - dpo.dias_real;
    const c2cBenchmark = dio.benchmark_sector + dso.benchmark_sector - dpo.benchmark_sector;
    
    console.log(`[working-capital] C2C calculation: ${dio.valor} + ${dso.valor} - ${dpo.dias_real} = ${c2c}`);
    
    // ===== Tendencias históricas =====
    const tendencias = [];
    
    // ===== Recomendaciones =====
    const recomendaciones = [];
    
    if (dso.valor > dso.benchmark_sector) {
      recomendaciones.push({
        tipo: 'dso_reduccion',
        titulo: `Reducir días de cobro`,
        descripcion: `DSO actual (${dso.valor} días) vs benchmark (${dso.benchmark_sector} días)`,
        prioridad: 'alta'
      });
    }
    
    if (c2c > c2cBenchmark) {
      recomendaciones.push({
        tipo: 'c2c_optimizacion',
        titulo: `Optimizar Cash Conversion Cycle`,
        descripcion: `C2C actual (${c2c} días) vs óptimo (${c2cBenchmark} días)`,
        prioridad: 'alta'
      });
    }
    
    console.log(`[working-capital] Preparing response...`);
    
    const respuesta = {
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo_analisis: `${periodoMeses} meses`,
        metricas_principales: {
          dso: {
            nombre: 'Days Sales Outstanding',
            descripcion: 'Días promedio de cobro',
            valor: dso.valor,
            unidad: 'días',
            benchmark: dso.benchmark_sector,
            diferencia_benchmark: dso.valor - dso.benchmark_sector,
            status: dso.valor <= dso.benchmark_sector ? 'optimo' : dso.valor <= dso.benchmark_sector + 10 ? 'atencion' : 'critico',
            monto_vencido: dso.monto_vencido,
            porcentaje_vencido: parseFloat(dso.porcentaje_vencido)
          },
          dpo: {
            nombre: 'Days Payable Outstanding',
            descripcion: 'Días promedio de pago a proveedores',
            dias_plazo: dpo.dias_plazo,
            dias_real: dpo.dias_real,
            unidad: 'días',
            benchmark: dpo.benchmark_sector,
            monto_vencido: dpo.monto_vencido
          },
          dio: {
            nombre: 'Days Inventory Outstanding',
            descripcion: 'Días de inventario',
            valor: dio.valor,
            unidad: 'días',
            benchmark: dio.benchmark_sector,
            nota: dio.nota
          },
          c2c: {
            nombre: 'Cash Conversion Cycle',
            descripcion: 'Ciclo de conversión de efectivo',
            valor: c2c,
            formula: 'DIO + DSO - DPO',
            detalle: `${dio.valor} + ${dso.valor} - ${dpo.dias_real} = ${c2c}`,
            unidad: 'días',
            interpretacion: c2c < 30 ? 'Excelente' : c2c < 60 ? 'Bueno' : c2c < 90 ? 'Regular' : 'Necesita atención',
            benchmark: c2cBenchmark
          }
        },
        tendencias_mensuales: tendencias,
        recomendaciones: recomendaciones,
        alertas: [],
        resumen_ejecutivo: {
          efectivo_atraso_cobro: dso.monto_vencido,
          oportunidad_optimizacion: 0,
          dias_efectivo_atrapado: c2c
        }
      },
      debug_info: {
        is_postgres: isPostgres,
        empresa_id: empresaId,
        dso_raw_query: hasDsoData,
        dpo_raw_query: hasDpoData
      }
    };
    
    console.log(`[working-capital] Response sent successfully`);
    res.json(respuesta);
    
  } catch (error) {
    console.error('[GET /working-capital] Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Error al calcular métricas de working capital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
