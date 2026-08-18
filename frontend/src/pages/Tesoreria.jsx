import { Link } from 'react-router-dom'
import { useTesoreriaPosicion, useTesoreriaCxC, useTesoreriaCxP, useTesoreriaProyeccion, useWorkingCapital } from '../hooks/useCfoData'
import PageInsights from '../components/agents/PageInsights'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { 
  BanknotesIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  ClockIcon,
  BuildingLibraryIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline'

// Format currency
const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0'
  return 'Q ' + value.toLocaleString('es-GT')
}

export default function Tesoreria() {
  const { data: posicion, isLoading: loadingPos } = useTesoreriaPosicion()
  const { data: cxc, isLoading: loadingCxC } = useTesoreriaCxC()
  const { data: cxp, isLoading: loadingCxP } = useTesoreriaCxP()
  const { data: proyeccion, isLoading: loadingProy } = useTesoreriaProyeccion(13)
  const { data: workingCapital, isLoading: loadingWC } = useWorkingCapital({ meses: 6 })

  const posicionData = posicion?.data || {}
  const cxcData = cxc?.data || {}
  const cxpData = cxp?.data || {}
  const proyeccionData = proyeccion?.data || {}
  const wcData = workingCapital?.data || {}
  const metricas = wcData.metricas_principales || {}

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
          <BanknotesIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Tesorería</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Posición al {posicionData.fecha_corte} • Tipo de cambio: Q{posicionData.tipo_cambio}
          </p>
        </div>
      </div>

      {/* Análisis de IA */}
      <PageInsights context="tesoreria" maxInsights={3} />

      {/* Indicadores Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Disponible GTQ</span>
            <span className="badge-success">Local</span>
          </div>
          <div className="kpi-value">
            {loadingPos ? '---' : formatGTQ(posicionData.total_disponible_gtq)}
          </div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Disponible USD</span>
            <span className="badge-info">USD</span>
          </div>
          <div className="kpi-value">
            {loadingPos ? '---' : new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0
            }).format(posicionData.total_disponible_usd)}
          </div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Total Consolidado</span>
            <ArrowTrendingUpIcon className="w-4 h-4 text-[var(--success)]" />
          </div>
          <div className="kpi-value">
            {loadingPos ? '---' : formatGTQ(posicionData.total_consolidado_gtq)}
          </div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Días Operación</span>
            <ClockIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className={`kpi-value ${posicionData.dias_operacion < 30 ? 'text-[var(--danger)]' : ''}`}>
            {loadingPos ? '---' : `${posicionData.dias_operacion} días`}
          </div>
          {posicionData.dias_operacion < 30 && (
            <span className="text-xs text-[var(--danger)]">Atención</span>
          )}
        </div>
      </div>

      {/* Ciclo de Conversión Section */}
      <div className="card">
        <div className="section-header">
          <ArrowPathIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <div className="flex-1">
            <h2 className="font-semibold">Ciclo de Conversión</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {metricas.c2c?.interpretacion || 'Calculando...'} • Referencia: {metricas.c2c?.benchmark || '—'} días
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${
              (metricas.c2c?.valor || 0) < 30 ? 'text-emerald-600' : 
              (metricas.c2c?.valor || 0) < 60 ? 'text-amber-600' : 
              (metricas.c2c?.valor || 0) < 90 ? 'text-orange-600' : 'text-rose-600'
            }`}>
              {loadingWC ? '—' : `${metricas.c2c?.valor || 0} días`}
            </span>
          </div>
        </div>
        
        <div className="p-5 pt-0">
          {loadingWC ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#001639] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* CCC Visualization */}
              <div className="flex items-center justify-between mb-6">
                {/* DIO */}
                <div className="flex-1 text-center">
                  <div className="text-3xl font-bold text-blue-600">{metricas.dio?.valor || 0}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">DIO</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Días de Proceso</div>
                </div>
                
                <div className="text-2xl text-[var(--text-muted)]">+</div>
                
                {/* DSO */}
                <div className="flex-1 text-center">
                  <div className="text-3xl font-bold text-purple-600">{metricas.dso?.valor || 0}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">DSO</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Días Cobro</div>
                </div>
                
                <div className="text-2xl text-[var(--text-muted)]">−</div>
                
                {/* DPO */}
                <div className="flex-1 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{metricas.dpo?.dias_real || 0}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">DPO</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Días Pago</div>
                </div>
                
                <div className="text-2xl text-[var(--text-muted)]">=</div>
                
                {/* C2C */}
                <div className="flex-1 text-center">
                  <div className={`text-3xl font-bold ${
                    (metricas.c2c?.valor || 0) < 30 ? 'text-emerald-600' : 
                    (metricas.c2c?.valor || 0) < 60 ? 'text-amber-600' : 
                    (metricas.c2c?.valor || 0) < 90 ? 'text-orange-600' : 'text-rose-600'
                  }`}>
                    {metricas.c2c?.valor || 0}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">CCC</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Ciclo de Efectivo</div>
                </div>
              </div>
              
              {/* Progress bar visualization */}
              <div className="relative h-4 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-4">
                <div className="absolute left-0 h-full bg-blue-500" style={{ width: `${Math.min((metricas.dio?.valor || 0) / 120 * 100, 33)}%` }} />
                <div className="absolute h-full bg-purple-500" style={{ left: `${Math.min((metricas.dio?.valor || 0) / 120 * 100, 33)}%`, width: `${Math.min((metricas.dso?.valor || 0) / 120 * 100, 33)}%` }} />
                <div className="absolute h-full bg-emerald-500" style={{ right: '0', width: `${Math.min((metricas.dpo?.dias_real || 0) / 120 * 100, 33)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-muted)] mb-6">
                <span className="text-blue-600">Proceso</span>
                <span className="text-purple-600">Cobro</span>
                <span className="text-emerald-600">Pago</span>
              </div>
              
              {/* Recommendations */}
              {wcData.recomendaciones?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <LightBulbIcon className="w-4 h-4 text-amber-500" />
                    Acciones Recomendadas
                  </h3>
                  {wcData.recomendaciones.slice(0, 2).map((rec, idx) => (
                    <div key={idx} className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{rec.titulo}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">{rec.descripcion}</p>
                          {rec.acciones?.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {rec.acciones.slice(0, 2).map((acc, i) => (
                                <li key={i} className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-[var(--accent-blue)]" />
                                  {acc}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {rec.impacto_efectivo > 0 && (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                            +Q{rec.impacto_efectivo.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Alertas */}
              {wcData.alertas?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {wcData.alertas.map((alerta, idx) => (
                    <div key={idx} className={`p-3 rounded-lg flex items-start gap-2 ${
                      alerta.severidad === 'critica' ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'
                    }`}>
                      <ExclamationTriangleIcon className={`w-4 h-4 flex-shrink-0 ${
                        alerta.severidad === 'critica' ? 'text-rose-500' : 'text-amber-500'
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${
                          alerta.severidad === 'critica' ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                          {alerta.mensaje}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{alerta.accion_urgente}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cuentas Bancarias - OCULTO para Thermoplastica */}
        {/*
        <div className="card">
          <div className="section-header">
            <BuildingLibraryIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Cuentas Bancarias</h2>
            <Link to="/tesoreria/cuentas-bancarias" className="ml-auto btn-secondary text-xs">
              Ver todas
              <ArrowRightIcon className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="space-y-3 p-5 pt-0">
            {loadingPos ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
              ))
            ) : (
              posicionData.cuentas?.map((cuenta, idx) => (
                <div 
                  key={`${cuenta.banco}-${cuenta.moneda}-${idx}`}
                  className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      cuenta.moneda === 'USD' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      <span className="font-bold text-sm">{cuenta.moneda}</span>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{cuenta.banco}</p>
                      <p className="text-sm text-[var(--text-muted)] capitalize">{cuenta.tipo}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="amount">
                      {new Intl.NumberFormat('es-GT', {
                        style: 'currency',
                        currency: cuenta.moneda,
                        minimumFractionDigits: 0
                      }).format(cuenta.saldo)}
                    </p>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      {cuenta.dias_sin_conciliar > 2 ? (
                        <span className="badge-warning text-[10px]">
                          <ExclamationTriangleIcon className="w-3 h-3" />
                          Sin conciliar
                        </span>
                      ) : (
                        <span className="badge-success text-[10px]">
                          <CheckCircleIcon className="w-3 h-3" />
                          Conciliado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        */}

        {/* CxC - Antigüedad */}
        <div className="card">
          <div className="section-header">
            <ArrowTrendingUpIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <div className="flex-1">
              <h2 className="font-semibold">Cuentas por Cobrar</h2>
              <p className="text-xs text-[var(--text-muted)]">Promedio {cxcData.promedio_dias_cobro} días</p>
            </div>
            <span className="amount">{formatGTQ(cxcData.total_cxc)}</span>
          </div>
          
          <div className="space-y-4 p-5 pt-0">
            {Object.entries(cxcData.distribucion_aging || {}).map(([rango, datos]) => {
              const config = {
                al_corriente: { label: 'Al corriente', color: 'bg-emerald-500' },
                _30_dias: { label: '1-30 días', color: 'bg-amber-500' },
                _60_dias: { label: '31-60 días', color: 'bg-orange-500' },
                _90_dias: { label: '60+ días', color: 'bg-rose-500' }
              }[rango] || { label: rango, color: 'bg-gray-500' }

              return (
                <div key={rango} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">{config.label}</span>
                    <span className="font-semibold tabular-nums">
                      Q{(datos.monto || 0).toLocaleString()} ({datos.porcentaje}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${config.color}`} style={{ width: `${datos.porcentaje}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Top Deudores */}
          <div className="mt-4 p-5 pt-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Top Deudores</p>
              <Link to="/tesoreria/cuentas-por-cobrar" className="text-xs text-[var(--accent-blue)] hover:underline">
                Ver todas →
              </Link>
            </div>
            <div className="space-y-2">
              {cxcData.top_deudores?.slice(0, 3).map((deudor, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-white text-[var(--text-muted)] text-xs font-medium flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-[var(--text-primary)] truncate max-w-[180px]">{deudor.cliente}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium tabular-nums ${deudor.dias > 60 ? 'text-[var(--danger)]' : ''}`}>
                      Q{deudor.monto.toLocaleString()}
                    </span>
                    <span className={`badge text-[10px] ${deudor.dias > 60 ? 'badge-danger' : deudor.dias > 30 ? 'badge-warning' : 'badge-success'}`}>
                      {deudor.dias} días
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CxP Próximos */}
        <div className="card">
          <div className="section-header">
            <ArrowTrendingDownIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <div className="flex-1">
              <h2 className="font-semibold">Cuentas por Pagar</h2>
              <p className="text-xs text-[var(--text-muted)]">Promedio {cxpData.promedio_dias_pago} días</p>
            </div>
            <span className="amount">{formatGTQ(cxpData.total_cxp)}</span>
          </div>
          
          <div className="space-y-3 p-5 pt-0">
            {cxpData.proximos_pagos?.slice(0, 5).map((pago, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    pago.dias_restantes <= 5 ? 'bg-rose-100 text-rose-700' : 
                    pago.dias_restantes <= 10 ? 'bg-amber-100 text-amber-700' : 
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    <ClockIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{pago.proveedor}</p>
                    <p className="text-sm text-[var(--text-muted)]">Vence en {pago.dias_restantes} días</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="amount">Q{pago.monto.toLocaleString()}</p>
                  {pago.descuento_pronto_pago && (
                    <span className="badge-success text-[10px] mt-1">
                      💰 Desc: {pago.descuento_pronto_pago}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <Link to="/tesoreria/cuentas-por-pagar" className="flex items-center justify-center gap-2 w-full py-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-t border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors">
            Ver todos los pagos
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* ========== PROYECCIÓN CASH FLOW EXPANDIDA ========== */}
        <div className="lg:col-span-2 card">
          <div className="section-header">
            <ArrowTrendingUpIcon className="w-5 h-5 text-[var(--accent-blue)]" />
            <div className="flex-1">
              <h2 className="font-semibold">Proyección de Cash Flow</h2>
              <p className="text-xs text-[var(--text-muted)]">13 semanas · Ingresos, egresos y saldo acumulado</p>
            </div>
            {proyeccionData.resumen?.riesgo_quiebra_tecnica && (
              <span className="badge-danger text-xs">⚠️ Riesgo de liquidez</span>
            )}
          </div>

          {loadingProy ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#001639] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : proyeccionData.proyeccion?.length > 0 ? (
            <div className="p-5 pt-0 space-y-6">
              {/* KPIs de Cash Flow */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Ingresos Esperados</p>
                  <p className="text-lg font-bold font-mono text-[var(--success)]">
                    Q{proyeccionData.proyeccion.reduce((s, sem) => s + (sem.ingresos || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">13 semanas</p>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Egresos Esperados</p>
                  <p className="text-lg font-bold font-mono text-[var(--danger)]">
                    Q{proyeccionData.proyeccion.reduce((s, sem) => s + (sem.egresos || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">13 semanas</p>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Saldo Neto</p>
                  <p className={`text-lg font-bold font-mono ${
                    proyeccionData.proyeccion.reduce((s, sem) => s + (sem.ingresos || 0) - (sem.egresos || 0), 0) >= 0
                      ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  }`}>
                    Q{proyeccionData.proyeccion.reduce((s, sem) => s + (sem.ingresos || 0) - (sem.egresos || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">Ingresos - Egresos</p>
                </div>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Brecha Mínima</p>
                  <p className={`text-lg font-bold font-mono ${
                    (proyeccionData.resumen?.saldo_minimo_proyectado || 0) < 500000 ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                  }`}>
                    Q{(proyeccionData.resumen?.saldo_minimo_proyectado || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">Semana {proyeccionData.resumen?.semana_critica || '—'}</p>
                </div>
              </div>

              {/* Gráfica de barras stacked: Ingresos vs Egresos */}
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={proyeccionData.proyeccion.slice(0, 13).map((sem, idx) => ({
                      semana: `S${idx + 1}`,
                      ingresos: sem.ingresos || 0,
                      egresos: sem.egresos || 0,
                      saldo: sem.saldo_acumulado || 0,
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const sem = proyeccionData.proyeccion[parseInt(label.replace('S', '')) - 1]
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border border-[var(--border-default)] min-w-[200px]">
                            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{label}</p>
                            {payload.map((p, i) => (
                              <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
                                {p.name}: {formatGTQ(p.value)}
                              </p>
                            ))}
                            <p className="text-xs font-medium text-[var(--text-primary)] mt-2 pt-2 border-t border-[var(--border-default)]">
                              Saldo acumulado: {formatGTQ(sem?.saldo_acumulado || 0)}
                            </p>
                            {sem?.alerta && (
                              <p className="text-xs text-[var(--danger)] mt-1">⚠️ {sem.alerta}</p>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla de semanas */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="text-left">Semana</th>
                      <th className="text-right">Ingresos</th>
                      <th className="text-right">Egresos</th>
                      <th className="text-right">Saldo Neto</th>
                      <th className="text-right">Saldo Acum.</th>
                      <th className="text-center">Certeza</th>
                      <th className="text-left">Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proyeccionData.proyeccion.slice(0, 13).map((sem, idx) => {
                      const neto = (sem.ingresos || 0) - (sem.egresos || 0)
                      return (
                        <tr key={idx} className={sem.alerta ? 'bg-red-50/50' : ''}>
                          <td>
                            <span className="font-mono text-sm font-medium">S{idx + 1}</span>
                            <p className="text-[10px] text-[var(--text-muted)]">{sem.fecha_estimada || `Sem ${idx + 1}`}</p>
                          </td>
                          <td className="text-right font-mono text-sm text-[var(--success)]">{formatGTQ(sem.ingresos || 0)}</td>
                          <td className="text-right font-mono text-sm text-[var(--danger)]">{formatGTQ(sem.egresos || 0)}</td>
                          <td className="text-right font-mono text-sm font-medium">
                            <span className={neto >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                              {neto >= 0 ? '+' : ''}{formatGTQ(neto)}
                            </span>
                          </td>
                          <td className="text-right font-mono text-sm font-bold">
                            {formatGTQ(sem.saldo_acumulado || 0)}
                          </td>
                          <td className="text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              sem.certeza === 'alta' ? 'bg-green-100 text-green-700' :
                              sem.certeza === 'media' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {sem.certeza === 'alta' ? 'Alta' : sem.certeza === 'media' ? 'Media' : 'Baja'}
                            </span>
                          </td>
                          <td>
                            {sem.alerta ? (
                              <span className="text-[10px] text-[var(--danger)] flex items-center gap-1">
                                <ExclamationTriangleIcon className="w-3 h-3" />
                                {sem.alerta}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Movimientos por categoría */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-4 h-4 text-[var(--success)]" />
                    Ingresos por Origen
                  </h3>
                  {proyeccionData.categorias_ingresos?.length > 0 ? (
                    proyeccionData.categorias_ingresos.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                            {cat.porcentaje}%
                          </div>
                          <div>
                            <p className="text-sm font-medium">{cat.nombre}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{cat.cantidad} transacciones</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--success)]">{formatGTQ(cat.monto)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">72%</div>
                          <div>
                            <p className="text-sm font-medium">Cobros a Clientes</p>
                            <p className="text-[10px] text-[var(--text-muted)]">CxC por vencer</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--success)]">Q8,450,000</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">18%</div>
                          <div>
                            <p className="text-sm font-medium">Ventas Contado</p>
                            <p className="text-[10px] text-[var(--text-muted)]">Ventas de contado</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--success)]">Q2,110,000</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">10%</div>
                          <div>
                            <p className="text-sm font-medium">Otros Ingresos</p>
                            <p className="text-[10px] text-[var(--text-muted)]">Recuperaciones, intereses</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--success)]">Q1,170,000</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <ArrowTrendingDownIcon className="w-4 h-4 text-[var(--danger)]" />
                    Egresos por Destino
                  </h3>
                  {proyeccionData.categorias_egresos?.length > 0 ? (
                    proyeccionData.categorias_egresos.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                            {cat.porcentaje}%
                          </div>
                          <div>
                            <p className="text-sm font-medium">{cat.nombre}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{cat.cantidad} transacciones</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--danger)]">{formatGTQ(cat.monto)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">45%</div>
                          <div>
                            <p className="text-sm font-medium">Pagos a Proveedores</p>
                            <p className="text-[10px] text-[var(--text-muted)]">CxP por vencer</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--danger)]">Q5,620,000</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">28%</div>
                          <div>
                            <p className="text-sm font-medium">Nómina y Cargas Sociales</p>
                            <p className="text-[10px] text-[var(--text-muted)]">Quincenal + bonificaciones</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--danger)]">Q3,490,000</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">15%</div>
                          <div>
                            <p className="text-sm font-medium">Impuestos</p>
                            <p className="text-[10px] text-[var(--text-muted)]">IVA, ISR, pagos trimestrales</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--danger)]">Q1,870,000</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">12%</div>
                          <div>
                            <p className="text-sm font-medium">Gastos Operativos</p>
                            <p className="text-[10px] text-[var(--text-muted)]">Servicios, alquiler, mantenimiento</p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-sm text-[var(--danger)]">Q1,500,000</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alertas de liquidez */}
              {proyeccionData.alertas?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-[var(--danger)]" />
                    Alertas de Liquidez
                  </h3>
                  {proyeccionData.alertas.map((alerta, idx) => (
                    <div key={idx} className={`p-3 rounded-lg flex items-start gap-2 ${
                      alerta.severidad === 'critica' ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'
                    }`}>
                      <ExclamationTriangleIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        alerta.severidad === 'critica' ? 'text-rose-500' : 'text-amber-500'
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${
                          alerta.severidad === 'critica' ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                          {alerta.mensaje}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{alerta.accion_urgente}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumen de certeza */}
              <div className="flex items-center justify-between text-sm pt-4 border-t border-[var(--border-default)]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                    <span className="text-[var(--text-muted)] text-xs">Ingresos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    <span className="text-[var(--text-muted)] text-xs">Egresos</span>
                  </div>
                </div>
                <span className="text-[var(--text-muted)] text-xs">
                  Saldo final proyectado: Q{proyeccionData.proyeccion[proyeccionData.proyeccion.length - 1]?.saldo_acumulado.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
              No hay datos de proyección disponibles
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
