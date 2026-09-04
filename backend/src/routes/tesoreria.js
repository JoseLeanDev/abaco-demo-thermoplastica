const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const config = require('../config/financiera');

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

// GET /api/tesoreria/posicion
router.get('/posicion', async (req, res) => {
  try {
    const empresaId = req.query.empresa_id || 2; // Default: Thermoplástica, S.A.
    
    // Usar DISTINCT para eliminar duplicados de la BD
    const cuentas = await db.allAsync(`
      SELECT DISTINCT
        banco,
        tipo,
        saldo,
        moneda,
        ${isPostgres ? 'NULL' : "(CURRENT_DATE - ultima_conciliacion::date)"} as dias_sin_conciliar
      FROM cuentas_bancarias 
      WHERE empresa_id = ? AND activa = TRUE
      ORDER BY saldo DESC
    `, [empresaId]);

    const totales = await db.getAsync(`
      SELECT 
        SUM(CASE WHEN moneda = 'GTQ' THEN saldo ELSE 0 END) as total_gtq,
        SUM(CASE WHEN moneda = 'USD' THEN saldo ELSE 0 END) as total_usd
      FROM cuentas_bancarias 
      WHERE empresa_id = ? AND activa = TRUE
    `, [empresaId]);

    const tipoCambio = 7.75;
    const totalGTQ = parseFloat(totales.total_gtq) || 0;
    const totalUSD = parseFloat(totales.total_usd) || 0;
    const totalConsolidado = totalGTQ + totalUSD * tipoCambio;
    const diasOperacion = Math.floor(totalGTQ / config.liquidez.dias_operacion_default);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        fecha_corte: new Date().toISOString().split('T')[0],
        total_disponible_gtq: totalGTQ,
        total_disponible_usd: totalUSD,
        tipo_cambio: tipoCambio,
        total_consolidado_gtq: totalConsolidado,
        dias_operacion: diasOperacion,
        cuentas: cuentas.map(c => ({
          ...c,
          saldo: parseFloat(c.saldo) || 0,
          dias_sin_conciliar: Math.floor(c.dias_sin_conciliar || 0)
        }))
      },
      ui_components: {
        cards: 'bank_account_cards',
        total_card: 'consolidated_position',
        gauge: {
          type: 'liquidity_days',
          value: diasOperacion,
          min: 0,
          max: 90,
          thresholds: { danger: 15, warning: 30, good: 45 }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxc
// Resumen de cartera vigente + aging + top 5 deudores.
// Fuente: thermoplastica.fact_cxc_snapshot_diario (snapshot del día más reciente).
router.get('/cxc', async (req, res) => {
  try {
    const distribucion = await db.getAsync(`
      SELECT
        COALESCE(SUM(porvencer), 0)                                       AS al_corriente,
        COALESCE(SUM(v30), 0)                                             AS _30_dias,
        COALESCE(SUM(v31a60), 0)                                          AS _60_dias,
        COALESCE(SUM(v61a90) + SUM(v91a120) + SUM(v120), 0)               AS _90_dias,
        COALESCE(SUM(saldo_total), 0)                                     AS total,
        COUNT(*)                                                          AS facturas
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (
        SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario
      )
    `);

    const topDeudores = await db.allAsync(`
      SELECT
        c.codigo_cliente                                                  AS codigo,
        c.nombre                                                          AS cliente,
        SUM(f.saldo_total)                                                AS monto,
        SUM(f.vencido)                                                    AS vencido,
        MAX(GREATEST((CURRENT_DATE - f.fecha_vencimiento)::int, 0))       AS dias
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE f.fecha_snapshot = (
        SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario
      )
      GROUP BY c.codigo_cliente, c.nombre
      ORDER BY monto DESC
      LIMIT 5
    `);

    const promedio = await db.getAsync(`
      SELECT AVG(GREATEST((CURRENT_DATE - fecha_vencimiento)::int, 0))    AS promedio
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (
        SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario
      )
    `);

    const total = parseFloat(distribucion.total) || 1;
    const pct = (v) => parseFloat(((parseFloat(v) || 0) / total * 100).toFixed(1));

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        total_cxc: parseFloat(distribucion.total) || 0,
        facturas: parseInt(distribucion.facturas) || 0,
        promedio_dias_cobro: Math.round(parseFloat(promedio.promedio) || 0),
        distribucion_aging: {
          al_corriente: { monto: parseFloat(distribucion.al_corriente) || 0, porcentaje: pct(distribucion.al_corriente) },
          _30_dias:     { monto: parseFloat(distribucion._30_dias)     || 0, porcentaje: pct(distribucion._30_dias) },
          _60_dias:     { monto: parseFloat(distribucion._60_dias)     || 0, porcentaje: pct(distribucion._60_dias) },
          _90_dias:     { monto: parseFloat(distribucion._90_dias)     || 0, porcentaje: pct(distribucion._90_dias) }
        },
        top_deudores: topDeudores.map(d => ({
          codigo: d.codigo,
          cliente: d.cliente,
          monto: parseFloat(d.monto) || 0,
          vencido: parseFloat(d.vencido) || 0,
          dias: parseInt(d.dias) || 0
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxc/detalle
// Listado paginado de facturas de la cartera vigente.
// Query params: ?limit=200&offset=0&busqueda=&bucket=
//   bucket ∈ 'al_corriente' | '_30_dias' | '_60_dias' | '_90_dias' | 'todos'
router.get('/cxc/detalle', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit)  || 200, 1000);
    const offset = parseInt(req.query.offset)         || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const bucket = req.query.bucket || 'todos';

    const where = [`f.fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)`];
    const params = [];

    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(c.nombre ILIKE ${p} OR c.codigo_cliente ILIKE ${p} OR f.documento::text ILIKE ${p})`);
    }
    if (bucket === 'al_corriente') where.push(`f.porvencer > 0 AND COALESCE(f.vencido, 0) = 0`);
    else if (bucket === '_30_dias') where.push(`f.v30 > 0`);
    else if (bucket === '_60_dias') where.push(`f.v31a60 > 0`);
    else if (bucket === '_90_dias') where.push(`(f.v61a90 > 0 OR f.v91a120 > 0 OR f.v120 > 0)`);

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`
      SELECT
        f.snapshot_id                                                     AS id,
        c.codigo_cliente                                                  AS codigo_cliente,
        c.nombre                                                          AS cliente,
        c.forma_pago                                                      AS forma_pago,
        s.codigo_sucursal                                                 AS codigo_sucursal,
        s.nombre                                                          AS sucursal,
        v.nombre                                                          AS vendedor,
        f.tipo_documento                                                  AS tipo_documento,
        f.documento                                                       AS documento,
        f.fecha_emision                                                   AS fecha_emision,
        f.fecha_vencimiento                                               AS fecha_vencimiento,
        GREATEST((CURRENT_DATE - f.fecha_vencimiento)::int, 0)            AS dias_atraso,
        f.saldo_total                                                     AS saldo_total,
        f.porvencer                                                       AS porvencer,
        f.vencido                                                         AS vencido,
        f.v30, f.v31a60, f.v61a90, f.v91a120, f.v120,
        f.estado_cxc                                                      AS estado_cxc
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente   c ON c.cliente_id  = f.cliente_id
      JOIN thermoplastica.dim_sucursal  s ON s.sucursal_id = f.sucursal_id
      LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
      WHERE ${whereSql}
      ORDER BY f.saldo_total DESC, f.fecha_vencimiento ASC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const totalRow = await db.getAsync(`
      SELECT COUNT(*) AS total, COALESCE(SUM(f.saldo_total), 0) AS suma_saldo
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE ${whereSql}
    `, params);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        total_filas: parseInt(totalRow.total) || 0,
        suma_saldo: parseFloat(totalRow.suma_saldo) || 0,
        filas: rows.map(r => ({
          id: parseInt(r.id),
          codigo_cliente: r.codigo_cliente,
          cliente: r.cliente,
          forma_pago: r.forma_pago,
          codigo_sucursal: r.codigo_sucursal,
          sucursal: r.sucursal,
          vendedor: r.vendedor,
          tipo_documento: r.tipo_documento,
          documento: r.documento?.toString(),
          fecha_emision: r.fecha_emision,
          fecha_vencimiento: r.fecha_vencimiento,
          dias_atraso: parseInt(r.dias_atraso) || 0,
          saldo_total: parseFloat(r.saldo_total) || 0,
          porvencer: parseFloat(r.porvencer) || 0,
          vencido: parseFloat(r.vencido) || 0,
          v30: parseFloat(r.v30) || 0,
          v31a60: parseFloat(r.v31a60) || 0,
          v61a90: parseFloat(r.v61a90) || 0,
          v91a120: parseFloat(r.v91a120) || 0,
          v120: parseFloat(r.v120) || 0,
          estado_cxc: r.estado_cxc
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxp
router.get('/cxp', async (req, res) => {
  try {
    const empresaId = req.query.empresa_id || 2; // Default: Thermoplástica, S.A.
    const dias = parseInt(req.query.proximos_dias) || 30;
    
    // Usar nombres de columnas PostgreSQL
    // Para PostgreSQL: fecha_vencimiento - CURRENT_DATE devuelve integer (días)
    const cxp = await db.allAsync(`
      SELECT 
        proveedor_nombre as proveedor,
        monto_total as monto,
        fecha_vencimiento,
        ${isPostgres ? '(fecha_vencimiento - CURRENT_DATE)::integer' : "CAST((fecha_vencimiento::date - CURRENT_DATE) AS INTEGER)"} as dias_restantes
      FROM cuentas_pagar 
      WHERE empresa_id = ? 
        AND estado = 'pendiente'
        AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '${dias} days'
      ORDER BY fecha_vencimiento
    `, [empresaId]);

    const total = await db.getAsync(`
      SELECT SUM(monto_total) as total, 
             AVG(${isPostgres ? '(fecha_vencimiento - CURRENT_DATE)::integer' : "CAST((fecha_vencimiento::date - CURRENT_DATE) AS INTEGER)"}) as promedio_dias
      FROM cuentas_pagar 
      WHERE empresa_id = ? AND estado = 'pendiente'
    `, [empresaId]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        total_cxp: parseFloat(total.total) || 0,
        promedio_dias_pago: Math.round(parseFloat(total.promedio_dias) || 0),
        proximos_pagos: cxp.map(p => ({
          ...p,
          monto: parseFloat(p.monto) || 0,
          dias_restantes: Math.ceil(parseFloat(p.dias_restantes)),
          ahorro_si_paga_hoy: 0
        }))
      },
      ui_components: {
        timeline: 'payment_timeline',
        table: 'cxp_schedule'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/proyeccion
router.get('/proyeccion', async (req, res) => {
  try {
    const semanas = parseInt(req.query.semanas) || config.proyecciones.semanas_proyeccion;
    const proyeccion = [];
    
    // Datos históricos para proyección
    const promedioEntrada = config.proyecciones.promedio_entrada_default;
    const promedioSalida = config.proyecciones.promedio_salida_default;
    let saldoAcumulado = config.proyecciones.saldo_inicial_default;

    for (let i = 1; i <= semanas; i++) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + (i * 7));
      
      const variacion = (Math.random() - 0.5) * 0.3; // ±15% variación
      const entradas = Math.round(promedioEntrada * (1 + variacion));
      const salidas = Math.round(promedioSalida * (1 + variacion * 0.5));
      const neto = entradas - salidas;
      saldoAcumulado += neto;

      proyeccion.push({
        semana: i,
        fecha_inicio: fecha.toISOString().split('T')[0],
        entradas,
        salidas,
        neto,
        saldo_acumulado: saldoAcumulado,
        certeza: i <= 4 ? 'alta' : i <= 8 ? 'media' : 'baja',
        alerta: saldoAcumulado < config.proyecciones.umbral_saldo_minimo ? 'Saldo crítico proyectado' : null
      });
    }

    const saldoMinimo = Math.min(...proyeccion.map(p => p.saldo_acumulado));
    const saldoMaximo = Math.max(...proyeccion.map(p => p.saldo_acumulado));
    const semanaCritica = proyeccion.find(p => p.saldo_acumulado === saldoMinimo)?.semana;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        proyeccion,
        resumen: {
          saldo_minimo_proyectado: saldoMinimo,
          saldo_maximo_proyectado: saldoMaximo,
          semana_critica: semanaCritica,
          riesgo_quiebra_tecnica: saldoMinimo < config.proyecciones.umbral_riesgo_quiebra
        }
      },
      ui_components: {
        chart_type: 'cashflow_waterfall'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
