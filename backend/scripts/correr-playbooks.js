#!/usr/bin/env node
/**
 * correr-playbooks.js — El cron del analista diario.
 *
 * Lo dispara un Render Cron Job una vez al día. Para cada playbook activo:
 *   1. corre el agente analista sobre las vistas de analitica (solo lectura),
 *   2. recibe 3-4 insights estructurados,
 *   3. archiva los insights anteriores de ese playbook (status -> resolved),
 *   4. inserta los nuevos en insights_historico como 'active'.
 * El dashboard ya lee insights_historico, así que los hallazgos aparecen solos.
 *
 * Lecturas: via agenteAnalista -> dbAgente -> DATABASE_URL_READONLY (rol
 * agente_ia, solo SELECT sobre analitica).
 * Escrituras: pool admin propio contra DATABASE_URL (public.insights_historico).
 *
 * Flags:
 *   --dry-run           corre el análisis e imprime los insights, NO escribe.
 *   --playbook=<slug>   corre solo esa vertical (cartera|ventas|margenes|compras).
 *   --list              lista los playbooks activos y sale.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const analista = require('../src/services/agenteAnalista');
const dbAgente = require('../src/services/dbAgente');

const EMPRESA_ID = parseInt(process.env.DEFAULT_EMPRESA_ID || '1', 10);
const AGENT_VERSION = 'playbook-1.0';
const SQL_MIGRACION = path.join(__dirname, '..', 'database', 'migrations', '014_playbooks_analisis.sql');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SOLO_LISTAR = args.includes('--list');
const filtroPlaybook = (args.find(a => a.startsWith('--playbook=')) || '').split('=')[1] || null;

const admin = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  application_name: 'abaco_playbooks_cron'
});

const log = (...a) => console.log(new Date().toISOString(), ...a);
const fmtQ = (n) => 'Q' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('en-US');

/** Fecha local de Guatemala (YYYY-MM-DD), para ids y periodo. */
function hoyGT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

/** Crea/siembra la tabla de playbooks de forma idempotente. */
async function asegurarEsquema() {
  const sql = fs.readFileSync(SQL_MIGRACION, 'utf8');
  // Query simple (sin params) => node-pg permite múltiples sentencias.
  await admin.query(sql);
}

async function cargarPlaybooks() {
  const { rows } = await admin.query(
    `SELECT slug, nombre, vertical, prompt, max_insights
       FROM analisis_playbooks
      WHERE activo = TRUE ${filtroPlaybook ? 'AND slug = $1' : ''}
      ORDER BY orden, id`,
    filtroPlaybook ? [filtroPlaybook] : []
  );
  return rows;
}

/** Reemplaza los insights vigentes de un playbook por los nuevos, en una transacción. */
async function guardarInsights(playbook, insights, fecha) {
  const source = `playbook:${playbook.slug}`;
  const desde = new Date(); desde.setDate(desde.getDate() - 30);
  const periodoDesde = desde.toISOString().slice(0, 10);
  const periodoHasta = fecha;

  const client = await admin.connect();
  try {
    await client.query('BEGIN');

    // Archiva la corrida anterior de este playbook (deja de mostrarse como activa).
    await client.query(
      `UPDATE insights_historico SET status = 'resolved', updated_at = NOW()
        WHERE agent_source = $1 AND status = 'active' AND empresa_id = $2`,
      [source, EMPRESA_ID]
    );

    let i = 0;
    for (const ins of insights) {
      i++;
      const insightId = `pb:${playbook.slug}:${fecha}:${i}`;
      const descripcion = ins.recomendacion
        ? `${ins.descripcion}\n\n💡 ${ins.recomendacion}`
        : ins.descripcion;

      await client.query(
        `INSERT INTO insights_historico
           (insight_id, empresa_id, type, severity, title, description, impact, currency,
            category, action, action_label, change_percent, periodo_desde, periodo_hasta,
            agent_source, agent_version, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'GTQ',$8,$9,$10,$11,$12,$13,$14,$15,'active')
         ON CONFLICT (insight_id) DO UPDATE SET
           type=EXCLUDED.type, severity=EXCLUDED.severity, title=EXCLUDED.title,
           description=EXCLUDED.description, impact=EXCLUDED.impact, category=EXCLUDED.category,
           action=EXCLUDED.action, change_percent=EXCLUDED.change_percent,
           status='active', updated_at=NOW()`,
        [
          insightId, EMPRESA_ID, ins.tipo, ins.severidad, ins.titulo, descripcion,
          Number(ins.impacto_gtq) || 0, ins.categoria || playbook.nombre,
          ins.recomendacion || null, ins.recomendacion ? 'Recomendación' : null,
          ins.variacion_pct != null ? Number(ins.variacion_pct) : null,
          periodoDesde, periodoHasta, source, AGENT_VERSION
        ]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Registra la corrida en agentes_logs para dar visibilidad en la página de Agentes IA. */
async function registrarLog(playbook, insights, meta, status, errorMsg) {
  const impactoTotal = insights.reduce((s, i) => s + Math.abs(Number(i.impacto_gtq) || 0), 0);
  const top = insights[0];
  const descripcion = status === 'error'
    ? `Falló el análisis de ${playbook.nombre}: ${errorMsg || 'error desconocido'}`
    : insights.length
      ? `Análisis diario: ${insights.length} insights detectados${top ? `. Principal: ${top.titulo}` : ''}`
      : `Análisis diario de ${playbook.nombre}: sin hallazgos nuevos`;
  const detalles = JSON.stringify({
    vertical: playbook.slug,
    num_insights: insights.length,
    insights: insights.map(i => ({ titulo: i.titulo, severidad: i.severidad, tipo: i.tipo, impacto_gtq: i.impacto_gtq })),
    meta: meta || null,
  });
  try {
    await admin.query(
      `INSERT INTO agentes_logs
         (empresa_id, agente_nombre, agente_tipo, agente_version, categoria, descripcion,
          detalles_json, impacto_valor, impacto_moneda, resultado_status, duracion_ms)
       VALUES ($1,$2,$3,$4,'analisis_diario',$5,$6,$7,'GTQ',$8,$9)`,
      [
        EMPRESA_ID, playbook.nombre, playbook.slug, AGENT_VERSION, descripcion,
        detalles, impactoTotal, status, meta?.ms || null
      ]
    );
  } catch (e) {
    console.error(`  · no se pudo registrar el log de ${playbook.slug}:`, e.message);
  }
}

function imprimirInsights(playbook, insights) {
  log(`  → ${insights.length} insights de ${playbook.nombre}:`);
  insights.forEach((ins, i) => {
    const signo = (Number(ins.impacto_gtq) || 0) < 0 ? '-' : '+';
    const imp = ins.impacto_gtq ? ` [${signo}${fmtQ(ins.impacto_gtq)}]` : '';
    console.log(`     ${i + 1}. [${ins.severidad}/${ins.tipo}]${imp} ${ins.titulo}`);
    console.log(`        ${ins.descripcion}`);
    if (ins.recomendacion) console.log(`        💡 ${ins.recomendacion}`);
  });
}

async function main() {
  log(`Analista diario — ${DRY_RUN ? 'DRY RUN (no escribe)' : 'corrida real'}${filtroPlaybook ? ` — solo ${filtroPlaybook}` : ''}`);

  await asegurarEsquema();
  const playbooks = await cargarPlaybooks();

  if (SOLO_LISTAR) {
    log(`${playbooks.length} playbooks activos:`);
    playbooks.forEach(p => console.log(`  - ${p.slug} (${p.nombre}) · máx ${p.max_insights} insights`));
    return;
  }

  if (!playbooks.length) {
    log('No hay playbooks activos. Nada que hacer.');
    return;
  }

  const fecha = hoyGT();
  let totalInsights = 0, totalCosto = 0, fallidos = 0;

  for (const pb of playbooks) {
    log(`▶ ${pb.nombre} (${pb.slug})…`);
    try {
      const { insights, meta } = await analista.analizar(pb);
      totalCosto += meta.costo_usd || 0;

      if (!insights.length) {
        fallidos++;
        log(`  ⚠ Sin insights (${meta.incidencia || 'el modelo no entregó ninguno'}). No se toca lo anterior.`);
        if (!DRY_RUN) await registrarLog(pb, [], meta, 'advertencia');
        continue;
      }

      imprimirInsights(pb, insights);
      log(`  · ${meta.num_consultas} consultas · ${(meta.ms / 1000).toFixed(1)}s · $${meta.costo_usd}`);

      if (!DRY_RUN) {
        await guardarInsights(pb, insights, fecha);
        await registrarLog(pb, insights, meta, 'exitoso');
        log('  ✔ Guardado en insights_historico.');
      }
      totalInsights += insights.length;
    } catch (e) {
      fallidos++;
      console.error(`  ✖ Error en ${pb.slug}:`, e.message);
      if (!DRY_RUN) await registrarLog(pb, [], null, 'error', e.message);
    }
  }

  log(`Listo. ${totalInsights} insights de ${playbooks.length} playbooks (${fallidos} con problemas). Costo total ~$${totalCosto.toFixed(4)}.`);
}

main()
  .then(async () => {
    await admin.end().catch(() => {});
    await dbAgente.cerrar().catch(() => {});
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('FATAL:', e);
    await admin.end().catch(() => {});
    await dbAgente.cerrar().catch(() => {});
    process.exit(1);
  });
