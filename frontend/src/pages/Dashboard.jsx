import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useCfoData'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
  ChartBarIcon,
  ScaleIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ClockIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'

const fmtQ    = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtM    = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtPct  = (n, d = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`)
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')
const fmtPeriod = (p) => {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${meses[+m - 1]}${y.slice(2)}`
}

const insightConfig = {
  riesgo:   { icon: ShieldExclamationIcon, cls: 'border-l-[var(--danger)] text-[var(--danger)]',   badge: 'Riesgo'    },
  atencion: { icon: ExclamationTriangleIcon, cls: 'border-l-[var(--warning)] text-[var(--warning)]', badge: 'Atención'  },
  positivo: { icon: CheckCircleIcon,     cls: 'border-l-[var(--success)] text-[var(--success)]', badge: 'Positivo' },
}

export default function Dashboard() {
  const { data, isLoading, error } = useDashboard()
  const d = data?.data || {}
  const k = d.kpis || {}
  const serie = d.ventas_mensuales || []

  if (isLoading) {
    return (
      <div className="max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-[var(--bg-secondary)] rounded-lg" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-[var(--bg-secondary)] rounded-lg" />)}
          </div>
          <div className="h-72 bg-[var(--bg-secondary)] rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl">
        <div className="card p-6 text-sm text-[var(--danger)]">
          Error cargando el dashboard: {error.message}
        </div>
      </div>
    )
  }

  const promedioVentas = serie.length > 0
    ? serie.reduce((s, r) => s + (r.ventas || 0), 0) / serie.length
    : 0

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header ejecutivo */}
      <div className="rounded-2xl bg-gradient-to-br from-[#001639] via-[#001639] to-[#003a7a] p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">Briefing ejecutivo</p>
            <h1 className="text-3xl font-semibold mt-1">{d.empresa || 'Thermoplástica, S.A.'}</h1>
            <p className="text-sm text-white/70 mt-1">
              Datos al {d.fecha_corte} · ERP en tiempo real via Tailscale + n8n
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-white/60">Ventas 12m</p>
              <p className="text-2xl font-semibold tabular-nums">{fmtM(k.ventas_12m)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-white/60">Margen bruto MP</p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-300">{fmtPct(k.margen_bruto_pct)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-white/60">Posición neta WC</p>
              <p className={`text-2xl font-semibold tabular-nums ${k.posicion_neta_wc >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {fmtM(k.posicion_neta_wc)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ventas rolling 12m"
          value={fmtM(k.ventas_12m)}
          sublabel={k.tendencia_mes_pct !== null
            ? `mes anterior ${k.tendencia_mes_pct >= 0 ? '+' : ''}${k.tendencia_mes_pct?.toFixed(1)}% vs promedio`
            : '—'}
          icon={ArrowTrendingUpIcon}
          tone={k.tendencia_mes_pct >= 0 ? 'success' : 'warning'}
          to="/compras"
        />
        <KpiCard
          label="Compras materia prima 12m"
          value={fmtM(k.compras_12m)}
          sublabel={k.ventas_12m ? `${((k.compras_12m / k.ventas_12m) * 100).toFixed(1)}% de las ventas` : '—'}
          icon={ArrowTrendingDownIcon}
          to="/compras"
        />
        <KpiCard
          label="Gastos operativos 12m"
          value={fmtM(k.gastos_operativos_12m)}
          sublabel={k.ventas_12m ? `${((k.gastos_operativos_12m / k.ventas_12m) * 100).toFixed(1)}% de las ventas` : '—'}
          icon={BuildingOfficeIcon}
          to="/gastos-operativos"
        />
        <KpiCard
          label="EBITDA estimado 12m"
          value={fmtM(k.ebitda_estimado)}
          sublabel={`Margen ${fmtPct(k.ebitda_pct)} — sin mano de obra ni depreciación`}
          icon={ScaleIcon}
          tone={k.ebitda_estimado >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Insights auto-generados */}
      {d.insights && d.insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {d.insights.map((ins, i) => {
            const cfg = insightConfig[ins.tipo] || insightConfig.atencion
            const Icon = cfg.icon
            return (
              <div key={i} className={`card border-l-4 ${cfg.cls} p-4`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.cls}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.cls}`}>{cfg.badge}</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{ins.titulo}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{ins.detalle}</p>
                    {ins.link && (
                      <Link to={ins.link} className="inline-flex items-center gap-1 text-xs text-[var(--accent-blue)] mt-2 hover:underline">
                        Ver detalle <ArrowRightIcon className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ventas mensuales */}
      <div className="card">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Facturación mensual</h2>
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-[#001639] rounded-sm" /> Ventas
            <span className="ml-3 inline-block w-4 h-0.5 bg-[var(--warning)]" /> Promedio {fmtM(promedioVentas)}
          </div>
        </div>
        <div className="p-5 pt-0">
          {serie.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="periodo" tickFormatter={fmtPeriod} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis
                  tickFormatter={(v) => `Q${(v / 1e6).toFixed(1)}M`}
                  tick={{ fontSize: 12 }}
                  stroke="var(--text-muted)"
                  width={70}
                />
                <Tooltip
                  formatter={(v) => fmtQ(v)}
                  labelFormatter={fmtPeriod}
                  contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8 }}
                />
                <ReferenceLine y={promedioVentas} stroke="var(--warning)" strokeDasharray="4 3" />
                <Bar dataKey="ventas" fill="#001639" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Working capital pulse */}
      <div className="card">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Pulso de working capital</h2>
          </div>
          <Link to="/tesoreria" className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
            Detalle <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
        <div className="p-5 pt-0 space-y-4">
          <WcBar
            label="Por cobrar a clientes"
            monto={k.cxc_total}
            sublabel={`${k.cxc_documentos || 0} documentos · vencido ${fmtM(k.cxc_vencido)}`}
            color="bg-emerald-500"
            max={Math.max(k.cxc_total || 0, k.cxp_total || 0)}
          />
          <WcBar
            label="Por pagar a proveedores"
            monto={k.cxp_total}
            sublabel={`${k.cxp_facturas || 0} facturas · ${k.cxp_proveedores || 0} proveedores`}
            color="bg-rose-500"
            max={Math.max(k.cxc_total || 0, k.cxp_total || 0)}
          />
          <div className="pt-3 border-t border-[var(--border-default)] flex items-baseline justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Posición neta operativa</p>
              <p className="text-xs text-[var(--text-muted)]">
                Cobertura CxC/CxP: {k.cobertura_cxc_cxp !== null ? `${k.cobertura_cxc_cxp.toFixed(2)}x` : '—'}
              </p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${k.posicion_neta_wc >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {fmtQ(k.posicion_neta_wc)}
            </p>
          </div>
        </div>
      </div>

      {/* Concentraciones side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConcentracionCard
          titulo="Top clientes deudores (CxC)"
          icono={UsersIcon}
          data={d.top_clientes || []}
          nameKey="cliente"
          codigoKey="codigo"
          alertaPct={20}
          linkTo="/tesoreria/cxc"
          linkLabel="Ver cartera"
        />
        <ConcentracionCard
          titulo="Top proveedores con saldo (CxP)"
          icono={BuildingOfficeIcon}
          data={d.top_proveedores_cxp || []}
          nameKey="proveedor"
          codigoKey="codigo"
          alertaPct={25}
          linkTo="/tesoreria"
          linkLabel="Ver tesorería"
        />
      </div>

      {/* Acción esta semana - CxC críticas */}
      {d.cxc_criticas && d.cxc_criticas.length > 0 && (
        <div className="card">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-[var(--danger)]" />
              <h2 className="font-semibold">Acción esta semana — CxC con más de 60 días de atraso</h2>
            </div>
            <Link to="/tesoreria/cxc" className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
              Ver todo <ArrowRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left  font-semibold py-2">Cliente</th>
                  <th className="text-left  font-semibold py-2">Documento</th>
                  <th className="text-left  font-semibold py-2">Vencimiento</th>
                  <th className="text-right font-semibold py-2">Días atraso</th>
                  <th className="text-right font-semibold py-2">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {d.cxc_criticas.map((c, i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-2 pr-3">
                      <p className="font-medium truncate max-w-[300px]">{c.cliente}</p>
                    </td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)]">{c.documento}</td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)] tabular-nums">{fmtDate(c.fecha_vencimiento)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-[var(--danger)]">{c.dias_atraso}d</td>
                    <td className="py-2 text-right tabular-nums font-bold">{fmtQ(c.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer con nota metodológica */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-muted)] leading-relaxed">
        <p>
          <SparklesIcon className="w-4 h-4 inline mr-1 -mt-0.5" />
          <strong>Notas metodológicas.</strong> Ventas = rollup mensual del ERP (<code>vst_Analisis_Ventas_Ventas</code>).
          Compras y gastos operativos = detalle línea × factura de <code>vstCompras</code>.
          CxC = snapshot vivo de <code>vstCuentaPorCobrar</code>. CxP = saldo pendiente por factura de compras (proxy; el ERP no expone vista dedicada de CxP).
          EBITDA estimado no incluye mano de obra ni depreciación — se ajustará cuando el ERP exponga esas vistas.
          Sincronización diaria via n8n.
        </p>
      </div>
    </div>
  )
}

// ---------------- componentes internos ----------------

function KpiCard({ label, value, sublabel, icon: Icon, tone, to }) {
  const toneCls = tone === 'success' ? 'text-[var(--success)]'
                 : tone === 'warning' ? 'text-[var(--warning)]'
                 : tone === 'danger'  ? 'text-[var(--danger)]'
                 : ''
  const inner = (
    <div className="kpi-card card-hover h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="kpi-label">{label}</span>
        {Icon && <Icon className={`w-4 h-4 text-[var(--text-muted)] ${toneCls}`} />}
      </div>
      <p className={`kpi-value ${toneCls}`}>{value}</p>
      {sublabel && <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug">{sublabel}</p>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function WcBar({ label, monto, sublabel, color, max }) {
  const pct = max > 0 ? Math.round((monto || 0) / max * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {sublabel && <p className="text-xs text-[var(--text-muted)]">{sublabel}</p>}
        </div>
        <p className="text-lg font-semibold tabular-nums">{fmtQ(monto)}</p>
      </div>
      <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ConcentracionCard({ titulo, icono: Icon, data, nameKey, codigoKey, alertaPct, linkTo, linkLabel }) {
  const hayConcentracion = data[0]?.porcentaje >= alertaPct
  return (
    <div className="card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">{titulo}</h2>
        </div>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
            {linkLabel} <ArrowRightIcon className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5 pt-0 space-y-3">
        {data.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin datos.</p>}
        {data.map((r, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-[var(--text-muted)] tabular-nums w-6">#{i + 1}</span>
                <span className="truncate">{r[nameKey]}</span>
              </div>
              <span className="font-semibold tabular-nums whitespace-nowrap">
                {fmtM(r.monto)}
                {r.porcentaje > 0 && (
                  <span className={`text-xs ml-1 ${
                    r.porcentaje >= alertaPct ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'
                  }`}>
                    ({r.porcentaje}%)
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  i === 0 && hayConcentracion ? 'bg-[var(--warning)]' : 'bg-[#001639]'
                }`}
                style={{ width: `${Math.max(r.porcentaje || 0, 1)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
