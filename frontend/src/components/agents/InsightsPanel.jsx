import { useState, useEffect } from 'react'
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  CheckIcon,
  ChevronRightIcon,
  BellIcon
} from '@heroicons/react/24/outline'

/**
 * InsightsPanel - Panel completo para mostrar insights de IA
 * 
 * Props:
 * - insights: array de objetos insight
 * - onDismiss: callback al descartar un insight
 * - onAction: callback al ejecutar acción sugerida
 * - onViewAll: callback al ver todos los insights
 * - maxDisplay: número máximo de insights a mostrar (default 5)
 * - title: título del panel (default "Análisis de IA")
 * - showHeader: mostrar header con contador (default true)
 */
export default function InsightsPanel({
  insights = [],
  onDismiss,
  onAction,
  onViewAll,
  maxDisplay = 5,
  title = "Análisis de IA",
  showHeader = true
}) {
  const [dismissedIds, setDismissedIds] = useState(new Set())
  const [visibleInsights, setVisibleInsights] = useState([])
  const [animateIndex, setAnimateIndex] = useState(-1)

  // Filtrar insights no descartados y limitar cantidad
  useEffect(() => {
    const filtered = insights
      .filter(insight => !dismissedIds.has(insight.id))
      .slice(0, maxDisplay)
    setVisibleInsights(filtered)
    
    // Iniciar animación escalonada
    setAnimateIndex(-1)
    filtered.forEach((_, index) => {
      setTimeout(() => {
        setAnimateIndex(prev => Math.max(prev, index))
      }, index * 100)
    })
  }, [insights, dismissedIds, maxDisplay])

  const handleDismiss = (insight) => {
    setDismissedIds(prev => new Set([...prev, insight.id]))
    onDismiss?.(insight)
  }

  const handleMarkAllAsRead = () => {
    const allIds = visibleInsights.map(i => i.id)
    setDismissedIds(prev => new Set([...prev, ...allIds]))
    allIds.forEach(id => {
      const insight = insights.find(i => i.id === id)
      if (insight) onDismiss?.(insight)
    })
  }

  // Configuración de iconos por tipo
  const typeConfig = {
    gasto: {
      icon: ArrowTrendingDownIcon,
      iconColor: 'text-rose-500',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-100',
      label: 'Gasto'
    },
    ingreso: {
      icon: ArrowTrendingUpIcon,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
      label: 'Ingreso'
    },
    alerta: {
      icon: ExclamationTriangleIcon,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
      label: 'Alerta'
    },
    oportunidad: {
      icon: LightBulbIcon,
      iconColor: 'text-violet-500',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-100',
      label: 'Oportunidad'
    }
  }

  // Configuración de severidad
  const severityConfig = {
    info: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      ring: 'ring-blue-600/20',
      label: 'Info'
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      ring: 'ring-amber-600/20',
      label: 'Advertencia'
    },
    critical: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      ring: 'ring-rose-600/20',
      label: 'Crítico'
    }
  }

  // Formatear moneda
  const formatCurrency = (value, currency = 'GTQ') => {
    if (value === undefined || value === null) return ''
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(value))
  }

  // Contar insights no vistos
  const unseenCount = insights.filter(i => !dismissedIds.has(i.id)).length
  const hasCritical = visibleInsights.some(i => i.severity === 'critical')

  if (visibleInsights.length === 0 && dismissedIds.size > 0) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckIcon className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">¡Todo al día!</h3>
        <p className="text-sm text-slate-500 mt-1">No tienes insights pendientes por revisar</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasCritical ? 'bg-rose-100' : 'bg-primary-50'}`}>
                <SparklesIcon className={`w-5 h-5 ${hasCritical ? 'text-rose-500' : 'text-primary-600'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500">
                  {unseenCount === 0 ? 'No hay insights nuevos' : `${unseenCount} insight${unseenCount !== 1 ? 's' : ''} pendiente${unseenCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {unseenCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-slate-500 hover:text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  Marcar todo como visto
                </button>
              )}
              {onViewAll && (
                <button
                  onClick={onViewAll}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  Ver todos
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de insights */}
      <div className="divide-y divide-slate-100">
        {visibleInsights.map((insight, index) => {
          const config = typeConfig[insight.type] || typeConfig.oportunidad
          const severity = severityConfig[insight.severity] || severityConfig.info
          const IconComponent = config.icon
          const isVisible = index <= animateIndex

          return (
            <div
              key={insight.id}
              className={`p-5 transition-all duration-300 hover:bg-slate-50 ${
                isVisible 
                  ? 'opacity-100 translate-x-0' 
                  : 'opacity-0 -translate-x-4'
              }`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Icono del tipo */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${config.bgColor} ${config.borderColor} border flex items-center justify-center`}>
                  <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
                </div>

                {/* Contenido principal */}
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${severity.bg} ${severity.text} ${severity.ring}`}>
                      {severity.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.iconColor}`}>
                      {config.label}
                    </span>
                    {insight.isNew && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 animate-pulse">
                        <BellIcon className="w-3 h-3 mr-1" />
                        Nuevo
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h4 className="text-base font-semibold text-slate-900 mb-1">
                    {insight.title}
                  </h4>

                  {/* Descripción */}
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                    {insight.description}
                  </p>

                  {/* Impacto y acción */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Monto de impacto */}
                    {insight.impact !== undefined && insight.impact !== 0 && (
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-slate-500">Impacto:</span>
                        <span className={`text-sm font-bold ${insight.impact > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {insight.impact > 0 ? '+' : '-'}{formatCurrency(insight.impact, insight.currency)}
                        </span>
                      </div>
                    )}

                    {/* Acción sugerida */}
                    {insight.action && (
                      <button
                        onClick={() => onAction?.(insight)}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        {insight.actionLabel || 'Ver acción sugerida'}
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Metadata adicional */}
                  {(insight.change !== undefined || insight.category) && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                      {insight.change !== undefined && (
                        <span className={`font-medium ${insight.change > 0 ? 'text-emerald-600' : insight.change < 0 ? 'text-rose-600' : ''}`}>
                          {insight.change > 0 ? '+' : ''}{insight.change}% vs período anterior
                        </span>
                      )}
                      {insight.category && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded">
                          {insight.category}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleDismiss(insight)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Marcar como visto"
                  >
                    <EyeSlashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {insights.length > maxDisplay && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={onViewAll}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Ver {insights.length - maxDisplay} insights más
          </button>
        </div>
      )}
    </div>
  )
}