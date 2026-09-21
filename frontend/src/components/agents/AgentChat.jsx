import { useState } from 'react'
import ChatConversacion from './ChatConversacion'

/**
 * Widget flotante del asistente. La conversacion vive en ChatConversacion
 * (compartida con la pagina completa /asistente); aqui solo esta el cromo
 * flotante: boton, ventana y encabezado.
 */
export default function AgentChat() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente'}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 ${
          isOpen ? 'bg-gray-700 hover:bg-gray-800 rotate-45' : 'bg-abaco hover:bg-abaco-light'
        }`}
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />}
        </svg>
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(34rem,calc(100vw-3rem))] h-[min(40rem,calc(100vh-9rem))] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-abaco px-4 py-3 text-white flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-semibold text-sm">abaco Assistant</h3>
              <p className="text-[11px] text-blue-200">Conectado a tu base de datos</p>
            </div>
            <a href="/asistente" title="Abrir en pantalla completa"
               className="text-blue-200 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </a>
          </div>
          <div className="flex-1 min-h-0">
            <ChatConversacion />
          </div>
        </div>
      )}
    </>
  )
}
