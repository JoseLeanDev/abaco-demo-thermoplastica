import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

/**
 * Leyenda discreta: un ⓘ gris que al pasar el mouse (o tocarlo en celular)
 * muestra cómo se calcula un número.
 *
 *   <ComoSeCalcula titulo="Inmovilizado">Producto sin ventas en 180 días…</ComoSeCalcula>
 *
 * La tarjeta se dibuja en un portal con posición fija para que no la recorten
 * contenedores con scroll (tablas) ni tarjetas con overflow oculto. No dispara
 * los clics del contenedor (p. ej. encabezados que ordenan la tabla).
 */
const ANCHO = 288

export default function ComoSeCalcula({ titulo, children, className = '', claro = false }) {
  const [pos, setPos] = useState(null) // { top, left } cuando está abierta
  const btn = useRef(null)
  const tarjeta = useRef(null)
  const cerrarTimer = useRef(null)

  const abrir = () => {
    clearTimeout(cerrarTimer.current)
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.min(Math.max(8, r.left + r.width / 2 - ANCHO / 2), window.innerWidth - ANCHO - 8)
    // Abre hacia abajo; si no cabe, hacia arriba
    const abajo = r.bottom + 6
    setPos({ left, top: abajo, arriba: window.innerHeight - abajo < 180 ? r.top - 6 : null })
  }
  const cerrar = () => { cerrarTimer.current = setTimeout(() => setPos(null), 120) }

  useEffect(() => {
    if (!pos) return
    const fuera = (e) => {
      if (!btn.current?.contains(e.target) && !tarjeta.current?.contains(e.target)) setPos(null)
    }
    const alScroll = () => setPos(null)
    document.addEventListener('pointerdown', fuera)
    window.addEventListener('scroll', alScroll, true)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      window.removeEventListener('scroll', alScroll, true)
    }
  }, [pos])

  return (
    <span className={`inline-flex align-middle normal-case tracking-normal font-normal ${className}`}>
      <button
        ref={btn}
        type="button"
        aria-label={`Cómo se calcula${titulo ? `: ${titulo}` : ''}`}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); pos ? setPos(null) : abrir() }}
        className={`inline-flex p-0.5 -m-0.5 ${claro ? 'text-white' : 'text-[var(--text-muted)]'} opacity-50 hover:opacity-100 focus:opacity-100 focus:outline-none`}
      >
        <InformationCircleIcon className="w-3.5 h-3.5" />
      </button>
      {pos && createPortal(
        <div
          ref={tarjeta}
          role="tooltip"
          onMouseEnter={() => clearTimeout(cerrarTimer.current)}
          onMouseLeave={cerrar}
          style={{
            position: 'fixed', left: pos.left, width: ANCHO, zIndex: 1000,
            ...(pos.arriba !== null ? { bottom: window.innerHeight - pos.arriba } : { top: pos.top }),
          }}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-left text-xs leading-relaxed text-[var(--text-secondary)] shadow-lg"
        >
          {titulo && <p className="font-semibold text-[var(--text-primary)] mb-1">{titulo}</p>}
          {children}
        </div>,
        document.body
      )}
    </span>
  )
}
