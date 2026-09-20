import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useCfoData'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ComposedChart, Line, Area, ReferenceLine, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
  PieChart, Pie, Legend,
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
  CubeIcon,
  ArrowsRightLeftIcon,
  BoltIcon,
  ChartPieIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  ShoppingCartIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'

// ============================================================
// Helpers de formato
// ============================================================
const fmtQ    = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtM    = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtPct  = (n, d = 1) => (n === null || n === undefined || isNaN(n) ? '—' : `${Number(n).toFixed(d)}%`)
const fmtDelta = (n, d = 1) => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const v = Number(n)
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(d)}%`
}
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')
const fmtPeriod = (p) => {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${meses[+m - 1]}${y.slice(2)}`
}

const insightConfig = {
  riesgo:   { icon: ShieldExclamationIcon,  cls: 'border-l-[var(--danger)]',  txt: 'text-[var(--danger)]',  badge: 'Riesgo'    },
  atencion: { icon: ExclamationTriangleIcon, cls: 'border-l-[var(--warning)]', txt: 'text-[var(--warning)]', badge: 'Atención'  },
  positivo: { icon: CheckCircleIcon,         cls: 'border-l-[var(--success)]', txt: 'text-[var(--success)]', badge: 'Positivo' },
}

const healthColor = (grade) => {
  if (grade === 'excelente') return { fill: '#10b981', text: 'text-emerald-300' }
  if (grade === 'saludable') return { fill: '#22c55e', text: 'text-emerald-300' }
  if (grade === 'atencion')  return { fill: '#f59e0b', text: 'text-amber-300' }
  return { fill: '#ef4444', text: 'text-rose-300' }
}

// ============================================================
// Dashboard principal
// ============================================================
export default function Dashboard() {
  const { data, isLoading, error } = useDashboard()
  const d = data?.data || {}
  const k = d.kpis || {}
  const h = d.health || {}
  const serie = d.ventas_mensuales || []
  const cxcAg = d.cxc_aging || {}
  const cxpAg = d.cxp_aging || {}
  const lineas = d.top_lineas || []

  if (isLoading) {
    return (
      <div className="max-w-[1400px]">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[var(--bg-secondary)] rounded-2xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-[var(--bg-secondary)] rounded-lg" />)}
          </div>
          <div className="h-80 bg-[var(--bg-secondary)] rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-[var(--bg-secondary)] rounded-lg" />
            <div className="h-64 bg-[var(--bg-secondary)] rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-[1400px]">
        <div className="card p-6 text-sm text-[var(--danger)]">
          Error cargando el dashboard: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px]">
      {/* ============ 1. HERO EJECUTIVO ============ */}
      <ExecutiveHero empresa={d.empresa} fechaCorte={d.fecha_corte} kpis={k} health={h} />

      {/* ============ 2. PULSO 12M — 4 KPIs con YoY delta ============ */}
      <PulsoRow kpis={k} />

      {/* ============ 3. FACTURACIÓN & MARGEN — ComposedChart YoY ============ */}
      <VentasTrendCard serie={serie} kpis={k} />

      {/* ============ 4. CASH CONVERSION + WATERFALL P&L ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashConversionCycle kpis={k} />
        <PnlWaterfall kpis={k} />
      </div>

      {/* ============ 5. AGING CxC + CxP ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgingCard
          titulo="Antigüedad · Cuentas por Cobrar"
          tono="cobrar"
          total={cxcAg.total}
          docCount={k.cxc_documentos}
          buckets={cxcAg}
          link="/tesoreria/cuentas-por-cobrar"
          linkLabel="Ver cartera"
        />
        <AgingCard
          titulo="Antigüedad · Cuentas por Pagar"
          tono="pagar"
          total={cxpAg.total}
          docCount={k.cxp_facturas}
          buckets={cxpAg}
          link="/tesoreria/cuentas-por-pagar"
          linkLabel="Ver CxP"
        />
      </div>

      {/* ============ 6. COMPRAS + GASTOS + INVENTARIO (3 cols) ============ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ComprasKpiCard kpis={k} />
        <GastosKpiCard kpis={k} />
        <InventarioKpiCard kpis={k} />
      </div>

      {/* ============ 7. CONCENTRACIÓN + MIX DE PRODUCTO ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <MixLineasCard lineas={lineas} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <ConcentracionCard
            titulo="Top clientes deudores (CxC)"
            icono={UsersIcon}
            data={d.top_clientes || []}
            nameKey="cliente"
            alertaPct={20}
            linkTo="/tesoreria/cuentas-por-cobrar"
            variant="rose"
          />
          <ConcentracionCard
            titulo="Top proveedores por pagar"
            icono={TruckIcon}
            data={d.top_proveedores_cxp || []}
            nameKey="proveedor"
            alertaPct={25}
            linkTo="/tesoreria/cuentas-por-pagar"
            variant="indigo"
          />
        </div>
      </div>

      {/* ============ 8. INSIGHTS AUTO ============ */}
      {d.insights && d.insights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="w-5 h-5 text-[var(--accent-blue)]" />
            <h2 className="font-semibold text-base">Insights automáticos del período</h2>
            <span className="text-xs text-[var(--text-muted)]">— {d.insights.length} hallazgos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.insights.map((ins, i) => {
              const cfg = insightConfig[ins.tipo] || insightConfig.atencion
              const Icon = cfg.icon
              return (
                <div key={i} className={`card border-l-4 ${cfg.cls} p-4 card-hover`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.txt} bg-current/10`}>
                      <Icon className={`w-4 h-4 ${cfg.txt}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.txt}`}>{cfg.badge}</span>
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
        </div>
      )}

      {/* ============ 9. ACCIÓN ESTA SEMANA ============ */}
      {d.cxc_criticas && d.cxc_criticas.length > 0 && (
        <div className="card">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <BoltIcon className="w-5 h-5 text-[var(--danger)]" />
              <h2 className="font-semibold">Acción esta semana · CxC con +60 días de atraso</h2>
            </div>
            <Link to="/tesoreria/cuentas-por-cobrar" className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
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

      {/* ============ Footer metodológica ============ */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-muted)] leading-relaxed">
        <p>
          <SparklesIcon className="w-4 h-4 inline mr-1 -mt-0.5" />
          <strong>Notas metodológicas.</strong> Ventas y márgenes reales al nivel línea × factura (<code>fact_ventas_linea</code>, costo_promedio_facturado del ERP).
          Compras y gastos operativos separados por <code>es_gasto_operativo</code>. CxC = snapshot vivo por buckets (por vencer / 1-30 / 31-60 / 61-90 / 90+).
          CxP = saldo pendiente × factura con fecha de vencimiento real del ERP. Health Score compone 7 dimensiones con pesos (crecimiento 20%, margen 20%, EBITDA 15%, cobertura CxC/CxP 15%, cobros 10%, concentración 10%, disciplina crédito 10%).
          Sincronización diaria via n8n · Datos al {d.fecha_corte}.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// 1. HERO EJECUTIVO
// ============================================================
function ExecutiveHero({ empresa, fechaCorte, kpis: k, health: h }) {
  const color = healthColor(h.grade)
  const scoreData = [{ name: 'score', value: h.score || 0, fill: color.fill }]

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#001639] via-[#001a45] to-[#003a7a] p-6 text-white relative overflow-hidden">
      {/* Textura sutil */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{
             backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.3) 0%, transparent 50%)'
           }} />
      <div className="relative flex items-start justify-between flex-wrap gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium">Briefing ejecutivo</p>
          <h1 className="text-3xl font-bold mt-1 tracking-tight">{empresa || 'Thermoplástica, S.A.'}</h1>
          <p className="text-sm text-white/60 mt-1">
            Datos al {fechaCorte} · ERP en tiempo real via Tailscale + n8n
          </p>

          {/* Composite Health Score */}
          <div className="mt-5 flex items-center gap-4">
            <div className="relative w-24 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={scoreData} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={12} background={{ fill: 'rgba(255,255,255,0.1)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold tabular-nums ${color.text}`}>{h.score || 0}</span>
                <span className="text-[9px] uppercase tracking-wider text-white/50">/100</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Health Score</p>
              <p className={`text-lg font-semibold capitalize ${color.text}`}>{h.grade || '—'}</p>
              <p className="text-xs text-white/50 mt-1">Compuesto de 7 dimensiones</p>
            </div>

            {/* Mini componentes del score */}
            <div className="ml-4 hidden md:grid grid-cols-4 gap-x-4 gap-y-1">
              <ScorePip label="Crec." value={h.componentes?.crecimiento} />
              <ScorePip label="Margen" value={h.componentes?.margen} />
              <ScorePip label="EBITDA" value={h.componentes?.ebitda} />
              <ScorePip label="WC" value={h.componentes?.cobertura} />
              <ScorePip label="Cobros" value={h.componentes?.cobros} />
              <ScorePip label="Concent." value={h.componentes?.concentracion} />
              <ScorePip label="Disc." value={h.componentes?.disciplina} />
            </div>
          </div>
        </div>

        {/* Números north-star a la derecha */}
        <div className="grid grid-cols-3 gap-6 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Ventas 12m</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmtM(k.ventas_12m)}</p>
            <DeltaBadge value={k.delta_ventas_pct} suffix="vs 12m prev" size="xs" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Margen bruto</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-300">{fmtPct(k.margen_bruto_pct)}</p>
            <DeltaBadge value={k.delta_margen_pp} suffix="pp YoY" size="xs" unit="pp" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">EBITDA est.</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${k.ebitda_estimado >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {fmtM(k.ebitda_estimado)}
            </p>
            <p className="text-[10px] text-white/50 mt-1">margen {fmtPct(k.ebitda_pct)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScorePip({ label, value }) {
  const v = value || 0
  const color = v >= 75 ? 'bg-emerald-400' : v >= 55 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <div className="w-1.5 h-4 bg-white/10 rounded overflow-hidden">
        <div className={`w-full ${color}`} style={{ height: `${v}%`, marginTop: `${100 - v}%` }} />
      </div>
      <div>
        <p className="text-white/80 tabular-nums font-semibold">{v}</p>
        <p className="text-white/40 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

function DeltaBadge({ value, suffix, size = 'sm', unit = '%' }) {
  if (value === null || value === undefined || isNaN(value)) {
    return <p className="text-[10px] text-white/40 mt-1">—</p>
  }
  const v = Number(value)
  const positive = v >= 0
  const Icon = positive ? ArrowUpRightIcon : ArrowDownRightIcon
  const cls = positive ? 'text-emerald-300' : 'text-rose-300'
  const textSize = size === 'xs' ? 'text-[11px]' : 'text-xs'
  const sign = positive ? '+' : ''
  return (
    <p className={`${textSize} ${cls} mt-1 flex items-center justify-end gap-0.5 tabular-nums font-medium`}>
      <Icon className="w-3 h-3" />
      {sign}{v.toFixed(1)}{unit === 'pp' ? 'pp' : '%'}
      {suffix && <span className="text-white/40 ml-1 font-normal">{suffix}</span>}
    </p>
  )
}

// ============================================================
// 2. PULSO 12M — 4 KPIs con YoY delta grande
// ============================================================
function PulsoRow({ kpis: k }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <PulsoCard
        label="Ventas 12m"
        value={fmtM(k.ventas_12m)}
        deltaPct={k.delta_ventas_pct}
        deltaLabel="vs 12m previo"
        sublabel={`${(k.facturas_12m || 0).toLocaleString('es-GT')} facturas · ${k.clientes_activos_12m || 0} clientes`}
        icon={ArrowTrendingUpIcon}
        to="/ventas"
        accent="blue"
      />
      <PulsoCard
        label="Margen bruto real"
        value={fmtPct(k.margen_bruto_pct)}
        deltaPct={k.delta_margen_pp}
        deltaLabel="pp YoY"
        deltaUnit="pp"
        sublabel={`${fmtM(k.margen_bruto_real_12m)} · costo ${fmtM(k.costo_ventas_12m)}`}
        icon={ScaleIcon}
        to="/margenes"
        accent="emerald"
      />
      <PulsoCard
        label="EBITDA estimado"
        value={fmtM(k.ebitda_estimado)}
        deltaPct={k.ebitda_pct}
        deltaLabel="margen del período"
        deltaUnit="%"
        sublabel={`Gastos op. ${fmtM(k.gastos_operativos_12m)} · sin MO ni depreciación`}
        icon={ArrowsRightLeftIcon}
        to="/gastos-operativos"
        accent={k.ebitda_estimado >= 0 ? 'emerald' : 'rose'}
        deltaIsMetric
      />
      <PulsoCard
        label="Posición neta WC"
        value={fmtM(k.posicion_neta_wc)}
        deltaPct={k.cobertura_cxc_cxp}
        deltaLabel="cobertura CxC/CxP"
        deltaUnit="x"
        sublabel={`CxC ${fmtM(k.cxc_total)} vs CxP ${fmtM(k.cxp_total)}`}
        icon={BanknotesIcon}
        to="/tesoreria"
        accent={k.posicion_neta_wc >= 0 ? 'emerald' : 'rose'}
        deltaIsRatio
      />
    </div>
  )
}

function PulsoCard({ label, value, deltaPct, deltaLabel, deltaUnit = '%', sublabel, icon: Icon, to, accent = 'blue', deltaIsMetric, deltaIsRatio }) {
  const accentBg = accent === 'emerald' ? 'from-emerald-500/10 to-emerald-500/0 border-emerald-500/20'
                 : accent === 'rose'    ? 'from-rose-500/10 to-rose-500/0 border-rose-500/20'
                 : accent === 'amber'   ? 'from-amber-500/10 to-amber-500/0 border-amber-500/20'
                 :                         'from-sky-500/10 to-sky-500/0 border-sky-500/20'
  const iconColor = accent === 'emerald' ? 'text-emerald-500'
                  : accent === 'rose'    ? 'text-rose-500'
                  : accent === 'amber'   ? 'text-amber-500'
                  :                         'text-sky-500'

  let deltaDisplay = null
  if (deltaPct !== null && deltaPct !== undefined && !isNaN(deltaPct)) {
    const v = Number(deltaPct)
    if (deltaIsRatio) {
      const good = v >= 1
      deltaDisplay = (
        <span className={`text-[11px] font-semibold tabular-nums ${good ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
          {v.toFixed(2)}x
        </span>
      )
    } else if (deltaIsMetric) {
      deltaDisplay = (
        <span className={`text-[11px] font-semibold tabular-nums ${v >= 10 ? 'text-[var(--success)]' : v >= 0 ? 'text-[var(--text-primary)]' : 'text-[var(--danger)]'}`}>
          {v.toFixed(1)}{deltaUnit}
        </span>
      )
    } else {
      const positive = v >= 0
      const Icon2 = positive ? ArrowUpRightIcon : ArrowDownRightIcon
      const cls = positive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
      deltaDisplay = (
        <span className={`text-[11px] font-semibold tabular-nums ${cls} flex items-center gap-0.5`}>
          <Icon2 className="w-3 h-3" />
          {positive ? '+' : ''}{v.toFixed(1)}{deltaUnit}
        </span>
      )
    }
  }

  const inner = (
    <div className={`relative rounded-xl border bg-gradient-to-br ${accentBg} bg-[var(--bg-primary)] p-4 h-full card-hover overflow-hidden`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      </div>
      <p className="text-2xl font-bold tabular-nums leading-tight text-[var(--text-primary)]">{value}</p>
      {deltaDisplay && (
        <div className="flex items-baseline gap-1.5 mt-1.5">
          {deltaDisplay}
          {deltaLabel && <span className="text-[10px] text-[var(--text-muted)]">{deltaLabel}</span>}
        </div>
      )}
      {sublabel && <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-snug">{sublabel}</p>}
    </div>
  )
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner
}

// ============================================================
// 3. VENTAS TREND — ComposedChart YoY
// ============================================================
function VentasTrendCard({ serie, kpis: k }) {
  if (!serie || serie.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--text-muted)]">Sin datos de ventas.</div>
    )
  }
  const promedio = serie.reduce((s, r) => s + (r.ventas || 0), 0) / serie.length

  return (
    <div className="card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-[var(--accent-blue)]" />
          <h2 className="font-semibold">Facturación mensual · comparativo YoY</h2>
        </div>
        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#001639] rounded-sm" /> Este período</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-slate-300 rounded-sm" /> Año anterior</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-emerald-500" /> Margen %</span>
          <Link to="/ventas" className="text-[var(--accent-blue)] flex items-center gap-1 hover:underline ml-2">
            Ver ventas <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
      </div>
      <div className="p-5 pt-0">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={serie} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ventasGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#001639" stopOpacity={1} />
                <stop offset="100%" stopColor="#003a7a" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="periodo" tickFormatter={fmtPeriod} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => `Q${(v/1e6).toFixed(1)}M`}
              tick={{ fontSize: 11 }}
              stroke="var(--text-muted)"
              width={65}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              stroke="var(--text-muted)"
              width={40}
              domain={[0, 60]}
            />
            <Tooltip
              formatter={(v, name) => name === 'Margen %' ? `${v}%` : fmtQ(v)}
              labelFormatter={fmtPeriod}
              contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
            />
            <ReferenceLine yAxisId="left" y={promedio} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: `Prom ${fmtM(promedio)}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
            <Bar yAxisId="left" dataKey="ventas_prev" name="Año anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar yAxisId="left" dataKey="ventas" name="Este período" fill="url(#ventasGrad)" radius={[6, 6, 0, 0]} maxBarSize={26} />
            <Line yAxisId="right" dataKey="margen_pct" name="Margen %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ============================================================
// 4a. CASH CONVERSION CYCLE
// ============================================================
function CashConversionCycle({ kpis: k }) {
  const dso = Math.round(k.dso || 0)
  const dio = Math.round(k.dio || 0)
  const dpo = Math.round(k.dpo || 0)
  const ccc = Math.round(k.ccc || 0)
  const max = Math.max(dso, dio, dpo, 60) + 20

  return (
    <div className="card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <ArrowsRightLeftIcon className="w-5 h-5 text-[var(--accent-blue)]" />
          <h2 className="font-semibold">Ciclo de conversión de efectivo</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">CCC = DSO + DIO − DPO</span>
      </div>
      <div className="p-5 pt-2 space-y-4">
        <CccBar label="DSO · Días cobrando (CxC)" value={dso} max={max} color="bg-emerald-500" hint="Cuánto tardan los clientes en pagarte" />
        <CccBar label="DIO · Días de inventario" value={dio} max={max} color="bg-sky-500" hint="Cuánto está inmovilizado el stock" />
        <CccBar label="DPO · Días pagando (CxP)" value={dpo} max={max} color="bg-rose-500" hint="Cuánto tardás en pagar proveedores" invert />

        <div className="pt-4 border-t border-[var(--border-default)] flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Ciclo neto · caja atrapada</p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {ccc > 0 ? 'Estás financiando la operación' : 'Los proveedores financian tu operación'}
            </p>
          </div>
          <p className={`text-3xl font-bold tabular-nums ${ccc > 45 ? 'text-[var(--warning)]' : ccc > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--success)]'}`}>
            {ccc}<span className="text-base font-normal text-[var(--text-muted)]"> días</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function CccBar({ label, value, max, color, hint, invert }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>
        </div>
        <p className="text-lg font-bold tabular-nums">
          {invert && '−'}{value}<span className="text-xs font-normal text-[var(--text-muted)]"> días</span>
        </p>
      </div>
      <div className="h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

// ============================================================
// 4b. WATERFALL P&L
// ============================================================
function PnlWaterfall({ kpis: k }) {
  const ventas = Number(k.ventas_12m) || 0
  const cogs = Number(k.costo_ventas_12m) || 0
  const gp = Number(k.margen_bruto_real_12m) || 0
  const gastos = Number(k.gastos_operativos_12m) || 0
  const ebitda = Number(k.ebitda_estimado) || 0

  // Datos con "start" para simular waterfall usando Bar apilado
  const data = [
    { name: 'Ventas',       base: 0,               valor: ventas,  fill: '#001639', tipo: 'total', absoluto: ventas },
    { name: 'COGS',         base: ventas - cogs,   valor: cogs,    fill: '#ef4444', tipo: 'neg',   absoluto: -cogs },
    { name: 'Margen bruto', base: 0,               valor: gp,      fill: '#10b981', tipo: 'sub',   absoluto: gp },
    { name: 'Gastos op.',   base: gp - gastos,     valor: gastos,  fill: '#f59e0b', tipo: 'neg',   absoluto: -gastos },
    { name: 'EBITDA',       base: 0,               valor: ebitda,  fill: ebitda >= 0 ? '#10b981' : '#ef4444', tipo: 'total', absoluto: ebitda },
  ]

  return (
    <div className="card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <ChartPieIcon className="w-5 h-5 text-[var(--accent-blue)]" />
          <h2 className="font-semibold">Cascada P&amp;L · 12 meses</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">de ventas a EBITDA</span>
      </div>
      <div className="p-5 pt-2">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} margin={{ top: 20, right: 15, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <YAxis tickFormatter={(v) => `Q${(v/1e6).toFixed(0)}M`} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={55} />
            <Tooltip
              formatter={(v, name, p) => [fmtQ(Math.abs(p.payload.absoluto || v)), 'Monto']}
              labelFormatter={(l) => l}
              contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="base" stackId="wf" fill="transparent" />
            <Bar dataKey="valor" stackId="wf" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-5 gap-1 text-[10px] text-center mt-2">
          <div><p className="text-[var(--text-muted)]">Ventas</p><p className="font-semibold tabular-nums">{fmtM(ventas)}</p></div>
          <div><p className="text-[var(--text-muted)]">− COGS</p><p className="font-semibold tabular-nums text-[var(--danger)]">{fmtM(cogs)}</p></div>
          <div><p className="text-[var(--text-muted)]">= Bruto</p><p className="font-semibold tabular-nums text-[var(--success)]">{fmtM(gp)}</p></div>
          <div><p className="text-[var(--text-muted)]">− Gastos</p><p className="font-semibold tabular-nums text-[var(--warning)]">{fmtM(gastos)}</p></div>
          <div><p className="text-[var(--text-muted)]">= EBITDA</p><p className={`font-semibold tabular-nums ${ebitda >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{fmtM(ebitda)}</p></div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 5. AGING CARD (CxC y CxP)
// ============================================================
function AgingCard({ titulo, tono, total, docCount, buckets, link, linkLabel }) {
  const isCobrar = tono === 'cobrar'
  const bucketDefs = [
    { key: 'por_vencer', label: 'Por vencer',    color: isCobrar ? 'bg-emerald-500' : 'bg-sky-500' },
    { key: 'v_1_30',     label: '1–30 días',     color: 'bg-amber-400' },
    { key: 'v_31_60',    label: '31–60 días',    color: 'bg-orange-500' },
    { key: 'v_61_90',    label: '61–90 días',    color: 'bg-rose-500' },
    { key: 'v_90_mas',   label: '90+ días',      color: 'bg-red-700' },
  ]
  const tot = Number(total) || 0
  const vencido = ['v_1_30','v_31_60','v_61_90','v_90_mas'].reduce((s, key) => s + (Number(buckets[key]) || 0), 0)
  const pctVencido = tot > 0 ? (vencido / tot * 100) : 0

  return (
    <div className="card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          {isCobrar ? <UsersIcon className="w-5 h-5 text-emerald-500" /> : <TruckIcon className="w-5 h-5 text-sky-500" />}
          <h2 className="font-semibold">{titulo}</h2>
        </div>
        {link && (
          <Link to={link} className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
            {linkLabel} <ArrowRightIcon className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5 pt-2">
        {/* Total + vencido overview */}
        <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-[var(--border-default)]">
          <div>
            <p className="text-3xl font-bold tabular-nums">{fmtM(tot)}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{docCount || 0} documentos · vencido {fmtM(vencido)} ({pctVencido.toFixed(1)}%)</p>
          </div>
          {pctVencido >= 20 && (
            <span className="px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
              Riesgo alto
            </span>
          )}
        </div>

        {/* Stacked horizontal bar */}
        <div className="h-4 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)] mb-3">
          {bucketDefs.map(b => {
            const val = Number(buckets[b.key]) || 0
            const pct = tot > 0 ? (val / tot * 100) : 0
            if (pct === 0) return null
            return (
              <div
                key={b.key}
                className={`${b.color} transition-all duration-700`}
                style={{ width: `${pct}%` }}
                title={`${b.label}: ${fmtQ(val)} (${pct.toFixed(1)}%)`}
              />
            )
          })}
        </div>

        {/* Legend + montos */}
        <div className="space-y-2">
          {bucketDefs.map(b => {
            const val = Number(buckets[b.key]) || 0
            const pct = tot > 0 ? (val / tot * 100) : 0
            return (
              <div key={b.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-block w-2.5 h-2.5 ${b.color} rounded-sm flex-shrink-0`} />
                  <span className="text-[var(--text-secondary)]">{b.label}</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-[var(--text-muted)] w-10 text-right">{pct.toFixed(1)}%</span>
                  <span className="font-semibold w-20 text-right">{fmtM(val)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 6. COMPRAS / GASTOS / INVENTARIO cards
// ============================================================
function ComprasKpiCard({ kpis: k }) {
  return (
    <MiniKpiCard
      titulo="Compras materia prima 12m"
      icon={ShoppingCartIcon}
      color="sky"
      valor={fmtM(k.compras_12m)}
      delta={k.delta_compras_pct}
      deltaLabel="vs 12m previo"
      pctVentas={k.ventas_12m > 0 ? (k.compras_12m / k.ventas_12m * 100) : null}
      pctVentasLabel="del total de ventas"
      to="/compras"
    />
  )
}

function GastosKpiCard({ kpis: k }) {
  return (
    <MiniKpiCard
      titulo="Gastos operativos 12m"
      icon={BuildingOfficeIcon}
      color="amber"
      valor={fmtM(k.gastos_operativos_12m)}
      delta={k.delta_gastos_pct}
      deltaLabel="vs 12m previo"
      pctVentas={k.ventas_12m > 0 ? (k.gastos_operativos_12m / k.ventas_12m * 100) : null}
      pctVentasLabel="del total de ventas"
      to="/gastos-operativos"
    />
  )
}

function InventarioKpiCard({ kpis: k }) {
  const rotacion = k.dio ? (365 / k.dio) : null
  return (
    <MiniKpiCard
      titulo="Inventario en almacén"
      icon={CubeIcon}
      color="indigo"
      valor={fmtM(k.inventario_valor)}
      delta={rotacion}
      deltaLabel="rotaciones/año"
      deltaUnit="x"
      deltaIsMetric
      pctVentas={k.inventario_articulos}
      pctVentasLabel={`SKUs (${k.inventario_con_stock || 0} con stock)`}
      pctVentasIsCount
      to="/inventario"
    />
  )
}

function MiniKpiCard({ titulo, icon: Icon, color, valor, delta, deltaLabel, deltaUnit = '%', deltaIsMetric, pctVentas, pctVentasLabel, pctVentasIsCount, to }) {
  const accentBg = color === 'emerald' ? 'from-emerald-500/10' : color === 'sky' ? 'from-sky-500/10' : color === 'amber' ? 'from-amber-500/10' : color === 'indigo' ? 'from-indigo-500/10' : 'from-slate-500/10'
  const iconColor = color === 'emerald' ? 'text-emerald-500' : color === 'sky' ? 'text-sky-500' : color === 'amber' ? 'text-amber-500' : color === 'indigo' ? 'text-indigo-500' : 'text-slate-500'
  const borderClr = color === 'emerald' ? 'border-emerald-500/20' : color === 'sky' ? 'border-sky-500/20' : color === 'amber' ? 'border-amber-500/20' : color === 'indigo' ? 'border-indigo-500/20' : 'border-slate-500/20'

  let deltaEl = null
  if (delta !== null && delta !== undefined && !isNaN(delta)) {
    if (deltaIsMetric) {
      deltaEl = (
        <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
          {Number(delta).toFixed(1)}{deltaUnit}
        </span>
      )
    } else {
      const v = Number(delta)
      const positive = v >= 0
      const Icon2 = positive ? ArrowUpRightIcon : ArrowDownRightIcon
      const cls = positive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
      deltaEl = (
        <span className={`text-sm font-semibold tabular-nums ${cls} flex items-center gap-0.5`}>
          <Icon2 className="w-3.5 h-3.5" />
          {positive ? '+' : ''}{v.toFixed(1)}{deltaUnit}
        </span>
      )
    }
  }

  const inner = (
    <div className={`relative rounded-xl border ${borderClr} bg-gradient-to-br ${accentBg} to-transparent bg-[var(--bg-primary)] p-4 h-full card-hover`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{titulo}</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{valor}</p>
        </div>
        <Icon className={`w-8 h-8 ${iconColor} opacity-40`} />
      </div>
      <div className="flex items-baseline gap-2 pt-2 border-t border-[var(--border-default)]">
        {deltaEl}
        <span className="text-[11px] text-[var(--text-muted)]">{deltaLabel}</span>
      </div>
      {pctVentas !== null && pctVentas !== undefined && (
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
          <span className="font-semibold text-[var(--text-secondary)]">
            {pctVentasIsCount ? Number(pctVentas).toLocaleString('es-GT') : `${Number(pctVentas).toFixed(1)}%`}
          </span> {pctVentasLabel}
        </p>
      )}
    </div>
  )
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner
}

// ============================================================
// 7a. MIX DE LÍNEAS (bar + margen overlay)
// ============================================================
function MixLineasCard({ lineas }) {
  if (!lineas || lineas.length === 0) return null
  return (
    <div className="card h-full">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <CubeIcon className="w-5 h-5 text-indigo-500" />
          <h2 className="font-semibold">Mix de líneas · ventas y margen 12m</h2>
        </div>
        <Link to="/ventas" className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
          Ver ventas <ArrowRightIcon className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-5 pt-2">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={lineas} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="linea" tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => `Q${(v/1e6).toFixed(1)}M`}
              tick={{ fontSize: 11 }}
              stroke="var(--text-muted)"
              width={60}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              stroke="var(--text-muted)"
              width={40}
              domain={[0, 70]}
            />
            <Tooltip
              formatter={(v, name) => name === 'Margen %' ? `${v}%` : fmtQ(v)}
              contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar yAxisId="left" dataKey="ventas" name="Ventas" fill="#6366f1" radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" dataKey="margen_pct" name="Margen %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ============================================================
// 7b. CONCENTRACIÓN CARD (mejora de la existente)
// ============================================================
function ConcentracionCard({ titulo, icono: Icon, data, nameKey, alertaPct, linkTo, variant }) {
  const hayConcentracion = data[0]?.porcentaje >= alertaPct
  const barCls = variant === 'rose' ? 'bg-rose-500' : variant === 'indigo' ? 'bg-indigo-500' : 'bg-[#001639]'
  const alertCls = 'bg-amber-500'
  return (
    <div className="card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${variant === 'rose' ? 'text-rose-500' : 'text-indigo-500'}`} />
          <h2 className="font-semibold text-sm">{titulo}</h2>
        </div>
        {linkTo && (
          <Link to={linkTo} className="text-[11px] text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
            <ArrowRightIcon className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-4 pt-1 space-y-2">
        {data.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin datos.</p>}
        {data.slice(0, 5).map((r, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-4">#{i + 1}</span>
                <span className="truncate max-w-[180px]">{r[nameKey]}</span>
              </div>
              <span className="font-semibold tabular-nums whitespace-nowrap text-[11px]">
                {fmtM(r.monto || r.gasto || r.ventas)}
                {r.porcentaje > 0 && (
                  <span className={`text-[10px] ml-1 ${r.porcentaje >= alertaPct ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>
                    ({r.porcentaje}%)
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${i === 0 && hayConcentracion ? alertCls : barCls}`}
                style={{ width: `${Math.max(r.porcentaje || 0, 1)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
