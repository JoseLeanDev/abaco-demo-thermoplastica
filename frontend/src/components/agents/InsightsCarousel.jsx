import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  SparklesIcon,
  BoltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'
import { useInsightsHistorico } from '../../hooks/useCfoData'

/**
 * InsightsCarousel — Carrusel horizontal con TODOS los insights del analista
 * diario (los 4 playbooks). Mismo lenguaje visual que el banner por sección
 * (PageInsights), pero en una sola fila con scroll para no ocupar tanto espacio.
 * Cada tarjeta lleva su etiqueta de vertical (qué agente la generó).
 */

const VERT = {
  cartera:  { label: 'Cartera',  dot: 'bg-sky-400',     text: 'text-sky-300' },
  ventas:   { label: 'Ventas',   dot: 'bg-emerald-400', text: 'text-emerald-300' },
  margenes: { label: 'Márgenes', dot: 'bg-violet-400',  text: 'text-violet-300' },
  compras:  { label: 'Compras',  dot: 'bg-amber-400',   text: 'text-amber-300' },
}
const ORDEN = ['cartera', 'ventas', 'margenes', 'compras']

const TYPE_CFG = {
  gasto:       { icon: ArrowTrendingDownIcon, color: 'text-rose-300',    bg: 'bg-rose-500/15' },
  ingreso:     { icon: ArrowTrendingUpIcon,   color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
  alerta:      { icon: ExclamationTriangleIcon, color: 'text-amber-300', bg: 'bg-amber-500/15' },
  oportunidad: { icon: LightBulbIcon,         color: 'text-violet-300',  bg: 'bg-violet-500/15' },
}
const SEV_CFG = {
  critical: { badge: 'bg-rose-500/20 text-rose-300',   label: 'CRÍTICO' },
  warning:  { badge: 'bg-amber-500/20 text-amber-300', label: 'ADVERTENCIA' },
  info:     { badge: 'bg-sky-500/20 text-sky-300',     label: 'INFO' },
}
const SEV_RANK = { critical: 0, warning: 1, info: 2 }

const slugDe = (src) => (src || '').startsWith('playbook:') ? src.split(':')[1] : null
const fmtQ = (v) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.abs(Number(v) || 0))

export default function InsightsCarousel() {
  const scroller = useRef(null)
  const { data, isLoading } = useInsightsHistorico({ limit: 100, days: 30 })

  const insights = (data?.data?.insights || [])
    .filter(i => slugDe(i.agentSource))
    .sort((a, b) => {
      const va = ORDEN.indexOf(slugDe(a.agentSource))
      const vb = ORDEN.indexOf(slugDe(b.agentSource))
      if (va !== vb) return va - vb
      return (SEV_RANK[a.severity] ?? 3) - (SEV_RANK[b.severity] ?? 3)
    })

  const desplazar = (dir) => {
    scroller.current?.scrollBy({ left: dir * 340, behavior: 'smooth' })
  }

  if (!isLoading && insights.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-gradient-to-br from-[#0a1a38] via-[#0b1e42] to-[#0a1730]">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-white">Insights de IA</h3>
              <span className="text-[10px] font-bold tracking-wide text-violet-200 bg-violet-500/20 px-1.5 py-0.5 rounded">IA</span>
            </div>
            <p className="text-xs text-slate-400">
              Análisis diario por vertical · {insights.length} detectado{insights.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:flex items-center gap-1 text-xs text-slate-300 mr-1">
            <BoltIcon className="w-3.5 h-3.5 text-amber-300" /> abaco AI
          </span>
          <button onClick={() => desplazar(-1)} aria-label="Anterior"
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 transition-colors">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button onClick={() => desplazar(1)} aria-label="Siguiente"
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 transition-colors">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fila con scroll */}
      <div ref={scroller}
        className="flex gap-3 p-4 overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}>
        {isLoading
          ? [1, 2, 3, 4].map(i => <div key={i} className="snap-start shrink-0 w-[320px] h-36 rounded-xl bg-white/5 animate-pulse" />)
          : insights.map((ins, idx) => {
              const vert = VERT[slugDe(ins.agentSource)] || {}
              const cfg = TYPE_CFG[ins.type] || TYPE_CFG.oportunidad
              const sev = SEV_CFG[ins.severity] || SEV_CFG.info
              const Icon = cfg.icon
              const imp = Number(ins.impact) || 0
              return (
                <div key={ins.id || idx}
                  className="snap-start shrink-0 w-[320px] rounded-xl bg-white/[0.06] border border-white/10 p-4 hover:bg-white/[0.09] transition-colors flex flex-col">
                  {/* Etiqueta de vertical */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${vert.text || 'text-slate-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${vert.dot || 'bg-slate-400'}`} />
                      {vert.label || 'IA'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sev.badge}`}>{sev.label}</span>
                  </div>
                  <div className="flex items-start gap-2.5 flex-1">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                      <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-white leading-snug mb-1">{ins.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{ins.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {imp !== 0 ? (
                      <span className={`text-sm font-bold ${imp > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {imp > 0 ? '+' : '-'}{fmtQ(imp)}
                      </span>
                    ) : <span />}
                    <Link to="/insights" className="flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white transition-colors shrink-0">
                      Ver detalle <ArrowRightIcon className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
      </div>
    </div>
  )
}
