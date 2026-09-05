import { Link } from 'react-router-dom'
import { useTesoreriaPosicion, useTesoreriaCxC, useTesoreriaCxP } from '../hooks/useCfoData'
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowRightIcon,
  BuildingLibraryIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  InformationCircleIcon,
  ChartBarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const fmtQ  = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtM  = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT')
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')

export default function Tesoreria() {
  const { data: posicionRes, isLoading: loadingPos } = useTesoreriaPosicion()
  const { data: cxcRes }  = useTesoreriaCxC()
  const { data: cxpRes }  = useTesoreriaCxP()

  const pos = posicionRes?.data || {}
  const cxc = pos.cxc || {}
  const cxp = pos.cxp || {}
  const cxpDetalle = cxpRes?.data || {}
  const cxcDetalle = cxcRes?.data || {}

  const netaPositiva = (pos.posicion_neta_working_capital || 0) >= 0
  const ratio = pos.ratio_cobertura_cxc_cxp

  const cxcAging = cxcDetalle.distribucion_aging || {}
  const cxpAging = cxpDetalle.distribucion_aging || {}

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
            <BanknotesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Tesorería</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Working capital al {pos.fecha_corte || '—'} · CxC + CxP del ERP en tiempo real
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Efectivo bancos - N/D */}
        <div className="kpi-card card-hover border-dashed border-2 border-[var(--border-default)]">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Efectivo en bancos</span>
            <span className="badge-info text-xs">N/D</span>
          </div>
          <p className="kpi-value text-[var(--text-muted)]">—</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug">
            Pendiente vista de cuentas bancarias del ERP
          </p>
        </div>

        {/* CxC */}
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Por cobrar (CxC)</span>
            <ArrowTrendingUpIcon className="w-4 h-4 text-[var(--success)]" />
          </div>
          <p className="kpi-value">{loadingPos ? '—' : fmtQ(cxc.total)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {fmtNum(cxc.documentos)} documentos · vencido {fmtQ(cxc.vencido)}
          </p>
        </div>

        {/* CxP */}
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Por pagar (CxP)</span>
            <ArrowTrendingDownIcon className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <p className="kpi-value">{loadingPos ? '—' : fmtQ(cxp.total)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {fmtNum(cxp.facturas)} facturas · {fmtNum(cxp.proveedores)} proveedores
          </p>
        </div>

        {/* Posición neta */}
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Posición neta WC</span>
            <ScaleIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className={`kpi-value ${netaPositiva ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {loadingPos ? '—' : fmtQ(pos.posicion_neta_working_capital)}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            CxC − CxP {ratio !== null ? `· cobertura ${ratio?.toFixed(2)}x` : ''}
          </p>
        </div>
      </div>

      {/* Nota bancos */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[var(--text-secondary)]">
          <p className="font-medium">Efectivo en bancos no disponible en esta versión.</p>
          <p className="text-xs mt-1">
            El ERP TP_A solo expone vistas de CxC y compras. Para completar la posición de tesorería
            se requiere una vista adicional con los saldos por cuenta bancaria (Q, USD).
            Una vez expuesta, la posición neta incluirá también el efectivo disponible.
          </p>
        </div>
      </div>

      {/* CxC y CxP en paralelo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CxC */}
        <div className="card">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <ArrowTrendingUpIcon className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="font-semibold">Cuentas por Cobrar</h2>
            </div>
            <Link to="/tesoreria/cxc" className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
              Ver detalle <ArrowRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5 pt-0 space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-[var(--text-muted)]">Total vigente</span>
                <span className="text-lg font-semibold tabular-nums">{fmtQ(cxcDetalle.total_cxc || cxc.total)}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                DSO promedio {cxcDetalle.promedio_dias_cobro || 0} días · {fmtNum(cxcDetalle.facturas || cxc.documentos)} documentos
              </p>
            </div>

            {['al_corriente', '_30_dias', '_60_dias', '_90_dias'].map(k => {
              const bucket = cxcAging[k] || {}
              const labels = { al_corriente: 'Por vencer', _30_dias: '1-30 días', _60_dias: '31-60 días', _90_dias: '60+ días' }
              const colors = { al_corriente: 'bg-emerald-500', _30_dias: 'bg-amber-500', _60_dias: 'bg-orange-500', _90_dias: 'bg-rose-500' }
              return (
                <div key={k} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{labels[k]}</span>
                    <span className="font-semibold tabular-nums">{fmtM(bucket.monto)} <span className="text-xs text-[var(--text-muted)]">({bucket.porcentaje || 0}%)</span></span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[k]}`} style={{ width: `${bucket.porcentaje || 0}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* CxP */}
        <div className="card">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <ArrowTrendingDownIcon className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="font-semibold">Cuentas por Pagar</h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">antigüedad desde emisión</span>
          </div>
          <div className="p-5 pt-0 space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-[var(--text-muted)]">Total pendiente</span>
                <span className="text-lg font-semibold tabular-nums">{fmtQ(cxpDetalle.total_cxp || cxp.total)}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {fmtNum(cxpDetalle.facturas || cxp.facturas)} facturas · {fmtNum(cxpDetalle.proveedores || cxp.proveedores)} proveedores
              </p>
            </div>

            {['por_vencer', 'v_1_30', 'v_31_60', 'v_60_mas'].map(k => {
              const bucket = cxpAging[k] || {}
              const labels = { por_vencer: '< 30 días', v_1_30: '30-60 días', v_31_60: '60-90 días', v_60_mas: '90+ días' }
              const colors = { por_vencer: 'bg-emerald-500', v_1_30: 'bg-amber-500', v_31_60: 'bg-orange-500', v_60_mas: 'bg-rose-500' }
              return (
                <div key={k} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{labels[k]}</span>
                    <span className="font-semibold tabular-nums">{fmtM(bucket.monto)} <span className="text-xs text-[var(--text-muted)]">({bucket.porcentaje || 0}%)</span></span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[k]}`} style={{ width: `${bucket.porcentaje || 0}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Alerta si CxP > CxC */}
      {(cxp.total || 0) > (cxc.total || 0) && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg,#fff7ed)] p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--warning)]">CxP mayor que CxC</p>
            <p className="text-[var(--text-secondary)]">
              Debés a proveedores <strong>{fmtQ((cxp.total || 0) - (cxc.total || 0))}</strong> más de lo que te deben tus clientes.
              Normal en manufactura con stock, pero si no hay caja suficiente aparece presión de tesorería.
              Considerá comparar con el saldo bancario cuando esté disponible.
            </p>
          </div>
        </div>
      )}

      {/* Top proveedores por CxP */}
      <div className="card">
        <div className="section-header">
          <UserGroupIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Top proveedores con saldo pendiente</h2>
        </div>
        <div className="p-5 pt-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left  font-semibold py-2">Proveedor</th>
                <th className="text-right font-semibold py-2">Facturas</th>
                <th className="text-right font-semibold py-2">Saldo pendiente</th>
                <th className="text-right font-semibold py-2">% del CxP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {(cxpDetalle.top_proveedores || []).length === 0 && (
                <tr><td colSpan={4} className="py-4 text-sm text-[var(--text-muted)] text-center">Cargando…</td></tr>
              )}
              {(cxpDetalle.top_proveedores || []).map((p) => {
                const pct = cxpDetalle.total_cxp > 0 ? (p.monto / cxpDetalle.total_cxp * 100).toFixed(1) : '0'
                return (
                  <tr key={p.codigo} className="text-sm hover:bg-[var(--bg-secondary)]">
                    <td className="py-2 pr-4">
                      <p className="font-medium truncate max-w-[280px]">{p.proveedor}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.codigo}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmtNum(p.facturas)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtQ(p.monto)}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${
                      parseFloat(pct) >= 25 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                    }`}>{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Próximos pagos (siguientes 30 días) */}
      <div className="card">
        <div className="section-header">
          <ClockIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Próximos pagos estimados (30 días)</h2>
        </div>
        <div className="p-5 pt-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left  font-semibold py-2">Venc. estimado</th>
                <th className="text-left  font-semibold py-2">Proveedor</th>
                <th className="text-left  font-semibold py-2">Factura</th>
                <th className="text-right font-semibold py-2">Monto</th>
                <th className="text-right font-semibold py-2">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {(cxpDetalle.proximos_pagos || []).length === 0 && (
                <tr><td colSpan={5} className="py-4 text-sm text-[var(--text-muted)] text-center">Sin pagos próximos en 30 días.</td></tr>
              )}
              {(cxpDetalle.proximos_pagos || []).slice(0, 12).map((p, i) => (
                <tr key={`${p.fact_num}-${i}`} className="text-sm hover:bg-[var(--bg-secondary)]">
                  <td className="py-2 pr-3 tabular-nums text-[var(--text-secondary)]">{fmtDate(p.fecha_vencimiento)}</td>
                  <td className="py-2 pr-3">
                    <p className="font-medium truncate max-w-[280px]">{p.proveedor}</p>
                    <p className="text-xs text-[var(--text-muted)]">{p.codigo}</p>
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-secondary)]">{p.fact_num}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{fmtQ(p.monto)}</td>
                  <td className={`py-2 text-right tabular-nums text-sm font-semibold ${
                    p.dias_restantes <= 7 ? 'text-[var(--danger)]' : p.dias_restantes <= 15 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                  }`}>{p.dias_restantes}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota metodológica */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          <p><strong>Origen de los datos:</strong> ERP TP_A sincronizado diariamente via n8n.</p>
          <p className="mt-1">
            <strong>Nota sobre CxP:</strong> el ERP no expone una vista dedicada de cuentas por pagar.
            Construimos el CxP tomando el saldo pendiente de cada factura de compra (<code>MAX(saldo)</code> por factura de <code>vstCompras</code>).
            La fecha de vencimiento se estima a 30 días desde la emisión — no refleja los términos reales acordados con cada proveedor
            (Klockner y otros importadores probablemente tienen 60-90 días). El aging muestra <em>antigüedad desde emisión</em>, no atraso real de pago.
          </p>
        </div>
      </div>
    </div>
  )
}
