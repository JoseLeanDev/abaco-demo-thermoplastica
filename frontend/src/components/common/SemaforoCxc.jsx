import { Link } from 'react-router-dom'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { Leyenda } from './leyendas'

// Semáforo de cartera vencida: % del saldo por cobrar que ya pasó su fecha de vencimiento.
// Más de 30% rojo · 25% a 30% amarillo · menos de 25% verde.
export const clasificarCxcVencida = (pct) => (pct > 30 ? 'rojo' : pct >= 25 ? 'amarillo' : 'verde')

const NIVELES = {
  verde:    { label: 'Sana',     luz: 'bg-emerald-500', texto: 'text-emerald-600', borde: 'border-l-emerald-500', fondo: 'bg-emerald-500/5', msg: 'La cartera vencida está bajo control.' },
  amarillo: { label: 'Atención', luz: 'bg-amber-400',   texto: 'text-amber-600',   borde: 'border-l-amber-400',   fondo: 'bg-amber-400/5',   msg: 'La cartera vencida se acerca al límite; conviene reforzar cobros.' },
  rojo:     { label: 'Crítica',  luz: 'bg-red-500',     texto: 'text-red-600',     borde: 'border-l-red-500',     fondo: 'bg-red-500/5',     msg: 'Más de 30% de lo que te deben ya está vencido.' },
}

const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return `Q${Math.round(v).toLocaleString('es-GT')}`
}

export default function SemaforoCxc({ total, vencido, link, cargando }) {
  const tot = Number(total) || 0
  const venc = Number(vencido) || 0
  const pct = tot > 0 ? venc / tot * 100 : 0
  const nivel = clasificarCxcVencida(pct)
  const n = NIVELES[nivel]

  if (cargando) return <div className="card h-24 animate-pulse bg-[var(--bg-secondary)]" />

  return (
    <div className={`card border-l-4 ${n.borde} ${n.fondo} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
      {/* Semáforo */}
      <div className="flex sm:flex-col gap-1.5 p-1.5 rounded-lg bg-[#0b1220] self-start sm:self-center shrink-0" aria-hidden>
        {['rojo', 'amarillo', 'verde'].map(l => (
          <span key={l} className={`w-4 h-4 rounded-full ${l === nivel ? NIVELES[l].luz : 'bg-white/15'}`} />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
          Cartera vencida <Leyenda k="cxc_vencida_pct" />
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className={`text-3xl font-bold tabular-nums ${n.texto}`}>{pct.toFixed(1)}%</p>
          <span className={`px-2 py-0.5 rounded-md text-[11px] uppercase font-bold tracking-wider border ${n.texto} border-current`}>{n.label}</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          {fmtM(venc)} vencido de {fmtM(tot)} por cobrar · {n.msg}
        </p>
      </div>

      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 text-[11px] text-[var(--text-muted)]">
        <div className="flex sm:flex-col gap-x-3 gap-y-0.5 sm:text-right">
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />más de 30%</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />25% a 30%</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />menos de 25%</span>
        </div>
        {link && (
          <Link to={link} className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline whitespace-nowrap">
            Ver vencidos <ArrowRightIcon className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  )
}
