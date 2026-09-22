import { Link } from 'react-router-dom'
import {
  SparklesIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'
import { useInsights, useInsightsHistorico } from '../../hooks/useCfoData'

/**
 * PageInsights — Banner distintivo de insights de IA para la cabecera de cada
 * sección. Diseño oscuro para diferenciarse del resto de la página.
 *
 * Dos modos:
 *  - Con `vertical` (cartera|ventas|margenes|compras): muestra los insights del
 *    ANALISTA DIARIO (cron por playbooks) de esa vertical, leídos del histórico
 *    (agent_source = 'playbook:<vertical>'). Es el modo que se usa por sección.
 *  - Sin `vertical`: comportamiento heredado (generador en tiempo real por
 *    `context`, histórico como fallback). Se conserva para Análisis/Contabilidad.
 *
 * Si en modo vertical no hay insights aún, no renderiza nada (no ensucia la página).
 */

const V_LABEL = { cartera: 'Cartera', ventas: 'Ventas', margenes: 'Márgenes', compras: 'Compras' }

const TYPE_CFG = {
  gasto:       { icon: ArrowTrendingDownIcon, color: 'text-rose-300',    bg: 'bg-rose-500/15',    label: 'Gasto' },
  ingreso:     { icon: ArrowTrendingUpIcon,   color: 'text-emerald-300', bg: 'bg-emerald-500/15', label: 'Ingreso' },
  alerta:      { icon: ExclamationTriangleIcon, color: 'text-amber-300', bg: 'bg-amber-500/15',   label: 'Alerta' },
  oportunidad: { icon: LightBulbIcon,         color: 'text-violet-300',  bg: 'bg-violet-500/15',  label: 'Oportunidad' },
}

const SEV_CFG = {
  critical: { badge: 'bg-rose-500/20 text-rose-300',  label: 'CRÍTICO' },
  warning:  { badge: 'bg-amber-500/20 text-amber-300', label: 'ADVERTENCIA' },
  info:     { badge: 'bg-sky-500/20 text-sky-300',    label: 'INFO' },
}

const SEV_RANK = { critical: 0, warning: 1, info: 2 }

function ordenarPorPrioridad(list) {
  return [...list].sort((a, b) => {
    const s = (SEV_RANK[a.severity] ?? 3) - (SEV_RANK[b.severity] ?? 3)
    if (s !== 0) return s
    return Math.abs(Number(b.impact) || 0) - Math.abs(Number(a.impact) || 0)
  })
}

const fmtQ = (v) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.abs(Number(v) || 0))

export default function PageInsights({ context = 'general', vertical = null, maxInsights = 4, title: customTitle }) {
  const isVertical = !!vertical

  // En modo vertical solo importa el histórico; el generador en tiempo real se
  // pide únicamente en modo heredado.
  const { data: insightsData, isLoading: isLoadingReal } = useInsights(isVertical ? 'none' : context)
  const { data: historicoData, isLoading: isLoadingHist } = useInsightsHistorico({ limit: 100, days: 30 })

  const historico = historicoData?.data?.insights || []
  const hasRealInsights = !isVertical && insightsData?.insights?.length > 0

  const base = isVertical
    ? historico.filter(i => i.agentSource === `playbook:${vertical}`)
    : (hasRealInsights ? insightsData.insights : historico)

  const insights = ordenarPorPrioridad(base).slice(0, maxInsights)
  const isLoading = isVertical ? isLoadingHist : (isLoadingReal && isLoadingHist)

  const titles = {
    tesoreria: 'Insights de Tesorería',
    contabilidad: 'Insights Contables',
    analisis: 'Insights de Análisis',
    general: 'Análisis de IA',
  }
  const title = customTitle || (isVertical ? `Insights de ${V_LABEL[vertical] || vertical}` : (titles[context] || titles.general))

  // Skeleton delgado mientras carga.
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1a38] via-[#0b1e42] to-[#0a1730] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-violet-500/30 animate-pulse" />
          <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  // En modo vertical, sin insights => no mostrar nada.
  if (isVertical && insights.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-gradient-to-br from-[#0a1a38] via-[#0b1e42] to-[#0a1730]">
      {/* Header distintivo */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-white">{title}</h3>
              <span className="text-[10px] font-bold tracking-wide text-violet-200 bg-violet-500/20 px-1.5 py-0.5 rounded">IA</span>
            </div>
            <p className="text-xs text-slate-400">
              Análisis automatizado · {insights.length} detectado{insights.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <span className="hidden sm:flex items-center gap-1 text-xs text-slate-300">
          <BoltIcon className="w-3.5 h-3.5 text-amber-300" /> abaco AI
        </span>
      </div>

      {/* Grid de insights */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insights.length === 0 ? (
          <div className="col-span-2 p-6 text-center text-slate-400 text-sm">
            No hay insights disponibles todavía.
          </div>
        ) : (
          insights.map((ins, idx) => {
            const cfg = TYPE_CFG[ins.type] || TYPE_CFG.oportunidad
            const sev = SEV_CFG[ins.severity] || SEV_CFG.info
            const Icon = cfg.icon
            const imp = Number(ins.impact) || 0
            return (
              <div key={ins.id || idx} className="rounded-xl bg-white/[0.06] border border-white/10 p-4 hover:bg-white/[0.09] transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sev.badge}`}>{sev.label}</span>
                      <span className="text-[11px] text-slate-400">{cfg.label}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white leading-snug mb-1">{ins.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{ins.description}</p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
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
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
