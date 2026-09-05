const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const config = require('../config/financiera');

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

// GET /api/tesoreria/posicion
// Vista de working capital / posición neta.
// Bancos no están disponibles en el ERP TP_A actual — se reportan como N/D.
router.get('/posicion', async (req, res) => {
  try {
    // 1. Cuentas por cobrar (snapshot vivo)
    const cxc = await db.getAsync(`
      SELECT
        COALESCE(SUM(saldo_total), 0) AS total,
        COALESCE(SUM(porvencer), 0)   AS por_vencer,
        COALESCE(SUM(vencido), 0)     AS vencido,
        COUNT(*)                      AS documentos,
        AVG(GREATEST((CURRENT_DATE - fecha_vencimiento)::int, 0)) AS dias_promedio_vencido
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)
    `);

    // 2. Cuentas por pagar (proxy: MAX(saldo) por factura de compras, saldo > 0)
    //    El saldo en vstCompras se repite en cada línea → agregamos por factura.
    const cxp = await db.getAsync(`
      WITH facturas AS (
        SELECT fact_num, proveedor_id,
               MAX(fecha_emision)               AS fecha_emision,
               MAX(saldo)                       AS saldo,
               MAX(fecha_emision) + INTERVAL '30 days' AS fecha_vencimiento_est
        FROM thermoplastica.fact_compras_linea
        GROUP BY fact_num, proveedor_id
      )
      SELECT
        COALESCE(SUM(saldo), 0)            AS total,
        COUNT(*)                           AS facturas,
        COUNT(DISTINCT proveedor_id)       AS proveedores,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento_est >= CURRENT_DATE), 0) AS por_vencer,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento_est <  CURRENT_DATE), 0) AS vencido,
        AVG(GREATEST((CURRENT_DATE - fecha_vencimiento_est::date)::int, 0)) AS dias_promedio_vencido
      FROM facturas
      WHERE saldo > 0;
    `);

    const cxcTotal = parseFloat(cxc.total) || 0;
    const cxpTotal = parseFloat(cxp.total) || 0;
    const posicionNeta = cxcTotal - cxpTotal;
    const cobertura = cxpTotal > 0 ? cxcTotal / cxpTotal : null;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        fecha_corte: new Date().toISOString().split('T')[0],
        bancos: {
          disponible: false,
          nota: 'El ERP TP_A no expone saldos bancarios. Solicitar vista de cuentas bancarias al cliente para completar la posición.',
        },
        cxc: {
          total: cxcTotal,
          por_vencer: parseFloat(cxc.por_vencer) || 0,
          vencido: parseFloat(cxc.vencido) || 0,
          documentos: parseInt(cxc.documentos) || 0,
          dias_promedio_vencido: Math.round(parseFloat(cxc.dias_promedio_vencido) || 0),
        },
        cxp: {
          total: cxpTotal,
          por_vencer: parseFloat(cxp.por_vencer) || 0,
          vencido: parseFloat(cxp.vencido) || 0,
          facturas: parseInt(cxp.facturas) || 0,
          proveedores: parseInt(cxp.proveedores) || 0,
          dias_promedio_vencido: Math.round(parseFloat(cxp.dias_promedio_vencido) || 0),
          nota: 'Estimación del vencimiento a 30 días desde la emisión (el ERP no expone fecha de vencimiento en compras).',
        },
        posicion_neta_working_capital: posicionNeta,
        ratio_cobertura_cxc_cxp: cobertura,
      },
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
// Proxy de CxP construido desde vstCompras: MAX(saldo) por factura, > 0.
// Vencimiento estimado a 30 días desde emisión (el ERP no expone fecha_venc).
router.get('/cxp', async (req, res) => {
  try {
    const dias = parseInt(req.query.proximos_dias) || 30;

    const resumen = await db.getAsync(`
      WITH facturas AS (
        SELECT fact_num, proveedor_id, MAX(fecha_emision) AS fecha_emision, MAX(saldo) AS saldo
        FROM thermoplastica.fact_compras_linea
        GROUP BY fact_num, proveedor_id
      )
      SELECT
        COALESCE(SUM(saldo), 0)                                              AS total,
        COUNT(*)                                                             AS facturas,
        COUNT(DISTINCT proveedor_id)                                         AS proveedores,
        AVG(GREATEST((CURRENT_DATE - (fecha_emision + INTERVAL '30 days')::date)::int, 0)) AS promedio_dias
      FROM facturas
      WHERE saldo > 0
    `);

    // Aging: por antigüedad de emisión (ya que no hay fecha_vencimiento real)
    const aging = await db.getAsync(`
      WITH facturas AS (
        SELECT MAX(fecha_emision) AS fecha_emision, MAX(saldo) AS saldo
        FROM thermoplastica.fact_compras_linea
        GROUP BY fact_num, proveedor_id
      )
      SELECT
        COALESCE(SUM(saldo) FILTER (WHERE fecha_emision + INTERVAL '30 days' >= CURRENT_DATE), 0)        AS por_vencer,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_emision + INTERVAL '30 days' <  CURRENT_DATE
                                     AND fecha_emision + INTERVAL '60 days' >= CURRENT_DATE), 0)         AS v_1_30,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_emision + INTERVAL '60 days' <  CURRENT_DATE
                                     AND fecha_emision + INTERVAL '90 days' >= CURRENT_DATE), 0)         AS v_31_60,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_emision + INTERVAL '90 days' <  CURRENT_DATE), 0)        AS v_60_mas
      FROM facturas
      WHERE saldo > 0
    `);

    // Próximos pagos (con vencimiento estimado en los siguientes N días)
    const proximos = await db.allAsync(`
      WITH facturas AS (
        SELECT fact_num, proveedor_id, MAX(fecha_emision) AS fecha_emision, MAX(saldo) AS saldo
        FROM thermoplastica.fact_compras_linea
        GROUP BY fact_num, proveedor_id
      )
      SELECT
        p.nombre                                        AS proveedor,
        p.codigo_proveedor                              AS codigo,
        f.fact_num,
        f.fecha_emision,
        (f.fecha_emision + INTERVAL '30 days')::date    AS fecha_vencimiento_est,
        f.saldo                                         AS monto,
        ((f.fecha_emision + INTERVAL '30 days')::date - CURRENT_DATE)::int AS dias_restantes
      FROM facturas f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE f.saldo > 0
        AND (f.fecha_emision + INTERVAL '30 days')::date <= CURRENT_DATE + (? || ' days')::interval
      ORDER BY (f.fecha_emision + INTERVAL '30 days')::date ASC
      LIMIT 100
    `, [dias]);

    // Top proveedores por CxP
    const topProveedores = await db.allAsync(`
      WITH facturas AS (
        SELECT proveedor_id, MAX(saldo) AS saldo, fact_num
        FROM thermoplastica.fact_compras_linea
        GROUP BY proveedor_id, fact_num
      )
      SELECT
        p.nombre                          AS proveedor,
        p.codigo_proveedor                AS codigo,
        COUNT(*)                          AS facturas,
        COALESCE(SUM(f.saldo), 0)         AS monto
      FROM facturas f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE f.saldo > 0
      GROUP BY p.nombre, p.codigo_proveedor
      ORDER BY monto DESC
      LIMIT 10
    `);

    const total = parseFloat(resumen.total) || 0;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        total_cxp: total,
        facturas: parseInt(resumen.facturas) || 0,
        proveedores: parseInt(resumen.proveedores) || 0,
        promedio_dias_pago: Math.round(parseFloat(resumen.promedio_dias) || 0),
        distribucion_aging: {
          por_vencer: {
            monto: parseFloat(aging.por_vencer) || 0,
            porcentaje: total > 0 ? Math.round((parseFloat(aging.por_vencer) || 0) / total * 1000) / 10 : 0,
          },
          v_1_30: {
            monto: parseFloat(aging.v_1_30) || 0,
            porcentaje: total > 0 ? Math.round((parseFloat(aging.v_1_30) || 0) / total * 1000) / 10 : 0,
          },
          v_31_60: {
            monto: parseFloat(aging.v_31_60) || 0,
            porcentaje: total > 0 ? Math.round((parseFloat(aging.v_31_60) || 0) / total * 1000) / 10 : 0,
          },
          v_60_mas: {
            monto: parseFloat(aging.v_60_mas) || 0,
            porcentaje: total > 0 ? Math.round((parseFloat(aging.v_60_mas) || 0) / total * 1000) / 10 : 0,
          },
        },
        proximos_pagos: proximos.map(p => ({
          proveedor: p.proveedor,
          codigo: p.codigo,
          fact_num: p.fact_num,
          fecha_emision: p.fecha_emision,
          fecha_vencimiento: p.fecha_vencimiento_est,
          monto: parseFloat(p.monto) || 0,
          dias_restantes: parseInt(p.dias_restantes) || 0,
        })),
        top_proveedores: topProveedores.map(p => ({
          proveedor: p.proveedor,
          codigo: p.codigo,
          facturas: parseInt(p.facturas) || 0,
          monto: parseFloat(p.monto) || 0,
        })),
        nota: 'CxP construida desde vstCompras (MAX saldo por factura). Fecha de vencimiento estimada a 30 días desde emisión — el ERP no expone la fecha real.',
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
