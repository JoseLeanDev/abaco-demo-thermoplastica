const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// Detectar PostgreSQL
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const empresaId = req.query.empresa_id || 2; // Default: Thermoplástica, S.A.
    
    // DEBUG: Log que el endpoint se ejecutó
    console.log('Dashboard endpoint called at', new Date().toISOString());
    
    // KPIs de tesorería
    const posicionBancaria = await db.getAsync(`
      SELECT 
        SUM(CASE WHEN moneda = 'GTQ' THEN saldo ELSE 0 END) as total_gtq,
        SUM(CASE WHEN moneda = 'USD' THEN saldo ELSE 0 END) as total_usd,
        COUNT(*) as num_cuentas
      FROM cuentas_bancarias 
      WHERE empresa_id = ? AND activa = TRUE
    `, [empresaId]);

    // CxC resumen - usar nombres de columnas PostgreSQL
    const cxcResumen = await db.getAsync(`
      SELECT 
        SUM(monto_total) as total_cxc,
        SUM(CASE WHEN dias_atraso > 30 THEN monto_total ELSE 0 END) as vencido,
        AVG(dias_atraso) as promedio_dias
      FROM cuentas_cobrar 
      WHERE empresa_id = ? AND estado != 'cobrada'
    `, [empresaId]);

    // CxP resumen - usar nombres de columnas PostgreSQL
    const cxpResumen = await db.getAsync(`
      SELECT 
        SUM(monto_total) as total_cxp,
        SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN monto_total ELSE 0 END) as vencido
      FROM cuentas_pagar 
      WHERE empresa_id = ? AND estado = 'pendiente'
    `, [empresaId]);

    // Ventas del mes - usar TO_CHAR para PostgreSQL
    const ventasMes = await db.getAsync(`
      SELECT SUM(monto) as total
      FROM transacciones 
      WHERE empresa_id = ? 
        AND tipo = 'entrada' 
        AND TO_CHAR(fecha, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    `, [empresaId]);

    // Promedios de los últimos 6 meses para runway calculator
    const mesesHistoricos = await db.allAsync(`
      SELECT 
        TO_CHAR(fecha, 'YYYY-MM') as mes,
        SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'salida' THEN monto ELSE 0 END) as gastos
      FROM transacciones 
      WHERE empresa_id = ? 
        AND fecha >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(fecha, 'YYYY-MM')
    `, [empresaId]);
    
    const avgIngresos = mesesHistoricos.length > 0 
      ? mesesHistoricos.reduce((sum, m) => sum + (parseFloat(m.ingresos) || 0), 0) / mesesHistoricos.length 
      : (ventasMes?.total || 0);
    const avgGastos = mesesHistoricos.length > 0 
      ? mesesHistoricos.reduce((sum, m) => sum + (parseFloat(m.gastos) || 0), 0) / mesesHistoricos.length 
      : 0;

    // Alertas activas
    const alertas = [];

    // Alerta: CxC vencido alto
    const cxcVencidoAlto = await db.getAsync(`
      SELECT SUM(monto_total) as total
      FROM cuentas_cobrar
      WHERE empresa_id = ? AND dias_atraso > 30
    `, [empresaId]);
    
    if (cxcVencidoAlto?.total > 100000) {
      alertas.push({
        tipo: 'cxc_vencido',
        nivel: 'advertencia',
        mensaje: `CxC vencido > 30 días: Q${parseFloat(cxcVencidoAlto.total).toLocaleString()}`,
        monto: parseFloat(cxcVencidoAlto.total)
      });
    }

    // Alerta: Posición bancaria baja
    const totalGTQ = parseFloat(posicionBancaria?.total_gtq) || 0;
    const totalUSD = parseFloat(posicionBancaria?.total_usd) || 0;
    if (totalGTQ < 500000) {
      alertas.push({
        tipo: 'liquidez_baja',
        nivel: 'critico',
        mensaje: 'Posición bancaria GTQ por debajo de Q500,000',
        monto: totalGTQ
      });
    }

    // Cuentas bancarias detalle
    const cuentasBancarias = await db.allAsync(`
      SELECT banco, tipo, numero_cuenta as numero, saldo, moneda
      FROM cuentas_bancarias
      WHERE empresa_id = ? AND activa = TRUE
      ORDER BY saldo DESC
    `, [empresaId]);

    // Próximos vencimientos CxP
    const proximosVencimientos = await db.allAsync(`
      SELECT 
        proveedor_nombre as proveedor,
        factura_numero as factura,
        monto_total as monto,
        fecha_vencimiento
      FROM cuentas_pagar
      WHERE empresa_id = ? 
        AND estado = 'pendiente'
        AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '15 days'
      ORDER BY fecha_vencimiento
      LIMIT 5
    `, [empresaId]);

    // CxC por cobrar urgentemente
    const cxcUrgentes = await db.allAsync(`
      SELECT 
        cliente_nombre as cliente,
        factura_numero as factura,
        monto_total as monto,
        dias_atraso
      FROM cuentas_cobrar
      WHERE empresa_id = ? 
        AND estado = 'atrasada'
        AND dias_atraso > 30
      ORDER BY dias_atraso DESC
      LIMIT 5
    `, [empresaId]);

    // Calcular runway
    const runwayMeses = avgGastos > 0 ? Math.round((totalGTQ + totalUSD * 7.8) / avgGastos) : 0;

    // Calcular Working Capital Ratio
    const totalCxC = parseFloat(cxcResumen?.total_cxc) || 0;
    const totalCxP = parseFloat(cxpResumen?.total_cxp) || 0;
    const workingCapitalRatio = totalCxP > 0 ? (totalCxC / totalCxP).toFixed(2) : '0.00';

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        // Posición tesorería
        tesoreria: {
          total_gtq: totalGTQ,
          total_usd: totalUSD,
          total_usd_gtq: totalUSD * 7.8, // Tipo de cambio aproximado
          total_general: totalGTQ + totalUSD * 7.8,
          num_cuentas: posicionBancaria?.num_cuentas || 0,
          cuentas: (cuentasBancarias || []).map(c => ({
            ...c,
            saldo: parseFloat(c.saldo) || 0
          }))
        },
        // CxC
        cxc: {
          total: totalCxC,
          vencido: parseFloat(cxcResumen?.vencido) || 0,
          promedio_dias: Math.round(parseFloat(cxcResumen?.promedio_dias) || 0),
          urgentes: (cxcUrgentes || []).map(c => ({
            ...c,
            monto: parseFloat(c.monto) || 0
          }))
        },
        // CxP
        cxp: {
          total: totalCxP,
          vencido: parseFloat(cxpResumen?.vencido) || 0,
          proximos_vencimientos: (proximosVencimientos || []).map(p => ({
            ...p,
            monto: parseFloat(p.monto) || 0
          }))
        },
        // Métricas operativas
        operacion: {
          ventas_mes: parseFloat(ventasMes?.total) || 0,
          avg_ingresos_mes: Math.round(avgIngresos),
          avg_gastos_mes: Math.round(avgGastos),
          avg_utilidad_mes: Math.round(avgIngresos - avgGastos),
          runway_meses: runwayMeses,
          working_capital_ratio: parseFloat(workingCapitalRatio)
        },
        // Alertas
        alertas: alertas,
        // Resumen ejecutivo
        resumen: {
          working_capital: totalCxC - totalCxP,
          posicion_neta: (totalGTQ + totalUSD * 7.8) + totalCxC - totalCxP,
          salud_financiera: runwayMeses >= 6 ? 'buena' : runwayMeses >= 3 ? 'regular' : 'critica'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en dashboard:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error cargando dashboard: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
