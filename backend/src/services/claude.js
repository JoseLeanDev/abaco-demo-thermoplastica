/**
 * claude — Cliente de la API de Claude (Anthropic) compartido por los agentes.
 *
 * Antes los agentes llamaban a Claude a través de OpenRouter. Ahora van directo a
 * la API de Anthropic con el SDK oficial. Lee ANTHROPIC_API_KEY del entorno.
 *
 * - Modelo: ANTHROPIC_MODEL o claude-sonnet-5-5. El razonamiento (thinking) es
 *   adaptativo y no acepta temperature; la profundidad se controla con `effort`.
 * - fallbacks: "default": si un clasificador de seguridad rechaza la consulta, la
 *   API la reintenta sola en el modelo que Anthropic recomienda para ese caso.
 */
const Anthropic = require('@anthropic-ai/sdk');

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

// USD por millón de tokens (entrada, salida, lectura de caché, escritura de caché)
const PRECIOS = {
  'claude-opus-5-5':   { entrada: 4, salida: 20, cache_lectura: 0.2, cache_escritura: 5 },
  'claude-sonnet-5-5': { entrada: 2, salida: 10, cache_lectura: 0.2, cache_escritura: 2.5 },
};

let cliente = null;

function obtenerCliente() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no está configurada.');
  }
  if (!cliente) cliente = new Anthropic({ maxRetries: 2 });
  return cliente;
}

// Las herramientas se definen en el formato de funciones de OpenAI (heredado de
// OpenRouter); aquí se pasan al formato de Anthropic.
function aHerramientas(tools) {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/**
 * Una vuelta del bucle de herramientas.
 * @param {object} o
 * @param {Array}  o.system    bloques de texto del system prompt
 * @param {Array}  o.messages  conversación en formato Anthropic
 * @param {Array}  o.tools     herramientas en formato Anthropic
 * @param {string} o.effort    low | medium | high | xhigh | max
 * @param {number} o.timeoutMs tiempo máximo de la llamada
 */
async function llamar({ system, messages, tools, effort = 'medium', maxTokens = 16000, timeoutMs = 180000 }) {
  try {
    return await obtenerCliente().beta.messages.create(
      {
        model: MODELO,
        max_tokens: maxTokens,
        system,
        messages,
        tools,
        tool_choice: { type: 'auto' },
        output_config: { effort },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { timeout: timeoutMs }
    );
  } catch (err) {
    // Mensaje legible en los logs (p. ej. 401 = key inválida, 400 = sin saldo)
    if (err instanceof Anthropic.APIError) {
      err.message = `Claude API ${err.status ?? ''}: ${err.error?.error?.message || err.message}`;
    }
    throw err;
  }
}

function sumarUso(uso, u) {
  if (!u) return;
  uso.entrada += u.input_tokens || 0;
  uso.salida += u.output_tokens || 0;
  uso.cacheadas += u.cache_read_input_tokens || 0;
  uso.cache_escritas += u.cache_creation_input_tokens || 0;
}

// input_tokens de Anthropic ya excluye lo leído o escrito en caché
function costo(uso, modelo = MODELO) {
  const p = PRECIOS[modelo] || PRECIOS['claude-sonnet-5-5'];
  return (uso.entrada * p.entrada + uso.salida * p.salida +
          uso.cacheadas * p.cache_lectura + (uso.cache_escritas || 0) * p.cache_escritura) / 1e6;
}

const usoVacio = () => ({ entrada: 0, salida: 0, cacheadas: 0, cache_escritas: 0 });

module.exports = { MODELO, llamar, aHerramientas, sumarUso, costo, usoVacio, Anthropic };
