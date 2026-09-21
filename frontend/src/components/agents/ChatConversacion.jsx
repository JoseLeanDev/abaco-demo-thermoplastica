import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chatConAgenteSQL } from '../../services/cfoApi'
import BloqueVisual from './BloqueVisual'

export const BIENVENIDA = {
  role: 'assistant',
  content: 'Soy **abaco**. Consulto directamente tu base de datos para responderte.\n\nPregúntame lo que sea sobre cartera, ventas, gastos, proveedores o impuestos.',
}

export const SUGERENCIAS = [
  '¿Quiénes me deben más?',
  '¿Cuánto efectivo tengo?',
  'Ventas por mes',
  '¿En qué gasto más?',
  '¿Cómo va mi margen?',
  'Obligaciones con la SAT',
]

const MENSAJES_ESPERA = [
  'Consultando la base de datos…',
  'Revisando los registros…',
  'Analizando los resultados…',
  'Preparando la respuesta…',
]

/** Estilos del markdown. Sin plugin typography, se define elemento por elemento. */
const MD = {
  h1: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mt-3 mb-1.5 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mt-3 mb-1.5 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold text-gray-800 mt-2.5 mb-1 first:mt-0">{children}</h4>,
  p:  ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/60 bg-orange-50/60 pl-2.5 py-1.5 my-2 text-gray-700 rounded-r">{children}</blockquote>
  ),
  code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>,
  hr: () => <hr className="my-2.5 border-gray-200" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 border border-gray-200 rounded-lg">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => <th className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">{children}</td>,
  a: ({ children, href }) => <a href={href} className="text-primary-600 underline" target="_blank" rel="noreferrer">{children}</a>,
}


/**
 * Conversacion del agente SQL. Sin cromo propio: el contenedor (widget flotante
 * o pagina completa) decide el tamaño. Con fullPage=true los mensajes se centran
 * en una columna ancha y las burbujas del asistente ocupan mas espacio.
 */
const STORAGE_KEY = 'abaco_chat_historial'
const STORAGE_MAX = 40  // guardar solo los ultimos N mensajes

function cargarHistorial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [BIENVENIDA]
    const arr = JSON.parse(raw)
    return Array.isArray(arr) && arr.length ? arr : [BIENVENIDA]
  } catch {
    return [BIENVENIDA]
  }
}

export default function ChatConversacion({ fullPage = false }) {
  const [messages, setMessages] = useState(cargarHistorial)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [espera, setEspera] = useState(0)
  const finRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isLoading])

  // Persistir la conversacion en localStorage (por-navegador, sin backend).
  useEffect(() => {
    try {
      if (messages.length <= 1) { localStorage.removeItem(STORAGE_KEY); return }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-STORAGE_MAX)))
    } catch { /* modo privado o storage lleno: seguir sin persistir */ }
  }, [messages])

  useEffect(() => {
    if (!isLoading) { setEspera(0); return }
    const t = setInterval(() => setEspera(i => (i + 1) % MENSAJES_ESPERA.length), 4000)
    return () => clearInterval(t)
  }, [isLoading])

  const enviar = async (e, textoDirecto) => {
    e?.preventDefault()
    const pregunta = (textoDirecto ?? input).trim()
    if (!pregunta || isLoading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: pregunta }])
    setIsLoading(true)

    const historial = messages
      .filter(m => m.content && m !== BIENVENIDA)
      .slice(-4)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 1500) }))

    try {
      // El interceptor de cfoApi ya devuelve response.data.
      const data = await chatConAgenteSQL(pregunta, historial)
      if (!data.success) throw new Error(data.error || 'Error del servidor')

      const r = data.response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: r.content,
        bloques: r.bloques || [],
        consultas: r.consultas || [],
        meta: r.meta,
      }])
    } catch (error) {
      const msg = error.response?.data?.error || error.message
      setMessages(prev => [...prev, {
        role: 'assistant',
        error: true,
        content: error.code === 'ECONNABORTED'
          ? 'La consulta tardó demasiado. Intenta con una pregunta más específica.'
          : `No pude responder: ${msg}`,
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const limpiar = () => {
    setMessages([BIENVENIDA])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }

  const soloBienvenida = messages.length <= 1
  const anchoMsg = fullPage ? 'max-w-[820px] mx-auto w-full' : ''
  const anchoAsist = fullPage ? 'max-w-[90%]' : 'max-w-[95%]'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barra superior: limpiar conversacion (solo si hay historial) */}
      {!soloBienvenida && (
        <div className="flex justify-end px-3 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0">
          <button onClick={limpiar}
            className="text-[11px] text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Nueva conversación
          </button>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={anchoMsg}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] bg-abaco text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className={`${anchoAsist} w-full rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm shadow-sm border ${
                  msg.error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200 text-gray-800'
                }`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
                    {msg.content}
                  </ReactMarkdown>
                  {msg.bloques?.map((b, i) => <BloqueVisual key={i} bloque={b} />)}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={anchoMsg}>
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2.5 shadow-sm">
                <span className="w-4 h-4 border-2 border-abaco border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-gray-500 text-xs">{MENSAJES_ESPERA[espera]}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {/* Sugerencias (solo al inicio) */}
      {soloBienvenida && (
        <div className={`px-3 sm:px-4 py-2 bg-white border-t border-gray-100 flex gap-1.5 flex-wrap shrink-0 ${fullPage ? 'justify-center' : ''}`}>
          {SUGERENCIAS.slice(0, fullPage ? 6 : 4).map(s => (
            <button key={s} onClick={() => enviar(null, s)} disabled={isLoading}
              className="text-[11px] bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-2.5 py-1 rounded-full transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={enviar} className="p-2.5 sm:p-3 bg-white border-t border-gray-200 shrink-0">
        <div className={`flex gap-2 ${fullPage ? 'max-w-[820px] mx-auto' : ''}`}>
          <input
            ref={inputRef}
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre tus finanzas…" disabled={isLoading}
            className="flex-1 px-3.5 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-abaco/30 focus:border-abaco disabled:bg-gray-50"
          />
          <button type="submit" disabled={isLoading || !input.trim()}
            className="p-2 bg-abaco text-white rounded-full hover:bg-abaco-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
