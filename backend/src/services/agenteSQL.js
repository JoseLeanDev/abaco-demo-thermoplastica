/**
 * agenteSQL — El agente que consulta la base de datos.
 *
 * No es un chatbot con datos pegados: es un bucle. El modelo pide una
 * herramienta, el backend la ejecuta, le devuelve el resultado, y el modelo
 * decide si ya puede responder o si necesita otra consulta. Si su SQL falla,
 * recibe el error de Postgres y se corrige solo.
 *
 * El modelo NUNCA toca la base. Solo escribe texto; quien ejecuta es dbAgente,
 * contra el rol de solo lectura y pasando por sqlGuard.
 */
const axios = require('axios');
const db = require('./dbAgente');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELO = process.env.OPENROUTER_MODEL_AGENTE || 'anthropic/claude-sonnet-4.6';
const MAX_VUELTAS = parseInt(process.env.AGENTE_MAX_VUELTAS || '8', 10);
const MAX_FILAS_AL_MODELO = 60;

// ---------------------------------------------------------------------------
// Herramientas que el modelo puede pedir
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'ejecutar_sql',
      description:
        'Ejecuta una consulta SELECT de solo lectura contra el schema analitica y devuelve las filas. ' +
        'Si la consulta falla, devuelve el error de Postgres para que la corrijas y la vuelvas a intentar.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'La consulta SQL. Solo SELECT o WITH, una sola sentencia, solo sobre vistas de analitica.' },
          proposito: { type: 'string', description: 'En una frase corta, que buscas con esta consulta.' }
        },
        required: ['sql']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'muestrear_valores',
      description:
        'Devuelve los valores reales que existen en una columna, con su frecuencia. ' +
        'Usalo antes de filtrar por una columna de texto, para no inventar un valor que no existe.',
      parameters: {
        type: 'object',
        properties: {
          vista: { type: 'string', description: 'Nombre de la vista, por ejemplo v_transacciones' },
          columna: { type: 'string', description: 'Nombre de la columna' }
        },
        required: ['vista', 'columna']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'responder',
      description:
        'Entrega la respuesta final al usuario y termina. Usalo solo cuando ya tengas los datos que necesitas.',
      parameters: {
        type: 'object',
        properties: {
          texto: {
            type: 'string',
            description: 'La respuesta en español, en markdown. Concisa y directa. Menciona las advertencias de calidad de datos que apliquen.'
          },
          bloques: {
            type: 'array',
            description: 'Visualizaciones opcionales. Los datos NO se escriben aqui: se referencian con datos_de.',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['tabla', 'linea', 'barras', 'pastel', 'kpi'] },
                titulo: { type: 'string' },
                datos_de: { type: 'integer', description: 'El id de la consulta cuyas filas se van a mostrar (te lo devuelve ejecutar_sql).' },
                x: { type: 'string', description: 'Para graficas: columna del eje horizontal.' },
                y: { type: 'array', items: { type: 'string' }, description: 'Para graficas: columnas numericas a graficar.' },
                columnas: { type: 'array', items: { type: 'string' }, description: 'Para tablas: columnas a mostrar. Vacio = todas.' }
              },
              required: ['tipo', 'datos_de']
            }
          }
        },
        required: ['texto']
      }
    }
  }
];

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
async function construirSystemPrompt() {
  const catalogo = await db.catalogoComoTexto();

  // Las advertencias criticas se inyectan aqui en vez de que el agente gaste
  // una vuelta consultandolas en cada pregunta. Se leen de la vista, asi que
  // si manana cambia v_calidad_datos, este prompt cambia solo.
  let advertencias = '';
  try {
    const r = await db.ejecutarSQL(
      "SELECT entidad, problema, detalle FROM analitica.v_calidad_datos WHERE severidad = 'alto'"
    );
    if (r.ok && r.filas.length) {
      advertencias = r.filas.map(f => `- **${f.entidad}** — ${f.problema}: ${f.detalle}`).join('\n');
    }
  } catch (e) {
    console.warn('[agenteSQL] no se pudieron leer las advertencias de calidad:', e.message);
  }

  return `Eres el analista financiero de abaco para Thermoplástica, S.A. (empaque y envase industrial, Guatemala).

Respondes consultando la base de datos con SQL. No inventas cifras: todo numero que digas tiene que venir de una consulta que ejecutaste en esta conversacion.

## COMO TRABAJAS
1. Lee el catalogo de abajo y decide que consultar.
2. Llama a ejecutar_sql. Si falla, lee el error, corrige y reintenta (maximo 3 intentos por idea).
3. Si vas a filtrar por una columna de texto y no estas seguro de los valores, llama antes a muestrear_valores.
4. Cuando tengas los datos, llama a responder. Siempre terminas con responder.

## REGLAS QUE NO PUEDES SALTARTE
- **Fechas**: los datos tienen rezago. NUNCA uses CURRENT_DATE ni NOW(). Para "hoy", "este mes" o "ultimos 30 dias" usa (SELECT fecha_corte FROM analitica.v_meta). Si el usuario pregunta por un periodo reciente, aclarale hasta que fecha llegan los datos.
- **Ventas**: usa es_venta = true en v_transacciones. NO sumes todas las entradas: las cobranzas de facturas duplicarian los ingresos.
- **Gastos**: usa es_gasto = true. Los pagos a proveedores no son gastos nuevos.
- **Monedas**: GTQ y USD no se suman. Reportalas por separado.
- Solo puedes leer el schema analitica. No existe public ni el catalogo del sistema.
- Si los datos no alcanzan para responder, dilo claramente. Es mejor que inventar.

## LIMITACIONES CONOCIDAS DE ESTOS DATOS
Si la pregunta toca alguna de estas, mencionalo en tu respuesta. No las repitas cuando no vengan al caso.

${advertencias || '- (sin advertencias registradas)'}

Para el detalle completo, incluidas las de severidad media, consulta analitica.v_calidad_datos.

## COMO RESPONDES
- Español, markdown, directo. Sin rodeos ni relleno.
- Cifras en quetzales con separador de miles: Q1,234,567.
- Agrega bloques cuando ayuden: una tabla si son varias filas, una grafica si hay tendencia o comparacion. No pongas grafica para un solo numero.
- Los datos de los bloques se referencian con datos_de (el id de la consulta). No reescribas las filas.
- **El texto tiene que responder la pregunta por si solo**, con las cifras clave escritas ahi. Los bloques son un complemento visual, no un sustituto: nunca dejes una frase colgada esperando que el bloque la complete, ni un titulo sin su contenido.
- **Para listados de varias filas usa un bloque de tipo tabla en vez de escribir la tabla markdown a mano.** El bloque lleva todas las filas y no se trunca. En el texto resume el hallazgo (el total, los dos primeros, la conclusion) y deja el detalle al bloque.
- Si en el texto mencionas algunas filas de un resultado mas grande, di cuantas de cuantas estas mostrando (por ejemplo "las 5 mas grandes de 23").

## CATALOGO DE DATOS DISPONIBLE

${catalogo}`;
}

let cacheSystem = null;

// ---------------------------------------------------------------------------
// Llamada a OpenRouter
// ---------------------------------------------------------------------------
async function llamarModelo(messages, apiKey) {
  const { data } = await axios.post(
    OPENROUTER_URL,
    {
      model: MODELO,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 2000
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'abaco Agente SQL'
      },
      timeout: 90000
    }
  );
  return data;
}

/**
 * Corre el agente.
 *
 * @param {string} pregunta
 * @param {object} opts
 * @param {function} opts.onPaso  callback por paso, para streaming
 * @param {Array}   opts.historial mensajes previos [{role, content}]
 */
async function correr(pregunta, opts = {}) {
  const { onPaso = () => {}, historial = [] } = opts;
  const t0 = Date.now();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.includes('placeholder') || apiKey.includes('tu-api-key')) {
    throw new Error('OPENROUTER_API_KEY no esta configurada en el servidor.');
  }

  if (!cacheSystem) cacheSystem = await construirSystemPrompt();

  const messages = [
    // cache_control: el system prompt es identico en todas las vueltas y en
    // todas las preguntas. Cachearlo baja el costo de las lecturas a ~10%.
    { role: 'system', content: [{ type: 'text', text: cacheSystem, cache_control: { type: 'ephemeral' } }] },
    ...historial,
    { role: 'user', content: pregunta }
  ];

  const consultas = [];   // { id, sql, proposito, filas, num_filas }
  const pasos = [];
  let uso = { entrada: 0, salida: 0, cacheadas: 0 };

  for (let vuelta = 1; vuelta <= MAX_VUELTAS; vuelta++) {
    const data = await llamarModelo(messages, apiKey);

    if (data.usage) {
      uso.entrada += data.usage.prompt_tokens || 0;
      uso.salida += data.usage.completion_tokens || 0;
      uso.cacheadas += data.usage.prompt_tokens_details?.cached_tokens || 0;
    }

    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('Respuesta vacia del modelo.');

    const llamadas = msg.tool_calls || [];

    // Sin herramientas: el modelo contesto en texto plano. Lo aceptamos.
    if (!llamadas.length) {
      pasos.push({ vuelta, accion: 'texto_libre' });
      return terminar({ texto: msg.content || 'Sin respuesta.', bloques: [] }, consultas, pasos, uso, t0);
    }

    messages.push(msg);

    for (const lc of llamadas) {
      const nombre = lc.function?.name;
      let args = {};
      try { args = JSON.parse(lc.function?.arguments || '{}'); }
      catch { args = {}; }

      // ---- responder: fin del bucle ----
      if (nombre === 'responder') {
        pasos.push({ vuelta, accion: 'responder' });
        onPaso({ tipo: 'respondiendo' });
        return terminar(args, consultas, pasos, uso, t0);
      }

      // ---- ejecutar_sql ----
      if (nombre === 'ejecutar_sql') {
        onPaso({ tipo: 'consultando', proposito: args.proposito || 'consultando la base' });
        const r = await db.ejecutarSQL(args.sql || '');
        let contenido;

        if (r.ok) {
          const id = consultas.length + 1;
          consultas.push({ id, sql: r.sql, proposito: args.proposito || null, filas: r.filas, num_filas: r.num_filas });
          pasos.push({ vuelta, accion: 'sql_ok', filas: r.num_filas, ms: r.ms, proposito: args.proposito || null });
          onPaso({ tipo: 'consulta_lista', filas: r.num_filas });

          const recorte = r.filas.slice(0, MAX_FILAS_AL_MODELO);
          contenido = JSON.stringify({
            consulta_id: id,
            num_filas: r.num_filas,
            filas: recorte,
            nota: r.filas.length > MAX_FILAS_AL_MODELO
              ? `Se muestran ${MAX_FILAS_AL_MODELO} de ${r.num_filas} filas. Para el bloque visual se usaran todas. Si necesitas un resumen, agrega en SQL.`
              : undefined
          });
        } else {
          pasos.push({ vuelta, accion: 'sql_error', tipo: r.tipo, error: r.error });
          onPaso({ tipo: 'corrigiendo', error: r.error });
          contenido = JSON.stringify({
            error: r.error,
            detalle: r.detalle || undefined,
            instruccion: 'La consulta fallo. Corrige el SQL segun este error y vuelve a intentar.'
          });
        }

        messages.push({ role: 'tool', tool_call_id: lc.id, name: nombre, content: contenido });
        continue;
      }

      // ---- muestrear_valores ----
      if (nombre === 'muestrear_valores') {
        onPaso({ tipo: 'explorando', vista: args.vista, columna: args.columna });
        const r = await db.muestrearValores(args.vista, args.columna);
        pasos.push({ vuelta, accion: 'muestreo', vista: args.vista, columna: args.columna, ok: r.ok });
        messages.push({ role: 'tool', tool_call_id: lc.id, name: nombre, content: JSON.stringify(r) });
        continue;
      }

      // ---- herramienta desconocida ----
      messages.push({
        role: 'tool', tool_call_id: lc.id, name: nombre || 'desconocida',
        content: JSON.stringify({ error: `No existe la herramienta "${nombre}". Usa ejecutar_sql, muestrear_valores o responder.` })
      });
    }
  }

  // Se acabaron las vueltas sin que llamara a responder.
  pasos.push({ accion: 'limite_de_vueltas' });
  return terminar(
    {
      texto: consultas.length
        ? 'Consulté los datos pero no logré cerrar el análisis. Esto es lo que alcancé a obtener; intenta con una pregunta más específica.'
        : 'No logré resolver la consulta. Intenta reformular la pregunta.',
      bloques: consultas.length ? [{ tipo: 'tabla', datos_de: consultas.length, titulo: 'Último resultado obtenido' }] : []
    },
    consultas, pasos, uso, t0
  );
}

/** Arma la respuesta final: pega los datos reales a cada bloque. */
function terminar(args, consultas, pasos, uso, t0) {
  const bloques = (args.bloques || []).map(b => {
    const c = consultas.find(q => q.id === b.datos_de);
    if (!c) return null;
    return {
      tipo: b.tipo,
      titulo: b.titulo || null,
      x: b.x || null,
      y: b.y || null,
      columnas: b.columnas && b.columnas.length ? b.columnas : null,
      datos: c.filas,
      num_filas: c.num_filas
    };
  }).filter(Boolean);

  // Costo aproximado con precios de Sonnet 4.6 en OpenRouter.
  const noCacheadas = Math.max(uso.entrada - uso.cacheadas, 0);
  const costo = (noCacheadas / 1e6) * 3 + (uso.cacheadas / 1e6) * 0.3 + (uso.salida / 1e6) * 15;

  return {
    texto: args.texto || '',
    bloques,
    consultas: consultas.map(c => ({ id: c.id, sql: c.sql, proposito: c.proposito, num_filas: c.num_filas })),
    pasos,
    meta: {
      modelo: MODELO,
      vueltas: pasos.filter(p => p.vuelta).length,
      tokens_entrada: uso.entrada,
      tokens_cacheados: uso.cacheadas,
      tokens_salida: uso.salida,
      costo_usd: Number(costo.toFixed(5)),
      ms: Date.now() - t0
    }
  };
}

function limpiarCache() { cacheSystem = null; }

module.exports = { correr, limpiarCache, TOOLS, MODELO };
