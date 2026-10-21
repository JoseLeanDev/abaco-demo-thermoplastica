/**
 * agenteAnalista — El agente que corre el analisis diario de una vertical.
 *
 * Es el mismo patron que agenteSQL (bucle de tool-calling contra el ejecutor
 * de solo lectura dbAgente), pero termina en `entregar_insights` en vez de
 * `responder`: en lugar de un texto para el chat, produce una lista de insights
 * estructurados que el runner guarda en insights_historico.
 *
 * Se mantiene APARTE de agenteSQL a proposito: el agente de chat esta en
 * produccion y no queremos arriesgarlo. Aqui reusamos lo valioso y sensible
 * (dbAgente: rol read-only + sqlGuard + catalogo), no el loop de chat.
 */
const db = require('./dbAgente');
const claude = require('./claude');

const MODELO = claude.MODELO;
const MAX_VUELTAS = parseInt(process.env.ANALISTA_MAX_VUELTAS || '14', 10);
const MAX_FILAS_AL_MODELO = 60;

// ---------------------------------------------------------------------------
// Reglas comunes a todas las verticales. El cuerpo especifico de cada playbook
// vive en la tabla analisis_playbooks; esto es lo que comparten las cuatro.
// ---------------------------------------------------------------------------
const REGLAS_COMUNES = `Eres un analista financiero senior de Thermoplástica, S.A. (empaque y envase industrial, Guatemala). Corres el análisis diario de UNA vertical del negocio consultando la base de datos con SQL. No le hablas a un usuario: produces un reporte de insights que se guarda y se muestra en el dashboard.

## CÓMO TRABAJAS
1. Lee el catálogo y decide qué consultar para cubrir los ángulos que te piden.
2. Llama a ejecutar_sql. Si falla, lee el error de Postgres, corrige y reintenta.
3. Si vas a filtrar por una columna de texto y no estás seguro de los valores, usa muestrear_valores antes.
4. Cuando tengas evidencia suficiente, llama a entregar_insights UNA sola vez con todos los hallazgos. Siempre terminas ahí.

## QUÉ HACE UN BUEN INSIGHT
- Cada número que afirmes tiene que venir de una consulta que ejecutaste en esta corrida. No inventas cifras.
- Nombra la ENTIDAD real (cliente, proveedor, producto, línea) y el NÚMERO en quetzales. Nada genérico como "algunos clientes".
- Prioriza por impacto en quetzales. NO rellenes: si solo hay 3 cosas que de verdad importan, entrega 3. Prefiero 3 relevantes que 4 con paja.
- No repitas el mismo hallazgo con distinto ángulo.
- Compara contra el periodo previo cuando puedas (mes vs mes anterior, vs mismo mes del año pasado, o vs promedio) y refléjalo en variacion_pct.
- La recomendación es una acción concreta que alguien pueda ejecutar mañana.

## REGLAS DE DATOS QUE NO PUEDES SALTARTE
- Jerarquia de producto en v_ventas: CATEGORIA = columna marca (Laminados, Liners, Soplado, Tapas y Valvulas...), SUBCATEGORIA = columna linea (Induccion, Envase PE, PVDC...), SUBLINEA = columna sublinea. Cuando el usuario diga 'categoria' agrupa por marca, NO por la columna categoria (esa es casi igual a linea).
- Ventas y margen salen de v_ventas. Para ventas suma la columna ventas. Para el margen % de un grupo usa (analitica.margen_comercial(es_cpp,ventas,costo_comercial,margen_comercial,ventas_base_margen)->>'pct')::numeric. El mismo agregado retorna margen y costo en Q. Laminados usa CPP MP del documento de Jonathan; las demás líneas conservan ERP. No extrapoles ventas de Laminados sin CPP: su base es cero y el margen es N/D. Mes abierto tiene ventas visibles y CPP pendiente. Menciona cobertura/corte. NUNCA promedies margen_bruto_pct.
- En v_cxc y v_cxp la mayoría de facturas están CANCELADA (pagadas). Para lo pendiente filtra saldo > 0 y suma saldo (no valor).
- Los datos están al día (pocos días de rezago): SÍ puedes usar CURRENT_DATE para vencimientos y antigüedad. Consulta v_meta si dudas del corte.
- Bancos, flujo de caja, runway y SAT NO existen en estos datos. No los menciones.
- Solo puedes leer el schema analitica. Todo en GTQ.

## CÓMO CLASIFICAR CADA INSIGHT (campo tipo)
- "ingreso": buena noticia de ventas/ingresos/crecimiento.
- "gasto": mala noticia de costos/egresos (gasto que sube, margen que se erosiona, dinero que se pierde).
- "alerta": un riesgo o problema que exige atención (cartera vencida, factura por vencer, concentración peligrosa).
- "oportunidad": una acción concreta para mejorar (repricing, cobrar, renegociar, empujar un producto rentable).

## SIGNO DEL IMPACTO (campo impacto_gtq)
- Positivo: dinero por ganar o que entra (una oportunidad, un ingreso).
- Negativo: dinero en riesgo, que se pierde o que hay que desembolsar (una alerta, un gasto).
- 0 si el hallazgo no tiene un monto claro.

## SEVERIDAD (campo severidad)
- "critical": exige acción esta semana; mucho dinero o riesgo alto en juego.
- "warning": hay que vigilarlo; impacto medio.
- "info": contexto útil, tendencia, sin urgencia.`;

// ---------------------------------------------------------------------------
// Herramientas
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
          vista: { type: 'string', description: 'Nombre de la vista, por ejemplo v_ventas' },
          columna: { type: 'string', description: 'Nombre de la columna' }
        },
        required: ['vista', 'columna']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'entregar_insights',
      description:
        'Entrega los insights del analisis y termina. Usalo UNA sola vez, cuando ya tengas la evidencia. ' +
        'Cada insight debe apoyarse en cifras que ya consultaste.',
      parameters: {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            description: 'Entre 3 y 4 insights, ordenados del mas importante al menos importante.',
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string', description: 'Frase corta y concreta, máx ~70 caracteres.' },
                descripcion: { type: 'string', description: 'El hallazgo en 1-3 frases, con el número en quetzales y la entidad real.' },
                recomendacion: { type: 'string', description: 'Una acción concreta y ejecutable.' },
                severidad: { type: 'string', enum: ['critical', 'warning', 'info'] },
                tipo: { type: 'string', enum: ['ingreso', 'gasto', 'alerta', 'oportunidad'] },
                impacto_gtq: { type: 'number', description: 'Monto en GTQ. Positivo = por ganar/entra; negativo = en riesgo/se pierde/se paga; 0 si no aplica.' },
                variacion_pct: { type: 'number', description: 'Opcional: variación % vs periodo previo (ej. -12.5).' },
                categoria: { type: 'string', description: 'Opcional: la entidad principal del insight (cliente, línea, proveedor, producto).' }
              },
              required: ['titulo', 'descripcion', 'recomendacion', 'severidad', 'tipo']
            }
          }
        },
        required: ['insights']
      }
    }
  }
];

const HERRAMIENTAS = claude.aHerramientas(TOOLS);

// ---------------------------------------------------------------------------
// System prompt: reglas comunes + catalogo real. Cacheable entre playbooks.
// ---------------------------------------------------------------------------
let cacheSystem = null;

async function construirSystemPrompt() {
  const catalogo = await db.catalogoComoTexto();
  return `${REGLAS_COMUNES}

## CATÁLOGO DE DATOS DISPONIBLE

${catalogo}`;
}

// Análisis de varios pasos con SQL: esfuerzo medio (en Sonnet 5.5 rinde como el alto de antes)
const llamarModelo = (system, messages) =>
  claude.llamar({ system, messages, tools: HERRAMIENTAS, effort: 'medium', timeoutMs: 300000 });

/**
 * Corre el analisis de una vertical.
 *
 * @param {object} playbook  { slug, nombre, vertical, prompt, max_insights }
 * @returns {Promise<{ insights: Array, consultas: Array, meta: object }>}
 */
async function analizar(playbook) {
  const t0 = Date.now();

  if (!cacheSystem) cacheSystem = await construirSystemPrompt();

  const maxIns = playbook.max_insights || 4;
  const encargo =
    `## TU VERTICAL DE HOY: ${playbook.nombre}\n\n` +
    `${playbook.prompt}\n\n` +
    `Entrega entre 3 y ${maxIns} insights. Empieza a consultar la base y termina con entregar_insights.`;

  // El system prompt (reglas + catálogo) es igual para todas las verticales: se cachea
  const system = [{ type: 'text', text: cacheSystem, cache_control: { type: 'ephemeral' } }];
  const messages = [{ role: 'user', content: encargo }];

  const consultas = [];
  const uso = claude.usoVacio();

  for (let vuelta = 1; vuelta <= MAX_VUELTAS; vuelta++) {
    const resp = await llamarModelo(system, messages);
    claude.sumarUso(uso, resp.usage);

    if (resp.stop_reason === 'refusal') {
      throw new Error(`El modelo rechazó el análisis (${resp.stop_details?.category || 'sin categoría'}).`);
    }

    // Se devuelve el contenido completo (incluye los bloques de razonamiento)
    messages.push({ role: 'assistant', content: resp.content });
    const llamadas = resp.content.filter(b => b.type === 'tool_use');

    // Sin herramientas: el modelo no cerró bien. Reencaminar.
    if (!llamadas.length) {
      messages.push({
        role: 'user',
        content: 'No entregaste los insights con la herramienta. Llama a entregar_insights con la lista de hallazgos.'
      });
      continue;
    }

    // Todas las respuestas de herramientas van en un solo mensaje
    const resultados = [];
    for (const lc of llamadas) {
      const nombre = lc.name;
      const args = lc.input || {};

      // ---- entregar_insights: fin del bucle ----
      if (nombre === 'entregar_insights') {
        const insights = Array.isArray(args.insights) ? args.insights : [];
        return terminar(insights, consultas, uso, t0);
      }

      // ---- ejecutar_sql ----
      if (nombre === 'ejecutar_sql') {
        const r = await db.ejecutarSQL(args.sql || '');
        let contenido;
        if (r.ok) {
          const id = consultas.length + 1;
          consultas.push({ id, sql: r.sql, proposito: args.proposito || null, num_filas: r.num_filas });
          const recorte = r.filas.slice(0, MAX_FILAS_AL_MODELO);
          contenido = JSON.stringify({
            consulta_id: id,
            num_filas: r.num_filas,
            filas: recorte,
            nota: r.filas.length > MAX_FILAS_AL_MODELO
              ? `Se muestran ${MAX_FILAS_AL_MODELO} de ${r.num_filas} filas. Agrega/resume en SQL si necesitas el total.`
              : undefined
          });
        } else {
          contenido = JSON.stringify({
            error: r.error,
            detalle: r.detalle || undefined,
            instruccion: 'La consulta falló. Corrige el SQL según este error y vuelve a intentar.'
          });
        }
        resultados.push({ type: 'tool_result', tool_use_id: lc.id, content: contenido, ...(r.ok ? {} : { is_error: true }) });
        continue;
      }

      // ---- muestrear_valores ----
      if (nombre === 'muestrear_valores') {
        const r = await db.muestrearValores(args.vista, args.columna);
        resultados.push({ type: 'tool_result', tool_use_id: lc.id, content: JSON.stringify(r) });
        continue;
      }

      // ---- herramienta desconocida ----
      resultados.push({
        type: 'tool_result', tool_use_id: lc.id, is_error: true,
        content: JSON.stringify({ error: `No existe la herramienta "${nombre}". Usa ejecutar_sql, muestrear_valores o entregar_insights.` })
      });
    }
    messages.push({ role: 'user', content: resultados });
  }

  // Se agotaron las vueltas sin entregar_insights.
  return terminar([], consultas, uso, t0, 'limite_de_vueltas');
}

function terminar(insights, consultas, uso, t0, incidencia) {
  const costo = claude.costo(uso);
  return {
    insights,
    consultas,
    meta: {
      modelo: MODELO,
      incidencia: incidencia || null,
      num_consultas: consultas.length,
      tokens_entrada: uso.entrada,
      tokens_cacheados: uso.cacheadas,
      tokens_salida: uso.salida,
      costo_usd: Number(costo.toFixed(5)),
      ms: Date.now() - t0
    }
  };
}

function limpiarCache() { cacheSystem = null; }

module.exports = { analizar, limpiarCache, REGLAS_COMUNES, MODELO };
