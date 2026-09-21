const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const { ejecutarTareasPendientesWakeUp } = require('../services/wakeUpScheduler');
const aiService = require('../services/aiService');
const agenteSQL = require('../services/agenteSQL');
const config = require('../config/financiera');

// GET /api/agents/version - Versión del código desplegado
router.get('/version', (req, res) => {
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const date = execSync('git log -1 --format=%cd').toString().trim();
    
    // Verificar contenido de CajaAgent.js
    const cajaAgentContent = require('fs').readFileSync(
      require('path').join(__dirname, '../../agents/CajaAgent.js'), 
      'utf8'
    ).substring(0, 300);
    
    res.json({
      commit,
      branch,
      date,
      cajaAgentSnippet: cajaAgentContent,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.json({ commit: 'unknown', error: e.message });
  }
});

// GET /api/agents/status - Estado del sistema de agentes programados
router.get('/status', async (req, res) => {
  try {
    const core = req.app.get('CFOAICore');
    
    if (!core) {
      return res.json({
        success: true,
        isRunning: false,
        message: 'abaco Core no inicializado aún'
      });
    }
    
    const status = core.getEstado();
    
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Agents API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/agents/execute - Ejecutar tarea manualmente
router.post('/execute', async (req, res) => {
  try {
    const { agente, tarea } = req.body;
    
    if (!agente || !tarea) {
      return res.status(400).json({ 
        error: 'Se requiere agente y tarea' 
      });
    }

    const core = req.app.get('CFOAICore');
    
    if (!core) {
      return res.status(503).json({
        error: 'abaco Core no inicializado'
      });
    }

    const result = await core.ejecutarTarea(agente, tarea);
    
    res.json({
      success: true,
      agente,
      tarea,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Agents API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agents/logs
 * Obtiene el log de actividades de los agentes de IA
 */
router.get('/logs', async (req, res) => {
  try {
    const db = req.app.get('db');
    const empresaId = req.query.empresa_id || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const agente = req.query.agente;
    const categoria = req.query.categoria;
    const status = req.query.status;
    const dias = parseInt(req.query.dias) || 7;
    
    // Detectar si es PostgreSQL
    const isPostgres = !!db.pool;
    
    const dateFilter = `created_at >= NOW() - INTERVAL '${dias} days'`
    
    let query = `
      SELECT 
        id,
        agente_nombre,
        agente_tipo,
        agente_version,
        categoria,
        descripcion,
        detalles_json,
        entidad_tipo,
        entidad_id,
        impacto_valor,
        impacto_moneda,
        resultado_status,
        created_at,
        duracion_ms
      FROM agentes_logs
      WHERE empresa_id = ? 
        AND ${dateFilter}
    `;
    
    const params = [empresaId];
    
    if (agente) {
      query += ` AND agente_tipo = ?`;
      params.push(agente);
    }
    
    if (categoria) {
      query += ` AND categoria = ?`;
      params.push(categoria);
    }
    
    if (status) {
      query += ` AND resultado_status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const logs = await db.allAsync(query, params);
    
    // Mapear snake_case a camelCase para el frontend
    const logsParsed = logs.map(log => ({
      id: log.id,
      agenteNombre: log.agente_nombre,
      agenteTipo: log.agente_tipo,
      agenteVersion: log.agente_version,
      categoria: log.categoria,
      descripcion: log.descripcion,
      detallesJson: log.detalles_json,
      detalles: (() => {
        try {
          return log.detalles_json ? JSON.parse(log.detalles_json) : null;
        } catch (e) {
          console.warn('[Agents Logs] Error parseando detalles_json:', e.message);
          return null;
        }
      })(),
      entidadTipo: log.entidad_tipo,
      entidadId: log.entidad_id,
      impactoValor: log.impacto_valor,
      impactoMoneda: log.impacto_moneda,
      resultadoStatus: log.resultado_status,
      fecha: log.created_at,
      duracionMs: log.duracion_ms
    }));
    
    // Obtener estadísticas
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT agente_tipo) as agentes_activos,
        SUM(CASE WHEN resultado_status = 'exitoso' THEN 1 ELSE 0 END) as exitosos,
        SUM(CASE WHEN resultado_status = 'error' THEN 1 ELSE 0 END) as errores,
        SUM(CASE WHEN resultado_status = 'advertencia' THEN 1 ELSE 0 END) as advertencias
      FROM agentes_logs
      WHERE empresa_id = ? 
        AND ${dateFilter}
    `;
    
    const stats = await db.getAsync(statsQuery, [empresaId]);
    
    // Agrupar por categoría
    const porCategoriaQuery = `
      SELECT 
        categoria,
        COUNT(*) as count
      FROM agentes_logs
      WHERE empresa_id = ? 
        AND ${dateFilter}
      GROUP BY categoria
      ORDER BY count DESC
    `;
    
    const porCategoria = await db.allAsync(porCategoriaQuery, [empresaId]);
    
    // Agrupar por agente
    const porAgenteQuery = `
      SELECT 
        agente_tipo as agente,
        agente_nombre as nombre,
        COUNT(*) as count
      FROM agentes_logs
      WHERE empresa_id = ? 
        AND ${dateFilter}
      GROUP BY agente_tipo, agente_nombre
      ORDER BY count DESC
    `;
    
    const porAgente = await db.allAsync(porAgenteQuery, [empresaId]);
    
    // Agrupar por status
    const porStatusQuery = `
      SELECT 
        resultado_status as status,
        COUNT(*) as count
      FROM agentes_logs
      WHERE empresa_id = ? 
        AND ${dateFilter}
      GROUP BY resultado_status
      ORDER BY count DESC
    `;
    
    const porStatus = await db.allAsync(porStatusQuery, [empresaId]);
    
    // Convertir porStatus a objeto
    const porStatusObj = porStatus.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        logs: logsParsed,
        estadisticas: {
          total: stats?.total || 0,
          agentesActivos: stats?.agentes_activos || 0,
          exitosos: stats?.exitosos || 0,
          errores: stats?.errores || 0,
          advertencias: stats?.advertencias || 0,
          porCategoria,
          porAgente,
          por_status: porStatusObj
        },
        pagination: {
          total: stats?.total || 0,
          limit,
          offset,
          hasMore: (offset + logs.length) < (stats?.total || 0)
        }
      }
    });
  } catch (error) {
    console.error('[GET /api/agents/logs] Error completo:', error);
    console.error('[GET /api/agents/logs] Stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener logs de agentes',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/agents/logs
 * Crear un nuevo log (usado internamente por los agentes)
 */
router.post('/logs', async (req, res) => {
  try {
    const db = req.app.get('db');
    const {
      empresa_id = config.default_empresa_id,
      agente_nombre,
      agente_tipo,
      agente_version = '1.0',
      categoria,
      descripcion,
      detalles,
      entidad_tipo,
      entidad_id,
      impacto_valor,
      impacto_moneda = 'GTQ',
      resultado_status = 'exito',
      duracion_ms
    } = req.body;
    
    const result = await db.runAsync(`
      INSERT INTO agentes_logs 
      (empresa_id, agente_nombre, agente_tipo, agente_version, categoria, descripcion, 
       detalles_json, entidad_tipo, entidad_id, impacto_valor, impacto_moneda, 
       resultado_status, duracion_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empresa_id,
      agente_nombre,
      agente_tipo,
      agente_version,
      categoria,
      descripcion,
      detalles ? JSON.stringify(detalles) : null,
      entidad_tipo,
      entidad_id,
      impacto_valor,
      impacto_moneda,
      resultado_status,
      duracion_ms
    ]);
    
    res.json({
      status: 'success',
      message: 'Log registrado exitosamente',
      log_id: result.lastID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[POST /api/agents/logs] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar log',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// CHAT ENDPOINT - abaco Assistant
// ============================================

/**
 * Obtiene contexto financiero COMPLETO de la empresa para el LLM
 * Incluye runway, CCC, KPIs, aging, proyecciones, obligaciones SAT, etc.
 * @param {Object} db - Database connection
 * @param {number} empresaId - ID de la empresa
 * @param {boolean} isPostgres - Si es PostgreSQL
 * @returns {Promise<Object>} - Contexto financiero completo
 */
async function obtenerContextoFinancieroCompleto(db, empresaId, isPostgres) {
  const ctx = {
    fecha_actual: new Date().toISOString().split('T')[0],
    empresa_id: empresaId
  };

  const runQuery = async (label, query, params = [empresaId]) => {
    const isSelectAll = query && query.trim().toLowerCase().startsWith('select') && !query.includes(' LIMIT ');
    try {
      const method = isSelectAll ? 'allAsync' : 'getAsync';
      const result = await db[method](query, params);
      return result;
    } catch (e) {
      console.error(`[Context] ${label} error:`, e.message);
      return isSelectAll ? [] : null;
    }
  };

  // === BANCOS / LIQUIDEZ ===
  const bancos = await runQuery('bancos', isPostgres
    ? `SELECT banco, saldo, moneda, tipo FROM cuentas_bancarias WHERE empresa_id = $1 AND activa = TRUE`
    : `SELECT banco, saldo, moneda, tipo FROM cuentas_bancarias WHERE empresa_id = ? AND activa = TRUE`
  );
  ctx.bancos = bancos || [];
  ctx.liquidez = {
    gtq: bancos?.reduce((s, c) => s + (c.moneda === 'GTQ' ? (parseFloat(c.saldo) || 0) : 0), 0) || 0,
    usd: bancos?.reduce((s, c) => s + (c.moneda === 'USD' ? (parseFloat(c.saldo) || 0) : 0), 0) || 0,
    total_cuentas: bancos?.length || 0
  };

  // === RUNWAY ===
  try {
    const gastoDiario = parseFloat(process.env.GASTO_DIARIO_DEFAULT) || 50000;
    const diasOperacion = Math.floor(ctx.liquidez.gtq / gastoDiario);
    ctx.runway = { dias: diasOperacion, gasto_diario_estimado: gastoDiario };
  } catch (e) { ctx.runway = { dias: 0, gasto_diario_estimado: 50000 }; }

  // === CxC ===
  const cxcResumen = await runQuery('cxc_resumen', isPostgres
    ? `SELECT COUNT(*) as count, SUM(monto_pendiente) as total, AVG(dias_atraso) as avg_dias FROM cuentas_cobrar WHERE empresa_id = $1 AND estado != 'cobrada'`
    : `SELECT COUNT(*) as count, SUM(monto) as total, AVG(dias_atraso) as avg_dias FROM cuentas_cobrar WHERE empresa_id = ? AND estado != 'cobrada'`
  );
  ctx.cxc = {
    total: parseFloat(cxcResumen?.total) || 0,
    facturas: parseInt(cxcResumen?.count) || 0,
    dias_promedio: Math.round(parseFloat(cxcResumen?.avg_dias) || 0)
  };

  const cxcAging = await runQuery('cxc_aging', isPostgres
    ? `SELECT CASE WHEN dias_atraso <= 0 THEN 'al_corriente' WHEN dias_atraso <= 30 THEN '1_30' WHEN dias_atraso <= 60 THEN '31_60' WHEN dias_atraso <= 90 THEN '61_90' ELSE '90_mas' END as bucket, COUNT(*) as cantidad, SUM(monto_pendiente) as monto FROM cuentas_cobrar WHERE empresa_id = $1 AND estado != 'cobrada' GROUP BY bucket`
    : `SELECT CASE WHEN dias_atraso <= 0 THEN 'al_corriente' WHEN dias_atraso <= 30 THEN '1_30' WHEN dias_atraso <= 60 THEN '31_60' WHEN dias_atraso <= 90 THEN '61_90' ELSE '90_mas' END as bucket, COUNT(*) as cantidad, SUM(monto) as monto FROM cuentas_cobrar WHERE empresa_id = ? AND estado != 'cobrada' GROUP BY bucket`
  );
  ctx.cxc.aging = cxcAging || [];

  const topDeudores = await runQuery('top_deudores', isPostgres
    ? `SELECT cliente_nombre as cliente, SUM(monto_pendiente) as monto, MAX(dias_atraso) as dias FROM cuentas_cobrar WHERE empresa_id = $1 AND estado != 'cobrada' GROUP BY cliente_nombre ORDER BY monto DESC LIMIT 5`
    : `SELECT cliente_nombre as cliente, SUM(monto) as monto, MAX(dias_atraso) as dias FROM cuentas_cobrar WHERE empresa_id = ? AND estado != 'cobrada' GROUP BY cliente_nombre ORDER BY monto DESC LIMIT 5`
  );
  ctx.cxc.top_deudores = topDeudores || [];

  // === CxP ===
  const cxpResumen = await runQuery('cxp_resumen', isPostgres
    ? `SELECT COUNT(*) as count, SUM(monto_total) as total FROM cuentas_pagar WHERE empresa_id = $1 AND estado = 'pendiente'`
    : `SELECT COUNT(*) as count, SUM(monto_pendiente) as total FROM cuentas_pagar WHERE empresa_id = ? AND estado = 'pendiente'`
  );
  ctx.cxp = {
    total: parseFloat(cxpResumen?.total) || 0,
    facturas: parseInt(cxpResumen?.count) || 0
  };

  const cxpProximos = await runQuery('cxp_proximos', isPostgres
    ? `SELECT proveedor_nombre as proveedor, monto_total as monto, fecha_vencimiento, (fecha_vencimiento::date - CURRENT_DATE)::integer as dias_restantes FROM cuentas_pagar WHERE empresa_id = $1 AND estado = 'pendiente' AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '14 days' ORDER BY fecha_vencimiento LIMIT 5`
    : `SELECT proveedor as proveedor, monto, fecha_vencimiento, CAST(((fecha_vencimiento::date - CURRENT_DATE)) AS INTEGER) as dias_restantes FROM cuentas_pagar WHERE empresa_id = ? AND estado = 'pendiente' AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '14 days' ORDER BY fecha_vencimiento LIMIT 5`
  );
  ctx.cxp.proximos_pagos = cxpProximos || [];

  // === CCC (Working Capital) ===
  const dsoData = await runQuery('dso', `SELECT COALESCE(AVG(dias_atraso), 35) as valor FROM cuentas_cobrar WHERE empresa_id = ?`);
  const dpoData = await runQuery('dpo', isPostgres
    ? `SELECT COALESCE(AVG(EXTRACT(DAY FROM (fecha_vencimiento - fecha_emision))), 30) as valor FROM cuentas_pagar WHERE empresa_id = $1`
    : `SELECT COALESCE(AVG(CAST(((fecha_vencimiento::date - fecha_emision::date)) AS INTEGER)), 30) as valor FROM cuentas_pagar WHERE empresa_id = ?`
  );
  const dso = Math.round(parseFloat(dsoData?.valor) || 35);
  const dpo = Math.round(parseFloat(dpoData?.valor) || 30);
  const dio = 45; // Placeholder hasta tener inventario real
  ctx.ccc = {
    dso, dpo, dio,
    valor: dio + dso - dpo,
    formula: 'DIO + DSO - DPO',
    interpretacion: (dio + dso - dpo) < 30 ? 'Excelente' : (dio + dso - dpo) < 60 ? 'Bueno' : (dio + dso - dpo) < 90 ? 'Regular' : 'Necesita atención'
  };

  // === VENTAS Y GASTOS (últimos 30 días) ===
  const ventas30 = await runQuery('ventas30', `SELECT COALESCE(SUM(monto), 0) as total FROM transacciones WHERE empresa_id = ? AND tipo = 'ingreso' AND fecha >= CURRENT_DATE - INTERVAL '30 days'`);
  const gastos30 = await runQuery('gastos30', `SELECT COALESCE(SUM(monto), 0) as total FROM transacciones WHERE empresa_id = ? AND tipo = 'gasto' AND fecha >= CURRENT_DATE - INTERVAL '30 days'`);
  ctx.ventas_30d = parseFloat(ventas30?.total) || 0;
  ctx.gastos_30d = parseFloat(gastos30?.total) || 0;
  ctx.margen_30d = ctx.ventas_30d > 0 ? ((ctx.ventas_30d - ctx.gastos_30d) / ctx.ventas_30d * 100).toFixed(1) : 0;

  // === OBLIGACIONES SAT ===
  const satQuery = isPostgres
    ? `SELECT tipo, periodo, fecha_vencimiento FROM sat_calendario WHERE fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days' ORDER BY fecha_vencimiento LIMIT 3`
    : `SELECT tipo, periodo, fecha_vencimiento FROM sat_calendario WHERE fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days' ORDER BY fecha_vencimiento LIMIT 3`;
  ctx.obligaciones_sat = await runQuery('sat', satQuery, []) || [];

  // === TRANSACCIONES RECIENTES ===
  const transRecientes = await runQuery('trans_recientes', `SELECT fecha, descripcion, monto, tipo, categoria FROM transacciones WHERE empresa_id = ? ORDER BY fecha DESC LIMIT 10`);
  ctx.transacciones_recientes = transRecientes || [];

  return ctx;
}

/**
 * POST /api/agents/chat
 * Endpoint principal para el chat del abaco Assistant
 * Usa LLM (Claude 3.7 Sonnet via OpenRouter) como motor principal
 * con contexto financiero completo de la base de datos.
 */
router.post('/chat', async (req, res) => {
  try {
    const db = req.app.get('db');
    const empresaId = req.body.empresa_id || 1;
    const message = req.body.message;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Se requiere un mensaje' });
    }
    
    const messageLower = message.toLowerCase().trim();
    
    console.log('[Chat] Request body:', JSON.stringify(req.body));
    console.log('[Chat] DB connected:', !!db);
    console.log('[Chat] OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
    
    // ========== FAST PATH: Saludos y ayuda (no necesitan LLM) ==========
    const greetings = ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'qué tal', 'cómo estás'];
    const isGreeting = greetings.some(g => messageLower.includes(g));
    
    if (isGreeting) {
      const hour = new Date().getHours();
      let saludo = hour < 12 ? '¡Buenos días' : hour < 18 ? '¡Buenas tardes' : '¡Buenas noches';
      return res.json({
        success: true,
        response: {
          content: `${saludo}! Soy **abaco**, tu asistente financiero inteligente. 🤖💼\n\nPuedo ayudarte con cualquier consulta sobre tus finanzas: runway, KPIs, CCC, cobranzas, pagos, obligaciones SAT, análisis de rentabilidad, y más.\n\n¿Qué necesitas saber hoy?`,
          agent: 'abaco Core',
          type: 'welcome'
        }
      });
    }
    
    if (messageLower.includes('ayuda') || messageLower.includes('help') || messageLower.includes('qué puedes hacer') || messageLower.includes('menú') || messageLower.includes('opciones')) {
      return res.json({
        success: true,
        response: {
          content: `📚 **Puedo ayudarte con cualquier tema financiero:**\n\n• 💰 **Runway** — Días de efectivo disponible\n• 📈 **KPIs** — Indicadores financieros clave\n• 🔄 **CCC** — Cash Conversion Cycle\n• 👥 **CxC** — Cuentas por cobrar y deudores\n• 💳 **CxP** — Pagos a proveedores\n• 🏦 **Conciliación** — Estado bancario\n• 📅 **SAT** — Obligaciones fiscales\n• 📊 **Rentabilidad** — Margen, utilidad, análisis\n• 🔍 **Auditoría** — Detección de anomalías\n\nSolo pregúntame lo que necesites. Tengo acceso en tiempo real a tu base de datos.`,
          agent: 'abaco Core',
          type: 'help'
        }
      });
    }
    
    const goodbyes = ['adiós', 'chao', 'hasta luego', 'bye', 'nos vemos', 'gracias por todo'];
    if (goodbyes.some(g => messageLower.includes(g))) {
      return res.json({
        success: true,
        response: {
          content: `¡Hasta luego! Estaré aquí cuando necesites ayuda con tus finanzas. 📊`,
          agent: 'abaco Core',
          type: 'goodbye'
        }
      });
    }
    
    // ========== MOTOR PRINCIPAL: LLM + Contexto Completo ==========
    console.log('[Chat] Consulta:', message);
    
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');
    console.log('[Chat] isPostgres:', isPostgres);
    
    // Obtener contexto financiero completo
    console.log('[Chat] Obteniendo contexto financiero...');
    const contexto = await obtenerContextoFinancieroCompleto(db, empresaId, isPostgres);
    console.log('[Chat] Contexto obtenido. Keys:', Object.keys(contexto).join(', '));
    
    // Verificar API key configurada
    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log('[Chat] API key check - exists:', !!apiKey, 'length:', apiKey?.length);
    
    if (!apiKey || apiKey.includes('placeholder') || apiKey.includes('tu-api-key')) {
      console.error('[Chat] API key no configurada');
      return res.status(503).json({
        success: false,
        error: 'OPENROUTER_API_KEY no configurada en el servidor.'
      });
    }
    
    // Llamar al LLM con el contexto completo
    try {
      const respuestaIA = await aiService.conversar(message, contexto);
      
      return res.json({
        success: true,
        response: {
          content: respuestaIA,
          agent: 'abaco Core',
          type: 'ai_response',
          meta: {
            fecha_contexto: contexto.fecha_actual,
            datos_disponibles: Object.keys(contexto).filter(k => k !== 'fecha_actual' && k !== 'empresa_id')
          }
        }
      });
    } catch (llmError) {
      console.error('[Chat] Error LLM:', llmError.message);
      
      // Fallback: respuesta con datos locales
      return res.json({
        success: true,
        response: {
          content: `Tengo los datos disponibles pero el asistente de IA está teniendo problemas técnicos momentáneamente.\n\n**Contexto actual:**\n• Efectivo GTQ: Q${(contexto.liquidez?.gtq || 0).toLocaleString()}\n• CxC pendiente: Q${(contexto.cxc?.total || 0).toLocaleString()} (${contexto.cxc?.facturas || 0} facturas)\n• CxP pendiente: Q${(contexto.cxp?.total || 0).toLocaleString()}\n• CCC: ${contexto.ccc?.valor || 0} días\n• Runway: ${contexto.runway?.dias || 0} días\n\nPor favor intenta de nuevo en unos segundos.`,
          agent: 'abaco Core',
          type: 'error'
        }
      });
    }
    
  } catch (error) {
    console.error('[POST /api/agents/chat] Error:', error);
    console.error('[POST /api/agents/chat] Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el mensaje',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/agents/chat-agente
 *
 * El agente que consulta la base de datos escribiendo su propio SQL.
 * A diferencia de /chat (que arma un contexto fijo antes de preguntar),
 * aqui el modelo decide que consultar, ejecuta, se corrige si falla, y
 * devuelve texto + bloques visuales referenciados a los datos reales.
 */
router.post('/chat-agente', async (req, res) => {
  const t0 = Date.now();
  const { message, historial } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, error: 'Se requiere un mensaje' });
  }

  try {
    const r = await agenteSQL.correr(String(message).trim(), {
      historial: Array.isArray(historial) ? historial.slice(-6) : []
    });

    // Traza: cada respuesta queda con el SQL que la produjo.
    try {
      const db = req.app.get('db');
      if (db) {
        await db.runAsync(
          `INSERT INTO agentes_logs (agente_nombre, agente_tipo, categoria, descripcion,
             detalles_json, resultado_status, duracion_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['AgenteSQL', 'conversational_sql', 'consulta',
           String(message).slice(0, 500),
           JSON.stringify({ consultas: r.consultas, pasos: r.pasos, meta: r.meta }).slice(0, 9000),
           'exitoso', r.meta.ms]
        );
      }
    } catch (e) {
      console.warn('[chat-agente] no se pudo registrar en agentes_logs:', e.message);
    }

    return res.json({
      success: true,
      response: {
        content: r.texto,
        bloques: r.bloques,
        agent: 'abaco Agente SQL',
        type: 'agente_sql',
        // Trazabilidad: el usuario puede ver de donde salio cada numero.
        consultas: r.consultas,
        pasos: r.pasos,
        meta: r.meta
      }
    });

  } catch (error) {
    console.error('[POST /api/agents/chat-agente] Error:', error.message);
    const faltaConfig = /OPENROUTER_API_KEY|DATABASE_URL_READONLY|schema "analitica"/.test(error.message);
    return res.status(faltaConfig ? 503 : 500).json({
      success: false,
      error: faltaConfig ? error.message : 'Error al procesar la consulta',
      details: error.message,
      ms: Date.now() - t0
    });
  }
});

/**
 * GET /api/agents/chat-agente/salud
 * Verifica que el agente tenga todo lo que necesita antes de usarlo.
 */
router.get('/chat-agente/salud', async (req, res) => {
  const dbAgente = require('../services/dbAgente');
  const out = {
    openrouter_key: !!process.env.OPENROUTER_API_KEY,
    readonly_url: !!process.env.DATABASE_URL_READONLY,
    usuario_correcto: (process.env.DATABASE_URL_READONLY || '').includes('agente_ia'),
    modelo: agenteSQL.MODELO,
    capa_semantica: false,
    vistas: []
  };
  try {
    const cat = await dbAgente.getCatalogo();
    out.capa_semantica = cat.length > 0;
    out.vistas = cat.map(v => v.vista);
    out.vistas_documentadas = cat.filter(v => v.descripcion).length;
  } catch (e) {
    out.error = e.message;
  }
  out.listo = out.openrouter_key && out.readonly_url && out.usuario_correcto && out.capa_semantica;
  res.status(out.listo ? 200 : 503).json(out);
});

// ============================================
// ENDPOINTS PARA TAREAS PROGRAMADAS (SCHEDULER)
// ============================================

/**
 * GET /api/agents/ia/status
 * Obtiene el estado actual de los agentes de IA
 */
router.get('/ia/status', async (req, res) => {
  try {
    const core = req.app.get('CFOAICore');
    
    if (!core) {
      return res.json({
        success: true,
        estado: 'no_inicializado',
        mensaje: 'abaco Core no iniciado',
        agentes: [],
        timestamp: new Date().toISOString()
      });
    }
    
    const estado = core.getEstado();
    
    res.json({
      success: true,
      ...estado,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Agents IA API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agents/ia/execute
 * Ejecutar tarea manual de agente de IA
 */
router.post('/ia/execute', async (req, res) => {
  try {
    const { agente, tarea } = req.body;
    
    if (!agente || !tarea) {
      return res.status(400).json({ 
        success: false,
        error: 'Se requiere agente y tarea' 
      });
    }

    const core = req.app.get('CFOAICore');
    
    if (!core) {
      return res.status(503).json({
        success: false,
        error: 'abaco Core no inicializado'
      });
    }

    const resultado = await core.ejecutarTarea(agente, tarea);
    
    res.json({
      success: true,
      ...resultado,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Agents IA API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agents/ia/alertas
 * Obtiene alertas financieras detectadas por IA
 */
router.get('/ia/alertas', async (req, res) => {
  try {
    const db = req.app.get('db');
    const limit = parseInt(req.query.limit) || 50;
    const estado = req.query.estado || 'activa';
    const nivel = req.query.nivel;
    
    let query = `SELECT * FROM alertas_financieras WHERE estado = ?`;
    const params = [estado];
    
    if (nivel) {
      query += ` AND nivel = ?`;
      params.push(nivel);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const alertas = await db.allAsync(query, params);
    
    // Parsear metadata
    const alertasParsed = alertas.map(a => ({
      ...a,
      metadata: a.metadata ? JSON.parse(a.metadata) : null
    }));
    
    res.json({
      success: true,
      data: alertasParsed,
      count: alertasParsed.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Agents IA API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agents/ia/briefing
 * Obtiene el briefing diario generado por IA
 */
router.get('/ia/briefing', async (req, res) => {
  try {
    const db = req.app.get('db');
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    
    const briefing = await db.getAsync(
      `SELECT * FROM briefings_diarios WHERE fecha = ?`,
      [fecha]
    );
    
    if (!briefing) {
      return res.json({
        success: true,
        data: null,
        mensaje: 'No hay briefing para la fecha solicitada'
      });
    }
    
    res.json({
      success: true,
      data: {
        ...briefing,
        insights: briefing.insights_json ? JSON.parse(briefing.insights_json) : []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Agents IA API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === DIAGNÓSTICO LLM ===
// Endpoint para verificar si OpenRouter funciona con la key configurada
router.get('/diagnostico-llm', async (req, res) => {
  try {
    const result = await aiService.llamarLLM(
      [{ role: 'user', content: 'Responde "OK" en una palabra.' }],
      { jsonMode: false }
    );
    res.json({
      success: true,
      model: result.model,
      content: result.choices[0].message.content,
      usage: result.usage
    });
  } catch (error) {
    res.json({
      success: false,
      status: error.response?.status,
      code: error.response?.data?.error?.code,
      message: error.response?.data?.error?.message || error.message,
      key_configured: !!process.env.OPENROUTER_API_KEY,
      key_prefix: process.env.OPENROUTER_API_KEY?.substring(0, 15) + '...'
    });
  }
});

module.exports = router;
