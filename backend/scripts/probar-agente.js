#!/usr/bin/env node
/**
 * Prueba el agente SQL desde la consola, sin levantar el servidor.
 *
 *   node scripts/probar-agente.js "cuanto me deben mis clientes"
 *   node scripts/probar-agente.js            (corre la bateria de ejemplo)
 *
 * Lee OPENROUTER_API_KEY y DATABASE_URL_READONLY de backend/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const agente = require('../src/services/agenteSQL');
const dbAgente = require('../src/services/dbAgente');

const BATERIA = [
  'cuanto me deben mis clientes',
  'quienes son los 5 clientes que mas me deben y cuantos dias llevan atrasados',
  'como se comportaron las ventas mes a mes',
  'cual es mi margen y que gasto mas',
  'como va la conciliacion bancaria',
];

const c = { gris: s => `\x1b[90m${s}\x1b[0m`, verde: s => `\x1b[32m${s}\x1b[0m`,
            rojo: s => `\x1b[31m${s}\x1b[0m`, azul: s => `\x1b[36m${s}\x1b[0m`,
            bold: s => `\x1b[1m${s}\x1b[0m` };

function chequeos() {
  const faltan = [];
  if (!process.env.OPENROUTER_API_KEY) faltan.push('OPENROUTER_API_KEY');
  if (!process.env.DATABASE_URL_READONLY) faltan.push('DATABASE_URL_READONLY');
  if (faltan.length) {
    console.error(c.rojo(`\nFaltan variables en backend/.env: ${faltan.join(', ')}\n`));
    process.exit(1);
  }
  if (!process.env.DATABASE_URL_READONLY.includes('agente_ia')) {
    console.error(c.rojo('\nAVISO: DATABASE_URL_READONLY no usa el usuario agente_ia.\n'));
  }
}

async function preguntar(pregunta) {
  console.log('\n' + '='.repeat(78));
  console.log(c.bold(c.azul('? ' + pregunta)));
  console.log('='.repeat(78));

  const t0 = Date.now();
  let r;
  try {
    r = await agente.correr(pregunta, {
      onPaso: p => {
        if (p.tipo === 'consultando')     console.log(c.gris(`   ... ${p.proposito}`));
        if (p.tipo === 'consulta_lista')  console.log(c.gris(`   ... ${p.filas} filas`));
        if (p.tipo === 'explorando')      console.log(c.gris(`   ... explorando ${p.vista}.${p.columna}`));
        if (p.tipo === 'corrigiendo')     console.log(c.rojo(`   ... SQL fallo, corrigiendo: ${p.error.slice(0, 60)}`));
        if (p.tipo === 'respondiendo')    console.log(c.gris('   ... redactando'));
      }
    });
  } catch (e) {
    console.log(c.rojo('ERROR: ' + e.message));
    return null;
  }

  console.log('\n' + r.texto + '\n');

  if (r.consultas.length) {
    console.log(c.gris('--- SQL ejecutado ---'));
    r.consultas.forEach(q =>
      console.log(c.gris(`  [${q.id}] (${q.num_filas} filas) ${q.sql.replace(/\s+/g, ' ').slice(0, 150)}`)));
  }

  if (r.bloques.length) {
    console.log(c.gris('\n--- bloques visuales ---'));
    r.bloques.forEach(b =>
      console.log(c.gris(`  ${b.tipo.padEnd(7)} "${b.titulo || 'sin titulo'}" con ${b.num_filas} filas`)));
  }

  const m = r.meta;
  const reintentos = r.pasos.filter(p => p.accion === 'sql_error').length;
  console.log(c.gris(
    `\n--- ${m.vueltas} vueltas | ${r.consultas.length} consultas | ${reintentos} reintentos ` +
    `| ${m.tokens_entrada} in (${m.tokens_cacheados} cache) / ${m.tokens_salida} out ` +
    `| $${m.costo_usd} | ${(Date.now() - t0) / 1000}s ---`));

  return r;
}

(async () => {
  chequeos();
  const args = process.argv.slice(2);
  const preguntas = args.length ? [args.join(' ')] : BATERIA;

  let costo = 0, fallos = 0;
  for (const p of preguntas) {
    const r = await preguntar(p);
    if (r) costo += r.meta.costo_usd; else fallos++;
  }

  if (preguntas.length > 1) {
    console.log('\n' + '='.repeat(78));
    console.log(c.bold(`${preguntas.length - fallos}/${preguntas.length} respondidas | costo total $${costo.toFixed(4)} | promedio $${(costo / preguntas.length).toFixed(4)} por pregunta`));
  }

  await dbAgente.cerrar();
})();
