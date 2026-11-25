import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'
import { dec2 } from '../analisis/formato'

/**
 * InsightCard - Componente compacto para mostrar insights en dashboard
 * 
 * Props:
 * - insight: { id, type, title, description, impact, change, currency, severity, isNew }
 * - onView: callback al hacer click para ver detalle
 * - onDismiss: callback al descartar
 * - compact: boolean (default true) - modo compacto vs expandido
 */
export default function InsightCard({ 
  insight, 
  onView, 
  onDismiss,
  compact = true 
}) {
  const { 
    type, 
    title, 
    description, 
    impact, 
    change, 
    currency = 'GTQ', 
    severity = 'info',
    isNew = false 
  } = insight

  // Iconos según tipo de insight
  const typeIcons = {
    gasto: { icon: ArrowTrendingDownIcon, color: 'text-rose-500', bg: 'bg-rose-50' },
    ingreso: { icon: ArrowTrendingUpIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    alerta: { icon: ExclamationTriangleIcon, color: 'text-amber-500', bg: 'bg-amber-50' },
    oportunidad: { icon: LightBulbIcon, color: 'text-violet-500', bg: 'bg-violet-50' }
  }

  const typeConfig = typeIcons[type] || typeIcons.oportunidad
  const IconComponent = typeConfig.icon

  // Colores de severidad para badge
  const severityStyles = {
    info: 'bg-blue-100 text-blue-700 ring-blue-600/20',
    warning: 'bg-amber-100 text-amber-700 ring-amber-600/20',
    critical: 'bg-rose-100 text-rose-700 ring-rose-600/20'
  }

  // Formatear moneda
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return ''
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Color de variación
  const getChangeColor = () => {
    if (!change) return 'text-slate-400'
    return change > 0 ? 'text-emerald-600' : change < 0 ? 'text-rose-600' : 'text-slate-400'
  }

  const getChangePrefix = () => {
    if (!change) return ''
    return change > 0 ? '+' : ''
  }

  if (compact) {
    return (
      <div 
        onClick={() => onView?.(insight)}
        className="group relative bg-white rounded-xl border border-slate-200 p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary-300 hover:-translate-y-0.5"
      >
        {/* Indicador de nuevo */}
        {isNew && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full border-2 border-white animate-pulse" />
        )}

        <div className="flex items-start gap-3">
          {/* Icono */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${typeConfig.bg} flex items-center justify-center`}>
            <IconComponent className={`w-5 h-5 ${typeConfig.color}`} />
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary-600 transition-colors">
                {title}
              </h4>
              {change !== undefined && (
                <span className={`text-xs font-medium ${getChangeColor()}`}>
                  {getChangePrefix()}{dec2(change)}%
                </span>
              )}
            </div>
            
            <p className="mt-1 text-xs text-slate-500 line-clamp-2 group-hover:text-slate-600 transition-colors">
              {description}
            </p>

            {/* Impacto y acción en hover */}
            <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {impact !== undefined && impact !== 0 && (
                <span className={`text-xs font-semibold ${impact > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Impacto: {formatCurrency(Math.abs(impact))}
                </span>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onView?.(insight)
                }}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Ver detalle
                <ArrowRightIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Hover overlay con detalle completo */}
        <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 -z-10 shadow-xl" />
      </div>
    )
  }

  // Versión expandida (no compact)
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${typeConfig.bg} flex items-center justify-center`}>
          <IconComponent className={`w-6 h-6 ${typeConfig.color}`} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${severityStyles[severity]}`}>
              {severity === 'info' && 'Info'}
              {severity === 'warning' && 'Advertencia'}
              {severity === 'critical' && 'Crítico'}
            </span>
            {isNew && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                Nuevo
              </span>
            )}
          </div>
          
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          
          {impact !== undefined && impact !== 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-slate-500">Impacto estimado:</span>
              <span className={`text-lg font-bold ${impact > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(Math.abs(impact))}
              </span>
            </div>
          )}
          
          {change !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-500">Variación:</span>
              <span className={`text-sm font-semibold ${getChangeColor()}`}>
                {getChangePrefix()}{dec2(change)}%
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onView?.(insight)}
            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Ver detalle"
          >
            <EyeIcon className="w-5 h-5" />
          </button>
          {onDismiss && (
            <button
              onClick={() => onDismiss(insight)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Descartar"
            >
              <EyeSlashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}