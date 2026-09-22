import { useMemo } from 'react'
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useInsightsHistorico } from '../hooks/useCfoData'
import { endpoints } from '../services/cfoApi'
import InsightCard from '../components/agents/InsightCard'

/**
 * InsightsIA — Página dedicada al analista diario (playbooks).
 *
 * Muestra los insights que el cron (correr-playbooks.js) escribe cada corrida
 * en insights_historico, agrupados por vertical. A diferencia de PageInsights
 * (que prioriza el generador en tiempo real), esta página lee SOLO el histórico
 * y filtra a los que trae el analista por playbook (agent_source = 'playbook:*').
 */

// Verticales conocidas, en orden de despliegue. La clave es el slug del playbook.
const VERTICALES = [
  { slug: 'cartera',  titulo: 'Cartera y cobranza',      desc: 'Cobranza, aging y concentración de crédito' },
  { slug: 'ventas',   titulo: 'Ventas y crecimiento',    desc: 'Tendencia, mix de producto y clientes' },
  { slug: 'margenes', titulo: 'Márgenes y rentabilidad', desc: 'Margen bruto, repricing y productos que pierden' },
  { slug: 'compras',  titulo: 'Compras y pagos',         desc: 'Gasto con proveedores y cuentas por pagar' },
]

function slugDeSource(agentSource) {
  // 'playbook:cartera' -> 'cartera'
  return (agentSource || '').startsWith('playbook:') ? agentSource.split(':')[1] : null
}

export default function InsightsIA() {
  const { data, isLoading, error, refetch, isFetching } = useInsightsHistorico({ limit: 100, days: 30 })

  const insights = data?.data?.insights || []

  // Solo los del analista por playbook, agrupados por vertical.
  const { porVertical, ultimaCorrida, total } = useMemo(() => {
    const delAnalista = insights.filter(i => slugDeSource(i.agentSource))
    const grupos = {}
    let ultima = null
    for (const ins of delAnalista) {
      const slug = slugDeSource(ins.agentSource)
      ;(grupos[slug] = grupos[slug] || []).push(ins)
      if (ins.createdAt && (!ultima || new Date(ins.createdAt) > new Date(ultima))) ultima = ins.createdAt
    }
    return { porVertical: grupos, ultimaCorrida: ultima, total: delAnalista.length }
  }, [insights])

  const handleDismiss = async (insight) => {
    try {
      await endpoints.analisis.dismissInsight(insight.id)
      refetch()
    } catch (e) {
      console.warn('No se pudo descartar el insight:', e?.message)
    }
  }

  const fechaTexto = ultimaCorrida
    ? new Date(ultimaCorrida).toLocaleString('es-GT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shrink-0">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Insights de IA</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Análisis diario automático del negocio, por vertical.
              {fechaTexto && <> Última corrida: <span className="font-medium text-slate-600">{fechaTexto}</span>.</>}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 transition-colors shrink-0"
          title="Actualizar"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Estados */}
      {isLoading && (
        <div className="text-center py-20 text-slate-400 text-sm">Cargando insights…</div>
      )}

      {error && !isLoading && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm">
          No se pudieron cargar los insights. Intenta actualizar.
        </div>
      )}

      {!isLoading && !error && total === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-500 text-sm">
            Todavía no hay insights del analista. Corren automáticamente cada dos días por la mañana.
          </p>
        </div>
      )}

      {/* Grupos por vertical */}
      {!isLoading && total > 0 && (
        <div className="space-y-8">
          {VERTICALES.filter(v => (porVertical[v.slug] || []).length).map(v => {
            const items = porVertical[v.slug] || []
            return (
              <section key={v.slug}>
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{v.titulo}</h2>
                    <p className="text-xs text-slate-500">{v.desc}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{items.length} insights</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {items.map(ins => (
                    <InsightCard key={ins.id} insight={ins} compact={false} onDismiss={handleDismiss} />
                  ))}
                </div>
              </section>
            )
          })}

          {/* Verticales sin insights en esta corrida (informativo) */}
          {VERTICALES.some(v => !(porVertical[v.slug] || []).length) && (
            <p className="text-xs text-slate-400 pt-2">
              Sin hallazgos nuevos en:{' '}
              {VERTICALES.filter(v => !(porVertical[v.slug] || []).length).map(v => v.titulo).join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
