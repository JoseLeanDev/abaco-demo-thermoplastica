import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTesoreriaProyeccion } from '../hooks/useCfoData'
import { UMBRAL_SALDO_CRITICO } from '../config/constants'
import { 
  ArrowLeftIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'

export default function ProyeccionesFinancieras() {
  const [semanas, setSemanas] = useState(13)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const { data: proyeccion, isLoading } = useTesoreriaProyeccion(semanas)
  
  const proyeccionData = proyeccion?.data || {}
  const datos = proyeccionData.proyeccion || []
  const resumen = proyeccionData.resumen || {}

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#001639] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-[var(--text-muted)]">Cargando proyección...</p>
      </div>
    )
  }

  const saldoInicial = datos[0]?.saldo_acumulado || 0
  const saldoFinal = datos[datos.length - 1]?.saldo_acumulado || 0
  const variacion = saldoInicial > 0 ? ((saldoFinal - saldoInicial) / saldoInicial * 100).toFixed(1) : 0

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/tesoreria" 
            className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Proyecciones Financieras</h1>
              <p className="text-sm text-[var(--text-muted)]">Análisis de flujo de caja a {semanas} semanas</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {[4, 8, 13, 26].map(n => (
            <button
              key={n}
              onClick={() => setSemanas(n)}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                semanas === n 
                  ? 'bg-[#001639] text-white' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {n} sem
            </button>
          ))}
        </div>
      </div>

      {/* Indicadores Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <span className="kpi-label">Saldo Inicial</span>
          <p className="kpi-value">Q{saldoInicial.toLocaleString()}</p>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Saldo Final</span>
            <span className={`text-sm font-medium ${parseFloat(variacion) >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {parseFloat(variacion) >= 0 ? '+' : ''}{variacion}%
            </span>
          </div>
          <p className="kpi-value">Q{saldoFinal.toLocaleString()}</p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">Saldo Mínimo</span>
          <p className={`kpi-value ${resumen.saldo_minimo_proyectado < UMBRAL_SALDO_CRITICO ? 'text-[var(--danger)]' : ''}`}>
            Q{(resumen.saldo_minimo_proyectado || 0).toLocaleString()}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Semana {resumen.semana_critica || '—'}</p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">Riesgo</span>
          <div className="mt-1">
            {resumen.riesgo_quiebra_tecnica ? (
              <span className="inline-flex items-center gap-1 text-[var(--danger)] font-semibold">
                <ExclamationTriangleIcon className="w-5 h-5" /> Alto
              </span>
            ) : (
              <span className="text-[var(--success)] font-semibold">✓ Bajo</span>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold">Evolución del Saldo</h2>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span> Alta certeza
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-300"></span> Media/Baja
            </span>
          </div>
        </div>

        <div className="h-64 relative">
          <div className="absolute inset-0 flex items-end">
            {datos.map((d, i) => {
              const max = Math.max(...datos.map(x => x.saldo_acumulado))
              const min = Math.min(...datos.map(x => x.saldo_acumulado))
              const range = max - min || 1
              const height = ((d.saldo_acumulado - min) / range) * 80 + 10
              const isCrit = d.saldo_acumulado < UMBRAL_SALDO_CRITICO
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#001639] text-white text-xs py-2 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    <div className="font-bold mb-1">Semana {d.semana}</div>
                    <div>Saldo: Q{d.saldo_acumulado.toLocaleString()}</div>
                    <div className={d.neto >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      Neto: {d.neto >= 0 ? '+' : ''}Q{d.neto.toLocaleString()}
                    </div>
                  </div>
                  
                  <div 
                    className={`w-full mx-0.5 rounded-t-md transition-all ${
                      isCrit 
                        ? 'bg-rose-400' 
                        : d.certeza === 'alta' 
                          ? 'bg-blue-500' 
                          : 'bg-blue-300'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        
        <div className="flex justify-between mt-2 px-2">
          <span className="text-xs text-[var(--text-muted)]">S1</span>
          <span className="text-xs text-[var(--text-muted)]">S{Math.ceil(datos.length / 2)}</span>
          <span className="text-xs text-[var(--text-muted)]">S{datos.length}</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-between">
          <h2 className="font-semibold">Detalle Semanal</h2>
          <button
            onClick={() => setMostrarTodos(!mostrarTodos)}
            className="text-sm text-[var(--accent-blue)] hover:underline flex items-center gap-1"
          >
            {mostrarTodos ? (<><ChevronUpIcon className="w-4 h-4" /> Mostrar menos</>) : (
              <><ChevronDownIcon className="w-4 h-4" /> Ver todas ({datos.length})</>
            )}
          </button>
        </div>

        <div className="divide-y divide-[var(--border-default)]">
          {(mostrarTodos ? datos : datos.slice(0, 5)).map((semana, i) => (
            <div 
              key={i} 
              className={`p-4 flex items-center justify-between hover:bg-[var(--bg-secondary)] ${
                semana.saldo_acumulado < 1000000 ? 'bg-rose-50' : ''
              }`}
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center font-bold">
                  {semana.semana}
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">{semana.fecha_inicio}</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                    semana.certeza === 'alta' 
                      ? 'badge-success' 
                      : semana.certeza === 'media'
                        ? 'badge-warning'
                        : 'badge'
                  }`}>
                    {semana.certeza}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Entradas</p>
                  <p className="font-medium text-[var(--success)]">+{semana.entradas.toLocaleString()}</p>
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Salidas</p>
                  <p className="font-medium text-[var(--danger)]">-{semana.salidas.toLocaleString()}</p>
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Neto</p>
                  <p className={`font-bold ${semana.neto >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {semana.neto >= 0 ? '+' : ''}{semana.neto.toLocaleString()}
                  </p>
                </div>
                
                <div className="text-right w-32">
                  <p className="text-xs text-[var(--text-muted)]">Saldo</p>
                  <p className={`text-xl font-bold ${semana.saldo_acumulado < UMBRAL_SALDO_CRITICO ? 'text-[var(--danger)]' : ''}`}>
                    Q{semana.saldo_acumulado.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <LightBulbIcon className="w-5 h-5" /> Recomendaciones
        </h3>
        <ul className="space-y-2 text-amber-800 text-sm">
          {resumen.riesgo_quiebra_tecnica && (
            <li>• El saldo cae por debajo de Q1M. Considera acelerar cobros o negociar crédito.</li>
          )}
          {parseFloat(variacion) < -10 && (
            <li>• Tendencia negativa del {variacion}%. Revisa gastos operativos.</li>
          )}
          <li>• Las proyecciones más allá de 8 semanas tienen menor certeza.</li>
          <li>• Actualiza datos de CxC y CxP regularmente para mejorar precisión.</li>
        </ul>
      </div>
    </div>
  )
}
