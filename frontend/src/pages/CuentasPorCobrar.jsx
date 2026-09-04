import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import {
  ArrowTrendingUpIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  BuildingOfficeIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

const fmtQ = (n) => `Q${(Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })}`
const fmtDate = (d) => {
  if (!d) return '—'
  const s = typeof d === 'string' ? d : String(d)
  return s.slice(0, 10)
}

const badgeForDias = (dias) => {
  if (dias <= 0) return { label: 'Al corriente', color: 'badge-success', icon: CheckCircleIcon }
  if (dias <= 30) return { label: `${dias}d`,      color: 'badge-warning', icon: ClockIcon }
  if (dias <= 60) return { label: `${dias}d`,      color: 'badge-warning', icon: ExclamationCircleIcon }
  return                       { label: `${dias}d`, color: 'badge-danger',  icon: ExclamationCircleIcon }
}

export default function CuentasPorCobrar() {
  const [busqueda, setBusqueda] = useState('')
  const [bucket, setBucket]     = useState('todos')

  const { data: cxcData, isLoading: loadingResumen } = useQuery('cxc', endpoints.tesoreria.cxc)

  const detalleParams = { limit: 500, offset: 0, busqueda, bucket }
  const { data: detalleData, isLoading: loadingDetalle, isFetching } = useQuery(
    ['cxc-detalle', busqueda, bucket],
    () => endpoints.tesoreria.cxcDetalle(detalleParams),
    { keepPreviousData: true }
  )

  const resumen       = cxcData?.data || {}
  const distribucion  = resumen.distribucion_aging || {}
  const totalFacturas = resumen.facturas || 0

  const filas = detalleData?.data?.filas || []
  const totalFilas   = detalleData?.data?.total_filas || 0
  const sumaFiltrada = detalleData?.data?.suma_saldo || 0

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
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
              <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Cuentas por Cobrar</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {loadingResumen ? 'Cargando…' : `${totalFacturas.toLocaleString()} documentos abiertos • DSO promedio ${resumen.promedio_dias_cobro || 0} días`}
              </p>
            </div>
          </div>
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <span className="kpi-label">Total por Cobrar</span>
          <p className="kpi-value">{fmtQ(resumen.total_cxc)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{totalFacturas.toLocaleString()} documentos</p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label">Al Corriente (por vencer)</span>
          <p className="kpi-value text-[var(--success)]">{fmtQ(distribucion.al_corriente?.monto)}</p>
          <p className="text-xs text-[var(--success)] mt-1">{distribucion.al_corriente?.porcentaje || 0}%</p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label">1-30 días vencido</span>
          <p className="kpi-value text-[var(--warning)]">{fmtQ(distribucion._30_dias?.monto)}</p>
          <p className="text-xs text-[var(--warning)] mt-1">{distribucion._30_dias?.porcentaje || 0}%</p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label">+60 días (riesgo)</span>
          <p className="kpi-value text-[var(--danger)]">{fmtQ((distribucion._60_dias?.monto || 0) + (distribucion._90_dias?.monto || 0))}</p>
          <p className="text-xs text-[var(--danger)] mt-1">Atención requerida</p>
        </div>
      </div>

      {/* Aging */}
      <div className="card">
        <div className="section-header">
          <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Distribución por Antigüedad</h2>
        </div>
        <div className="p-5 pt-0 space-y-4">
          {[
            { key: 'al_corriente', label: 'Por vencer',            color: 'bg-emerald-500' },
            { key: '_30_dias',     label: '1-30 días vencido',     color: 'bg-amber-500' },
            { key: '_60_dias',     label: '31-60 días vencido',    color: 'bg-orange-500' },
            { key: '_90_dias',     label: '60+ días vencido',      color: 'bg-rose-500' }
          ].map(r => {
            const val = distribucion[r.key]
            return (
              <div key={r.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{r.label}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {fmtQ(val?.monto)} ({val?.porcentaje || 0}%)
                  </span>
                </div>
                <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.color} transition-all duration-700`}
                    style={{ width: `${val?.porcentaje || 0}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, código o número de documento…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input w-full pl-12"
          />
        </div>
        <select
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          className="input min-w-[200px]"
        >
          <option value="todos">Todos los buckets</option>
          <option value="al_corriente">Por vencer</option>
          <option value="_30_dias">1-30 días vencido</option>
          <option value="_60_dias">31-60 días vencido</option>
          <option value="_90_dias">60+ días vencido</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {loadingDetalle ? 'Cargando…' : `${filas.length.toLocaleString()} de ${totalFilas.toLocaleString()} documentos`}
              {isFetching && !loadingDetalle && ' • actualizando…'}
            </span>
          </div>
          <span className="text-sm font-semibold">Total filtrado: {fmtQ(sumaFiltrada)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Cliente</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Sucursal</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Vendedor</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Documento</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Emisión</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Vencimiento</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Saldo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">Días</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loadingDetalle && filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    Cargando cartera desde el ERP…
                  </td>
                </tr>
              )}
              {!loadingDetalle && filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    No hay documentos que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {filas.map(row => {
                const badge = badgeForDias(row.dias_atraso)
                const BadgeIcon = badge.icon
                return (
                  <tr key={row.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                          <BuildingOfficeIcon className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate max-w-[240px]">{row.cliente}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {row.codigo_cliente}{row.forma_pago ? ` · ${row.forma_pago}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)]">{row.sucursal || row.codigo_sucursal}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)]">{row.vendedor || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{row.tipo_documento} {row.documento}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)] tabular-nums">{fmtDate(row.fecha_emision)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)] tabular-nums">{fmtDate(row.fecha_vencimiento)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold tabular-nums">{fmtQ(row.saldo_total)}</span>
                      {row.vencido > 0 && (
                        <p className="text-xs text-[var(--danger)] tabular-nums">Vencido {fmtQ(row.vencido)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-semibold ${
                        row.dias_atraso > 60 ? 'text-[var(--danger)]' :
                        row.dias_atraso > 30 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                      }`}>
                        {row.dias_atraso}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 ${badge.color}`}>
                        <BadgeIcon className="w-3.5 h-3.5" />
                        {row.estado_cxc || badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
