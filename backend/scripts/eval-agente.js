#!/usr/bin/env node
/**
 * Set de evaluacion del agente SQL.
 *
 *   node scripts/eval-agente.js
 *
 * Cada caso tiene una pregunta y una lista de "debe_contener": textos o numeros
 * que la respuesta correcta tiene que incluir. Los valores fueron verificados a
 * mano contra la base el 2026-09-21. Es la red que atrapa regresiones cuando se
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
  { p: 'cuanto me deben en total mis clientes',
    debe: [7331000], no_debe: [] },
  { p: 'cuantas facturas tengo vencidas a mas de 90 dias y por cuanto',
    debe: [13, 1241480], no_debe: [] },
  { p: 'quien es el cliente que mas me debe',
    debe: ['cervecería', 843591], no_debe: [] },  // total de todas sus facturas pendientes
  { p: 'cuanto efectivo tengo disponible',
    debe: [1770000, 185000], no_debe: [5310000] },  // no debe triplicar
  { p: 'para cuantos dias me alcanza el efectivo',
    debe: [20], no_debe: [60] },
  { p: 'cuanto debo a proveedores',
    debe: [13603743], no_debe: [] },
  { p: 'en que gasto mas dinero',
    debe: ['nómina'], no_debe: [] },
  { p: 'como van las ventas mes a mes',
    debe: ['febrero', 'marzo'], no_debe: [] },  // debe mencionar el hueco/anomalia
  { p: 'como va la conciliacion bancaria',
    debe: ['no', 'movimientos'], no_debe: [] },  // no hay datos
  { p: 'cuantas obligaciones con la SAT tengo',
    debe: [14], no_debe: [42] },  // no debe triplicar
];

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
