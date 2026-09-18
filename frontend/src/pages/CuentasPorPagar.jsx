import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import {
  ArrowTrendingDownIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  BuildingOfficeIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ChartBarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

const fmtQ = (n) => `Q${(Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })}`
const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtDate = (d) => {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

const badgeForDias = (dias) => {
  if (dias <= 0)  return { label: 'Vigente',        color: 'badge-success', icon: CheckCircleIcon }
  if (dias <= 30) return { label: `${dias}d`,       color: 'badge-warning', icon: ClockIcon }
  if (dias <= 60) return { label: `${dias}d`,       color: 'badge-warning', icon: ExclamationCircleIcon }
  return                { label: `${dias}d`,       color: 'badge-danger',  icon: ExclamationCircleIcon }
}

export default function CuentasPorPagar() {
  const [busqueda, setBusqueda]     = useState('')
  const [bucket, setBucket]         = useState('todos')
  const [proveedorSel, setProveedor] = useState('')

  const { data: cxpData, isLoading: loadingResumen } = useQuery('cxp', endpoints.tesoreria.cxp)

  const detalleParams = { limit: 500, offset: 0, busqueda, bucket, proveedor: proveedorSel }
  const { data: detalleData, isLoading: loadingDetalle, isFetching } = useQuery(
    ['cxp-detalle', busqueda, bucket, proveedorSel],
    () => endpoints.tesoreria.cxpDetalle(detalleParams),
    { keepPreviousData: true }
  )

  const resumen       = cxpData?.data || {}
  const distribucion  = resumen.distribucion_aging || {}
  const topProv       = resumen.top_proveedores || []
  const proximos      = resumen.proximos_pagos || []
  const totalFacturas = resumen.facturas || 0

  const filas = detalleData?.data?.filas || []
  const totalFilas   = detalleData?.data?.total_filas || 0
  const sumaFiltrada = detalleData?.data?.suma_saldo || 0

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/tesoreria"
            className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <ArrowTrendingDownIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Cuentas por Pagar</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {loadingResumen
                  ? 'Cargando…'
                  : `${totalFacturas.toLocaleString()} facturas abiertas · DPO promedio vencido ${resumen.promedio_dias_pago || 0} días · Crédito promedio pactado ${resumen.dias_credito_promedio || 0} días`}
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
          <span className="kpi-label">Total por Pagar</span>
          <p className="kpi-value">{fmtQ(resumen.total_cxp)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{totalFacturas.toLocaleString()} facturas · {resumen.proveedores || 0} proveedores</p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">Por Vencer</span>
          <p className="kpi-value text-[var(--success)]">{fmtQ(distribucion.por_vencer?.monto)}</p>
          <p className="text-xs text-[var(--success)] mt-1">{distribucion.por_vencer?.porcentaje || 0}%</p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">1-30 días vencido</span>
          <p className="kpi-value text-[var(--warning)]">{fmtQ(distribucion.v_1_30?.monto)}</p>
          <p className="text-xs text-[var(--warning)] mt-1">{distribucion.v_1_30?.porcentaje || 0}%</p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">+60 días (riesgo)</span>
          <p className="kpi-value text-[var(--danger)]">{fmtQ((distribucion.v_61_90?.monto || 0) + (distribucion.v_90_mas?.monto || 0))}</p>
          <p className="text-xs text-[var(--danger)] mt-1">Atención requerida</p>
        </div>
      </div>

      {/* Aging */}
      <div className="card">
        <div className="section-header">
          <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Distribución por Antigüedad (vs fecha de vencimiento real)</h2>
        </div>
        <div className="p-5 pt-0 space-y-4">
          {[
            { key: 'por_vencer', label: 'Por vencer',            color: 'bg-emerald-500' },
            { key: 'v_1_30',     label: '1-30 días vencido',     color: 'bg-amber-500' },
            { key: 'v_31_60',    label: '31-60 días vencido',    color: 'bg-orange-500' },
            { key: 'v_61_90',    label: '61-90 días vencido',    color: 'bg-rose-500' },
            { key: 'v_90_mas',   label: '90+ días vencido',      color: 'bg-red-600' }
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

      {/* Top proveedores + Próximos pagos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="section-header">
            <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Top proveedores con saldo</h2>
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left  font-semibold pb-2">Proveedor</th>
                  <th className="text-right font-semibold pb-2">Facturas</th>
                  <th className="text-right font-semibold pb-2">Crédito</th>
                  <th className="text-right font-semibold pb-2">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {topProv.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-sm text-[var(--text-muted)]">Cargando…</td></tr>
                )}
                {topProv.map((p) => (
                  <tr
                    key={p.codigo}
                    className={`text-sm hover:bg-[var(--bg-secondary)] cursor-pointer ${proveedorSel === p.codigo ? 'bg-[var(--bg-secondary)]' : ''}`}
                    onClick={() => setProveedor(p.codigo === proveedorSel ? '' : p.codigo)}
                  >
                    <td className="py-2 pr-2">
                      <p className="font-medium truncate max-w-[240px]">{p.proveedor}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {p.codigo}
                        {p.facturas_vencidas > 0 && (
                          <span className="ml-1 text-[var(--danger)]">· {p.facturas_vencidas} vencidas</span>
                        )}
                      </p>
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.facturas}</td>
                    <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {p.dias_credito > 0 ? `${p.dias_credito}d` : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtM(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proveedorSel && (
              <button
                onClick={() => setProveedor('')}
                className="mt-3 text-xs text-[var(--accent-blue)] hover:underline"
              >
                Limpiar filtro de proveedor
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <ClockIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Próximos pagos (30 días)</h2>
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            {proximos.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4 text-center">Sin pagos previstos en los próximos 30 días.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)] uppercase">
                    <th className="text-left  font-semibold pb-2">Vence</th>
                    <th className="text-left  font-semibold pb-2">Proveedor</th>
                    <th className="text-right font-semibold pb-2">Días</th>
                    <th className="text-right font-semibold pb-2">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {proximos.slice(0, 12).map((p, i) => (
                    <tr key={`${p.numero_interno}-${i}`} className="text-sm hover:bg-[var(--bg-secondary)]">
                      <td className="py-2 pr-2 tabular-nums text-[var(--text-secondary)]">{fmtDate(p.fecha_vencimiento)}</td>
                      <td className="py-2 pr-2">
                        <p className="font-medium truncate max-w-[220px]">{p.proveedor}</p>
                        <p className="text-xs text-[var(--text-muted)]">#{p.numero_interno}</p>
                      </td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${
                        p.dias_restantes <= 7 ? 'text-[var(--danger)]' : p.dias_restantes <= 15 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                      }`}>{p.dias_restantes}d</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{fmtM(p.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, código o número de factura…"
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
          <option value="por_vencer">Por vencer</option>
          <option value="v_1_30">1-30 días vencido</option>
          <option value="v_31_60">31-60 días vencido</option>
          <option value="v_61_90">61-90 días vencido</option>
          <option value="v_90_mas">90+ días vencido</option>
        </select>
      </div>

      {/* Tabla detalle */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {loadingDetalle ? 'Cargando…' : `${filas.length.toLocaleString()} de ${totalFilas.toLocaleString()} facturas`}
              {isFetching && !loadingDetalle && ' · actualizando…'}
            </span>
          </div>
          <span className="text-sm font-semibold">Total filtrado: {fmtQ(sumaFiltrada)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Proveedor</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Factura</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Emisión</th>
                <th className="px-4 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Vencimiento</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">Crédito<br /><span className="normal-case font-normal">ficha · factura</span></th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Saldo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loadingDetalle && filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    Cargando facturas desde el ERP…
                  </td>
                </tr>
              )}
              {!loadingDetalle && filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    No hay facturas que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {filas.map(row => {
                const badge = badgeForDias(row.dias_atraso)
                const BadgeIcon = badge.icon
                const desviacion = row.dias_segun_facturas - row.dias_credito_ficha
                return (
                  <tr key={row.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                          <BuildingOfficeIcon className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate max-w-[240px]">{row.proveedor}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {row.codigo_proveedor}
                            {row.sucursal && ` · ${row.sucursal}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">#{row.numero_interno}</p>
                      {row.factura_proveedor && (
                        <p className="text-xs text-[var(--text-muted)]">Prov: {row.factura_proveedor}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)] tabular-nums">{fmtDate(row.fecha_emision)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)] tabular-nums">{fmtDate(row.fecha_vencimiento)}</p>
                      {row.dias_atraso > 0 && (
                        <p className="text-xs text-[var(--danger)] tabular-nums">{row.dias_atraso}d atraso</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-sm tabular-nums">
                        <span className="text-[var(--text-muted)]">{row.dias_credito_ficha}d</span>
                        <span className="mx-1 text-[var(--text-muted)]">·</span>
                        <span className={`font-semibold ${
                          desviacion > 5 ? 'text-[var(--warning)]' :
                          desviacion < -5 ? 'text-[var(--success)]' : ''
                        }`}>{row.dias_segun_facturas}d</span>
                      </p>
                      {Math.abs(desviacion) > 5 && (
                        <p className={`text-xs tabular-nums ${desviacion > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                          {desviacion > 0 ? '+' : ''}{desviacion}d
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold tabular-nums">{fmtQ(row.saldo)}</span>
                      {row.valor && row.valor !== row.saldo && (
                        <p className="text-xs text-[var(--text-muted)] tabular-nums">Valor: {fmtM(row.valor)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 ${badge.color}`}>
                        <BadgeIcon className="w-3.5 h-3.5" />
                        {row.estado || badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota metodológica */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          <p>
            Fuente: <code>vstAnalisisCxP</code> del ERP. La fecha de vencimiento es la real acordada con cada proveedor.
            La columna <em>Crédito</em> muestra días según ficha del proveedor · días efectivamente otorgados en la factura;
            las desviaciones {'>'} 5 días se marcan en color. Sincronización diaria via n8n.
          </p>
        </div>
      </div>
    </div>
  )
}
