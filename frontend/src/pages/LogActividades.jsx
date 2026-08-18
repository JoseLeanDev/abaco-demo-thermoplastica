import { useState } from 'react'
import { useAgentesLogs } from '../hooks/useCfoData'
import { 
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  WalletIcon,
  PresentationChartBarIcon,
  DocumentTextIcon,
  BookOpenIcon,
  ChartBarIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline'

// NUEVO: 4 Agentes Especializados v2.0
const agenteConfig = {
  'caja': { 
    nombre: 'Caja', 
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: WalletIcon,
    desc: 'Proyección cash flow, runway, posición'
  },
  'analisis': { 
    nombre: 'Análisis', 
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: PresentationChartBarIcon,
    desc: 'KPIs, rentabilidad, RFM, anomalías'
  },
  'cobranza': { 
    nombre: 'Cobranza', 
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: DocumentTextIcon,
    desc: 'CxC antigüedad, DSO, CCC, cobro'
  },
  'contabilidad': { 
    nombre: 'Contabilidad', 
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: BookOpenIcon,
    desc: 'Cierre mensual, fiscal, conciliación'
  },
  'orchestrator': { 
    nombre: 'abaco Core', 
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: CpuChipIcon,
    desc: 'Orquestador y briefing diario'
  },
}

const categoriaConfig = {
  posicion_caja: { 
    label: 'Caja', 
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: WalletIcon 
  },
  proyeccion_cashflow: { 
    label: 'Cash Flow', 
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: PresentationChartBarIcon 
  },
  kpis_diarios: { 
    label: 'KPIs', 
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: PresentationChartBarIcon 
  },
  analisis_semanal: { 
    label: 'Análisis Sem', 
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: PresentationChartBarIcon 
  },
  analisis_mensual: { 
    label: 'Análisis Mes', 
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: PresentationChartBarIcon 
  },
  aging_cartera: { 
    label: 'Aging', 
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: DocumentTextIcon 
  },
  metricas_cobranza: { 
    label: 'Cobranza', 
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: DocumentTextIcon 
  },
  importacion_transacciones: { 
    label: 'Importar', 
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: BookOpenIcon 
  },
  conciliacion_bancaria: { 
    label: 'Conciliación', 
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: BookOpenIcon 
  },
  cierre_mensual: { 
    label: 'Cierre', 
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: BookOpenIcon 
  },
  calculos_fiscales: { 
    label: 'Fiscal', 
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: BookOpenIcon 
  },
  error_sistema: { 
    label: 'Error', 
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: XCircleIcon 
  },
  briefing_diario: { 
    label: 'Briefing', 
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: CpuChipIcon 
  }
}

const statusConfig = {
  exitoso: { 
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: CheckCircleIcon,
    label: 'Éxito'
  },
  advertencia: { 
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: ExclamationTriangleIcon,
    label: 'Advertencia'
  },
  error: { 
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: XCircleIcon,
    label: 'Error'
  }
}

export default function LogActividades() {
  const [filtroAgente, setFiltroAgente] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [expandedLog, setExpandedLog] = useState(null)
  
  const [filtroDias, setFiltroDias] = useState(30)
  
  const { data, isLoading, refetch } = useAgentesLogs({ 
    limit: 100,
    agente: filtroAgente || undefined,
    categoria: filtroCategoria || undefined,
    status: filtroStatus || undefined,
    dias: filtroDias
  })

  // Debug: log de respuesta del API
  if (data?.data) {
    console.log('Agentes logs:', data.data)
  }

  const logs = data?.data?.logs || []
  const stats = data?.data?.estadisticas || {}

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-GT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuracion = (ms) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#001639] flex items-center justify-center">
            <CpuChipIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Agentes de IA</h1>
            <p className="text-sm text-[var(--text-muted)]">Monitoreo del sistema multi-agente</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => refetch()}
            className="btn-secondary text-xs"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Actualizar
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success-bg)]">
            <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
            <span className="text-xs font-medium text-[var(--success)]">4 Agentes Activos</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Total Actividades</span>
            <ChartBarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{stats?.total || logs.length}</div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Éxitos</span>
            <CheckCircleIcon className="w-4 h-4 text-[var(--success)]" />
          </div>
          <div className="kpi-value text-[var(--success)]">{stats?.por_status?.exitoso || 0}</div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Advertencias</span>
            <ExclamationTriangleIcon className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div className="kpi-value text-[var(--warning)]">{stats?.por_status?.advertencia || 0}</div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Errores</span>
            <XCircleIcon className="w-4 h-4 text-[var(--danger)]" />
          </div>
          <div className="kpi-value text-[var(--danger)]">{stats?.por_status?.error || 0}</div>
        </div>
      </div>

      {/* Agentes Status */}
      <div className="card">
        <div className="section-header">
          <CpuChipIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Estado de Agentes</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-5 pt-0">
          {Object.entries(agenteConfig).filter(([key]) => key !== 'orchestrator').map(([key, config]) => (
            <div key={key} className={`p-4 rounded-lg ${config.bg} border ${config.border}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded bg-white flex items-center justify-center`}>
                  <config.icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${config.color}`}>{config.nombre}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{config.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]"></span>
                <span className="text-xs text-[var(--text-secondary)]">Operativo</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Agente</label>
            <select value={filtroAgente} onChange={(e) => setFiltroAgente(e.target.value)} className="input">
              <option value="">Todos</option>
              <option value="caja">💰 Caja</option>
              <option value="analisis">📊 Análisis</option>
              <option value="cobranza">📋 Cobranza</option>
              <option value="contabilidad">📅 Contabilidad</option>
              <option value="orchestrator">🤖 abaco Core</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Categoría</label>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="input">
              <option value="">Todas</option>
              <option value="posicion_caja">💰 Posición Caja</option>
              <option value="proyeccion_cashflow">📊 Proyección Cash Flow</option>
              <option value="kpis_diarios">📈 KPIs Diarios</option>
              <option value="analisis_semanal">📉 Análisis Semanal</option>
              <option value="aging_cartera">📋 Antigüedad Cartera</option>
              <option value="metricas_cobranza">📊 Métricas Cobranza</option>
              <option value="conciliacion_bancaria">🏦 Conciliación</option>
              <option value="cierre_mensual">📅 Cierre Mensual</option>
              <option value="calculos_fiscales">📋 Cálculos Fiscales</option>
              <option value="briefing_diario">🌅 Briefing Diario</option>
              <option value="error_sistema">❌ Errores</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Estado</label>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input">
              <option value="">Todos</option>
              <option value="exitoso">Éxito</option>
              <option value="advertencia">Advertencia</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Período</label>
            <select value={filtroDias} onChange={(e) => setFiltroDias(Number(e.target.value))} className="input">
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={365}>Último año</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <h2 className="font-semibold">Logs de Actividad</h2>
          <span className="text-xs text-[var(--text-muted)]">{logs.length} registros</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-[#001639] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">Cargando...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <CommandLineIcon className="w-6 h-6" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">No hay logs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Actividad</th>
                  <th>Estado</th>
                  <th>Duración</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ageConfig = agenteConfig[log.agenteTipo] || agenteConfig.orchestrator
                  const catConfig = categoriaConfig[log.categoria] || { label: log.categoria || 'General', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: CommandLineIcon }
                  const statusCfg = statusConfig[log.resultadoStatus] || statusConfig.exitoso
                  const isExpanded = expandedLog === log.id
                  
                  return (
                    <>
                      <tr 
                        key={log.id}
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="cursor-pointer hover:bg-[var(--bg-secondary)]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${ageConfig.color.replace('text-', 'bg-')}`} />
                            <span className="font-medium">{ageConfig.nombre}</span>
                          </div>
                        </td>
                        
                        <td className="px-4 py-3">
                          <span className={`badge ${catConfig.bg} ${catConfig.color} border ${catConfig.border}`}>
                            {catConfig.label}
                          </span>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">{log.descripcion}</p>
                        </td>
                        
                        <td className="px-4 py-3">
                          <span className={`badge ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}>
                            <statusCfg.icon className="w-3.5 h-3.5" />
                            {statusCfg.label}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs">{formatDuracion(log.duracionMs)}</span>
                        </td>
                        
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ClockIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span className="text-xs text-[var(--text-muted)]">{formatFecha(log.fecha || log.createdAt)}</span>
                            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                          </div>
                        </td>
                      </tr>
                      
                      {isExpanded && log.detallesJson && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 bg-[var(--bg-secondary)]">
                            <pre className="text-xs font-mono overflow-x-auto p-3 bg-white rounded border border-[var(--border-default)]">
                              {JSON.stringify(JSON.parse(log.detallesJson), null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
