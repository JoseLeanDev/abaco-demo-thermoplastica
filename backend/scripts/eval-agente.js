#!/usr/bin/env node
/**
 * Set de evaluacion del agente SQL.
 *
 *   node scripts/eval-agente.js
 *
 * Cada caso tiene una pregunta y una lista de "debe_contener": textos o numeros
 * que la respuesta correcta tiene que incluir. Los valores fueron verificados contra el ERP real el 2026-09-21. Es la red que atrapa regresiones cuando se
 * toca el prompt, el modelo o las vistas.
 *
 * No mide redaccion, mide correctitud: que los numeros clave esten y que las
 * trampas de calidad de datos se respeten.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const agente = require('../src/services/agenteSQL');
const dbAgente = require('../src/services/dbAgente');

// Acepta variantes de formato de un numero: 7331000, "7,331,000", "7.33M", "7.3M".
// Compara contra los NUMEROS de la respuesta como tokens completos, para no dar
// falsos positivos cuando "60" aparece dentro de "1,660,000".
function contiene(texto, esperado) {
  if (typeof esperado === 'string') {
    return texto.toLowerCase().replace(/[\s,]/g, '').includes(esperado.toLowerCase().replace(/[\s,]/g, ''));
  }
  const n = esperado;
  // Todos los numeros de la respuesta, normalizados (quita separadores de miles).
  const nums = (texto.match(/\d[\d,]*\.?\d*/g) || []).map(x => parseFloat(x.replace(/,/g, '')));
  const objetivos = new Set([
    n,                              // exacto
    Math.round(n / 1e3),           // en miles
    parseFloat((n / 1e6).toFixed(1)),
    parseFloat((n / 1e6).toFixed(2)),
  ]);
  // Coincide si algun numero de la respuesta iguala un objetivo (tolerancia 0.5%).
  return nums.some(v => [...objetivos].some(o => o > 0 && Math.abs(v - o) <= Math.max(o * 0.005, 0.05)));
}

const CASOS = [
  { p: 'cual es mi cliente con mejor margen',
    debe: ['margen'], no_debe: ['no permiten', 'no es posible', 'no tengo'] },  // ANTES fallaba: ahora debe responder
  { p: 'cuanto vendi en total historicamente',
    debe: [176144522], no_debe: [] },
  { p: 'cual es mi margen bruto global',
    debe: [33.1], no_debe: [] },
  { p: 'cuanto me deben mis clientes en facturas pendientes',
    debe: [19413292], no_debe: [] },
  { p: 'cuanto debo a proveedores en facturas pendientes',
    debe: [32927050], no_debe: [] },
  { p: 'cuales son mis 5 lineas de producto con mas ventas',
    debe: ['Inducción', 'Envase PE'], no_debe: [] },
  { p: 'como va la conciliacion bancaria',
    debe: ['no'], no_debe: [] },  // bancos no existen en el dataset real
]

const c = { v: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, g: s => `\x1b[90m${s}\x1b[0m`, b: s => `\x1b[1m${s}\x1b[0m` };

(async () => {
  if (!process.env.OPENROUTER_API_KEY || !process.env.DATABASE_URL_READONLY) {
    console.error(c.r('Faltan OPENROUTER_API_KEY o DATABASE_URL_READONLY en backend/.env')); process.exit(1);
  }

  let pasaron = 0, costo = 0;
  const fallidos = [];

  for (const caso of CASOS) {
    let r;
    try { r = await agente.correr(caso.p); }
    catch (e) { console.log(c.r(`FALLO  ${caso.p}\n       error: ${e.message}`)); fallidos.push(caso.p); continue; }

    costo += r.meta.costo_usd;
    const texto = r.texto;
    const faltan = caso.debe.filter(e => !contiene(texto, e));
    const prohibidos = (caso.no_debe || []).filter(e => contiene(texto, e));
    const ok = !faltan.length && !prohibidos.length;

    if (ok) { pasaron++; console.log(c.v(`OK    `) + caso.p + c.g(`  (${r.consultas.length} consultas, $${r.meta.costo_usd})`)); }
    else {
      fallidos.push(caso.p);
      console.log(c.r(`FALLO `) + caso.p);
      if (faltan.length)     console.log(c.g(`       falta: ${faltan.join(', ')}`));
      if (prohibidos.length) console.log(c.r(`       NO debia aparecer: ${prohibidos.join(', ')}`));
      console.log(c.g(`       respuesta: ${texto.replace(/\s+/g,' ').slice(0,140)}`));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(c.b(`${pasaron}/${CASOS.length} casos correctos  |  costo total $${costo.toFixed(4)}  |  ~$${(costo/CASOS.length).toFixed(4)}/pregunta`));
  if (fallidos.length) console.log(c.r(`Revisar: ${fallidos.length} fallo(s)`));

  await dbAgente.cerrar();
  process.exit(fallidos.length ? 1 : 0);
})();
