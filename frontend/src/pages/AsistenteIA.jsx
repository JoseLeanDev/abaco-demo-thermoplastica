import ChatConversacion from '../components/agents/ChatConversacion'

/**
 * Pagina completa del asistente. Ocupa todo el alto disponible del area de
 * contenido y usa la misma conversacion que el widget flotante, en modo fullPage.
 */
export default function AsistenteIA() {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] min-h-[520px] -m-6">
      {/* Encabezado */}
      <div className="bg-abaco text-white px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">abaco Assistant</h1>
          <p className="text-xs text-blue-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Conectado a tu base de datos en tiempo real
          </p>
        </div>
      </div>

      {/* Conversacion */}
      <div className="flex-1 min-h-0 border-x border-b border-gray-200">
        <ChatConversacion fullPage />
      </div>
    </div>
  )
}
