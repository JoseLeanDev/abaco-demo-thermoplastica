import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, LabelList,
} from 'recharts'
import PageInsights from '../components/agents/PageInsights'
import { useTesoreriaPosicion, useTesoreriaCxC, useTesoreriaCxP, useTesoreriaBancos } from '../hooks/useCfoData'
import { useAuth } from '../context/AuthContext'
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
  CalendarDaysIcon,
  ArrowsRightLeftIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'
import SemaforoCxc from '../components/common/SemaforoCxc'

// ───────────────────────── formato ─────────────────────────
const fmtQ = (n) => {
  const v = Math.round(Number(n) || 0)
  return `${v < 0 ? '−' : ''}Q${Math.abs(v).toLocaleString('es-GT')}`
}
const fmtM = (n) => {
  const v = Number(n) || 0
  const s = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a >= 1e6) return `${s}Q${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${s}Q${Math.round(a / 1e3)}k`
  return fmtQ(v)
}
const SIMBOLO = { Q: 'Q', 'US$': 'US$', EU: '€' }
const fmtMon = (moneda, n, dec = 0) => {
  const v = Number(n) || 0
  return `${v < 0 ? '−' : ''}${SIMBOLO[moneda] || moneda} ${Math.abs(v).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}
const fmtMonCorto = (moneda, n) => {
  const v = Number(n) || 0
  const a = Math.abs(v), s = v < 0 ? '−' : '', sym = SIMBOLO[moneda] || moneda
  if (a >= 1e6) return `${s}${sym} ${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${s}${sym} ${(a / 1e3).toFixed(1)}k`
  return `${s}${sym} ${Math.round(a)}`
}
const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT')
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtFecha = (d) => {
  if (!d) return '—'
  const [y, m, dd] = String(d).slice(0, 10).split('-')
  return `${parseInt(dd)} ${MESES[parseInt(m) - 1]} ${y}`
}
const fmtMes = (ym) => {
  const [y, m] = String(ym).split('-')
  return `${MESES[parseInt(m) - 1]} ${y.slice(2)}`
}
const fmtSemana = (desde, hasta) => {
  const [, m1, d1] = desde.split('-'), [, m2, d2] = hasta.split('-')
  return m1 === m2 ? `${parseInt(d1)}–${parseInt(d2)} ${MESES[parseInt(m1) - 1]}`
    : `${parseInt(d1)} ${MESES[parseInt(m1) - 1]}–${parseInt(d2)} ${MESES[parseInt(m2) - 1]}`
}

const C = {
  navy: '#001639', entrada: '#10b981', salida: '#f43f5e', cxc: '#2563EB', cxp: '#f95f34', gris: '#94a3b8',
}
const tooltipStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }
const ejeQ = (v) => fmtM(v)

// ───────────────────────── piezas ─────────────────────────
function Kpi({ label, leyenda, icon: Icon, iconClass, valor, valorClass = '', sub, children, dashed }) {
  return (
    <div className={`kpi-card card-hover ${dashed ? 'border-dashed border-2 border-[var(--border-default)]' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="kpi-label flex items-center gap-1">{label} {leyenda && <Leyenda k={leyenda} />}</span>
        {Icon && <Icon className={`w-4 h-4 ${iconClass || 'text-[var(--text-muted)]'}`} />}
      </div>
      <p className={`kpi-value ${valorClass}`}>{valor}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug">{sub}</p>}
      {children}
    </div>
  )
}

function Card({ icon: Icon, titulo, leyenda, derecha, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="section-header flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-[var(--text-muted)]" />}
          <h2 className="font-semibold">{titulo}</h2>
          {leyenda && <Leyenda k={leyenda} />}
        </div>
        {derecha}
      </div>
      <div className="p-5 pt-0">{children}</div>
    </div>
  )
}

const VerMas = ({ to, children }) => (
  <Link to={to} className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline">
    {children} <ArrowRightIcon className="w-3 h-3" />
  </Link>
)

const Punto = ({ color, children, linea }) => (
  <span className="flex items-center gap-1">
    <span className={linea ? 'inline-block w-4 h-0.5' : 'inline-block w-3 h-3 rounded-sm'} style={{ background: color }} />
    {children}
  </span>
)

const Vacio = ({ children }) => (
  <div className="py-10 text-center text-sm text-[var(--text-muted)]">{children}</div>
)

// Flujo de caja mensual en bancos
function FlujoCaja({ b }) {
  const serie = (b.flujo_mensual || []).map(f => ({
    mes: fmtMes(f.mes), entradas: f.entradas_q, salidas: f.salidas_q, neto: f.neto_q, saldo: f.saldo_fin_q,
  }))
  const f = b.flujo || {}
  const saldoFinal = b.efectivo?.total_q
  const stats = [
    { l: 'Saldo al inicio', v: fmtM(f.saldo_inicial_q) },
    { l: 'Entradas', v: fmtM(f.entradas_q), c: 'text-emerald-600' },
    { l: 'Salidas', v: fmtM(f.salidas_q), c: 'text-rose-600' },
    { l: 'Flujo neto', v: fmtM(f.neto_q), c: (f.neto_q || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600' },
    { l: 'Saldo al cierre', v: fmtM(saldoFinal) },
  ]
  return (
    <Card
      icon={ChartBarIcon}
      titulo="Flujo de caja en bancos"
      leyenda="flujo_caja_bancos"
      derecha={
        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-3 flex-wrap">
          <Punto color={C.entrada}>Entradas</Punto>
          <Punto color={C.salida}>Salidas</Punto>
          <Punto color={C.navy} linea>Saldo fin de mes</Punto>
          <VerMas to="/tesoreria/conciliacion-bancaria">Ver movimientos</VerMas>
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {stats.map(s => (
          <div key={s.l} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{s.l}</p>
            <p className={`text-base font-semibold tabular-nums ${s.c || ''}`}>{s.v}</p>
          </div>
        ))}
      </div>
      {serie.length === 0 ? <Vacio>Sin movimientos bancarios en el período.</Vacio> : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <YAxis tickFormatter={ejeQ} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={62} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, name) => [fmtQ(v), name]}
              labelFormatter={(l, p) => {
                const n = p?.[0]?.payload?.neto
                return n == null ? l : `${l} · neto ${fmtQ(n)}`
              }}
            />
            <Bar dataKey="entradas" name="Entradas" fill={C.entrada} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="salidas" name="Salidas" fill={C.salida} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line dataKey="saldo" name="Saldo fin de mes" stroke={C.navy} strokeWidth={2.5} dot={{ r: 3, fill: C.navy }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <p className="text-xs text-[var(--text-muted)] mt-3 flex items-start gap-1.5">
        <ArrowsRightLeftIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          No incluye {fmtM((b.composicion || []).find(c => c.categoria === 'traslados')?.salidas_q || 0)} en traslados
          entre cuentas propias (compra de divisas, fondeo de planilla).
          {Math.abs(f.traslados_q || 0) >= 1000 && <> Efecto neto de esos traslados en el saldo: {fmtQ(f.traslados_q)} (diferencial cambiario).</>}
        </span>
      </p>
    </Card>
  )
}

// Efectivo por cuenta (barras horizontales en Q)
function EfectivoCuentas({ b }) {
  const data = (b.cuentas || [])
    .filter(c => c.saldo_q != null)
    .map(c => ({ ...c, etiqueta: `${c.banco.replace(/, S\.A\.|S\.A\./, '').replace('Banco ', '').trim()} ${c.cod_cta}` }))
    .sort((a, z) => z.saldo_q - a.saldo_q)
  const tc = b.tipos_cambio || []
  return (
    <Card
      icon={BuildingLibraryIcon}
      titulo="Efectivo por cuenta"
      leyenda="efectivo_cuentas"
      derecha={<VerMas to="/tesoreria/conciliacion-bancaria">Conciliación</VerMas>}
    >
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="etiqueta" width={118} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'var(--bg-secondary)' }}
            formatter={(v, _n, p) => [
              p.payload.moneda === 'Q' ? fmtQ(v) : `${fmtMon(p.payload.moneda, p.payload.saldo, 2)} ≈ ${fmtQ(v)}`,
              `${p.payload.banco} · ${p.payload.num_cta || ''}`,
            ]}
            labelFormatter={() => ''}
          />
          <Bar dataKey="saldo_q" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map(d => <Cell key={d.cod_cta} fill={d.saldo_q < 0 ? C.salida : d.moneda === 'Q' ? C.navy : d.moneda === 'US$' ? '#2f6fb3' : '#7c9cc4'} />)}
            <LabelList dataKey="saldo_q" position="right" formatter={fmtM} style={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] text-[var(--text-muted)]">
        <Punto color={C.navy}>Quetzales</Punto>
        <Punto color="#2f6fb3">Dólares</Punto>
        <Punto color="#7c9cc4">Euros</Punto>
        {tc.length > 0 && (
          <span className="flex items-center gap-1 ml-auto">
            Tipo de cambio: {tc.map(t => `${SIMBOLO[t.moneda] || t.moneda}1 = Q${t.tasa.toFixed(2)}`).join(' · ')}
            <Leyenda k="tipo_cambio_ref" />
          </span>
        )}
      </div>
    </Card>
  )
}

// Composición de entradas y salidas
function Composicion({ b }) {
  const comp = b.composicion || []
  const ent = comp.filter(c => c.tipo === 'entrada').sort((a, z) => z.entradas_q - a.entradas_q)
  const sal = comp.filter(c => c.tipo === 'salida').sort((a, z) => z.salidas_q - a.salidas_q)
  const totE = ent.reduce((s, c) => s + c.entradas_q, 0)
  const totS = sal.reduce((s, c) => s + c.salidas_q, 0)
  const Fila = ({ c, monto, total, color }) => {
    const pct = total > 0 ? monto / total * 100 : 0
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-[var(--text-secondary)] truncate" title={c.nombre}>{c.nombre}</span>
          <span className="font-semibold tabular-nums whitespace-nowrap">
            {fmtM(monto)} <span className="text-xs text-[var(--text-muted)] font-normal">{pct.toFixed(0)}%</span>
          </span>
        </div>
        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 0.5)}%`, background: color }} />
        </div>
      </div>
    )
  }
  return (
    <Card icon={ArrowsRightLeftIcon} titulo="De dónde entra y a dónde sale" leyenda="composicion_flujo">
      {comp.length === 0 ? <Vacio>Sin movimientos en el período.</Vacio> : (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 flex justify-between">
              <span>Entradas</span><span className="tabular-nums">{fmtQ(totE)}</span>
            </p>
            {ent.map(c => <Fila key={c.categoria} c={c} monto={c.entradas_q} total={totE} color={C.entrada} />)}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 flex justify-between">
              <span>Salidas</span><span className="tabular-nums">{fmtQ(totS)}</span>
            </p>
            {sal.map(c => <Fila key={c.categoria} c={c} monto={c.salidas_q} total={totS} color={C.salida} />)}
          </div>
        </div>
      )}
    </Card>
  )
}

// Antigüedad comparada CxC vs CxP
function AgingComparado({ pos, cxcDetalle, cxpDetalle }) {
  const data = pos.aging || []
  const cxc = pos.cxc || {}, cxp = pos.cxp || {}
  return (
    <Card
      icon={ScaleIcon}
      titulo="Antigüedad: por cobrar vs por pagar"
      leyenda="aging_comparado"
      derecha={
        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-3">
          <Punto color={C.cxc}>Por cobrar</Punto>
          <Punto color={C.cxp}>Por pagar</Punto>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border-l-4 px-3 py-2 bg-[var(--bg-secondary)]" style={{ borderLeftColor: C.cxc }}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Por cobrar</span>
            <VerMas to="/tesoreria/cuentas-por-cobrar">Detalle</VerMas>
          </div>
          <p className="text-lg font-semibold tabular-nums">{fmtQ(cxc.total)}</p>
          <p className="text-xs text-[var(--text-muted)]">
            Vencido {fmtQ(cxc.vencido)} ({cxc.total > 0 ? Math.round(cxc.vencido / cxc.total * 100) : 0}%) ·
            atraso prom. {cxcDetalle.promedio_dias_cobro || 0} d <Leyenda k="atraso_promedio" />
          </p>
        </div>
        <div className="rounded-lg border-l-4 px-3 py-2 bg-[var(--bg-secondary)]" style={{ borderLeftColor: C.cxp }}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Por pagar</span>
            <VerMas to="/tesoreria/cuentas-por-pagar">Detalle</VerMas>
          </div>
          <p className="text-lg font-semibold tabular-nums">{fmtQ(cxp.total)}</p>
          <p className="text-xs text-[var(--text-muted)]">
            Vencido {fmtQ(cxp.vencido)} ({cxp.total > 0 ? Math.round(cxp.vencido / cxp.total * 100) : 0}%) ·
            crédito prom. {cxpDetalle.dias_credito_promedio || 0} d <Leyenda k="dias_credito" />
          </p>
        </div>
      </div>
      {data.every(d => !d.cxc && !d.cxp) ? <Vacio>Sin saldos pendientes de documentos emitidos en el período.</Vacio> : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 22, right: 10, bottom: 0, left: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="tramo" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
            <YAxis tickFormatter={ejeQ} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={62}
              domain={[0, (max) => max * 1.15]} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [fmtQ(v), name]} cursor={{ fill: 'var(--bg-secondary)' }} />
            <Bar dataKey="cxc" name="Por cobrar" fill={C.cxc} radius={[4, 4, 0, 0]} maxBarSize={34}>
              <LabelList dataKey="cxc" position="top" formatter={(v) => (v ? fmtM(v) : '')} style={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            </Bar>
            <Bar dataKey="cxp" name="Por pagar" fill={C.cxp} radius={[4, 4, 0, 0]} maxBarSize={34}>
              <LabelList dataKey="cxp" position="top" formatter={(v) => (v ? fmtM(v) : '')} style={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// Vencimientos de las próximas semanas
function Vencimientos({ pos, efectivoHoy }) {
  const conCaja = efectivoHoy != null
  let acum = efectivoHoy || 0
  const data = (pos.vencimientos || []).map(s => {
    acum += s.cxc - s.cxp
    return { ...s, etiqueta: fmtSemana(s.desde, s.hasta), neto: s.cxc - s.cxp, proyectado: conCaja ? acum : null }
  })
  const totC = data.reduce((a, s) => a + s.cxc, 0), totP = data.reduce((a, s) => a + s.cxp, 0)
  return (
    <Card
      icon={CalendarDaysIcon}
      titulo="Vencimientos de las próximas 8 semanas"
      leyenda="vencimientos_semanas"
      derecha={
        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-3 flex-wrap">
          <Punto color={C.cxc}>Vence por cobrar</Punto>
          <Punto color={C.cxp}>Vence por pagar</Punto>
          {conCaja && <Punto color={C.navy} linea>Efectivo + cobros − pagos</Punto>}
          <VerMas to="/tesoreria/proyecciones">Proyecciones</VerMas>
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Vence por cobrar</p>
          <p className="text-base font-semibold tabular-nums" style={{ color: C.cxc }}>{fmtM(totC)}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Vence por pagar</p>
          <p className="text-base font-semibold tabular-nums" style={{ color: C.cxp }}>{fmtM(totP)}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Ya vencido por cobrar</p>
          <p className="text-base font-semibold tabular-nums">{fmtM(pos.cxc?.vencido)}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Ya vencido por pagar</p>
          <p className="text-base font-semibold tabular-nums">{fmtM(pos.cxp?.vencido)}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval={0} />
          <YAxis yAxisId="v" tickFormatter={ejeQ} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={62} />
          {conCaja && <YAxis yAxisId="c" orientation="right" tickFormatter={ejeQ} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={62} />}
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [fmtQ(v), name]}
            labelFormatter={(l, p) => {
              const n = p?.[0]?.payload?.neto
              return n == null ? l : `Semana ${l} · neto ${fmtQ(n)}`
            }}
          />
          <Bar yAxisId="v" dataKey="cxc" name="Vence por cobrar" fill={C.cxc} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar yAxisId="v" dataKey="cxp" name="Vence por pagar" fill={C.cxp} radius={[4, 4, 0, 0]} maxBarSize={26} />
          {conCaja && (
            <Line yAxisId="c" dataKey="proyectado" name="Efectivo + cobros − pagos" stroke={C.navy}
              strokeWidth={2.5} dot={{ r: 3, fill: C.navy }} activeDot={{ r: 5 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  )
}

// Ranking con barra de participación
function Ranking({ icon, titulo, leyenda, link, filas, total, color, vacio, renderSub, hrefFila }) {
  return (
    <Card icon={icon} titulo={titulo} leyenda={leyenda} derecha={link}>
      {filas.length === 0 ? <Vacio>{vacio}</Vacio> : (
        <div className="space-y-3">
          {filas.map((f, i) => {
            const pct = total > 0 ? f.monto / total * 100 : 0
            const nombre = <span className="font-medium truncate">{f.nombre}</span>
            const href = hrefFila?.(f)
            return (
              <div key={f.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-muted)] tabular-nums w-4 shrink-0">{i + 1}</span>
                    {href ? <Link to={href} className="truncate hover:underline">{nombre}</Link> : nombre}
                  </span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">
                    {fmtQ(f.monto)} <span className={`text-xs font-normal ${pct >= 25 ? 'text-[var(--warning)] font-semibold' : 'text-[var(--text-muted)]'}`}>{pct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden ml-6">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 0.5)}%`, background: color }} />
                </div>
                {renderSub && <p className="text-[11px] text-[var(--text-muted)] ml-6">{renderSub(f)}</p>}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ───────────────────────── página ─────────────────────────
export default function Tesoreria() {
  const { puede } = useAuth()
  const conBancos = puede('bancos')
  const { data: posicionRes, isLoading: loadingPos } = useTesoreriaPosicion()
  const { data: cxcRes } = useTesoreriaCxC()
  const { data: cxpRes } = useTesoreriaCxP()
  const { data: bancosRes, isLoading: loadingBancos, isError: errorBancos } = useTesoreriaBancos(conBancos)

  const pos = posicionRes?.data || {}
  const cxc = pos.cxc || {}
  const cxp = pos.cxp || {}
  const cxpDetalle = cxpRes?.data || {}
  const cxcDetalle = cxcRes?.data || {}
  const b = conBancos ? bancosRes?.data : null
  const efectivo = b?.efectivo?.total_q
  const hayEfectivo = b && efectivo != null && !errorBancos

  const netaPositiva = (pos.posicion_neta_working_capital || 0) >= 0
  const ratio = pos.ratio_cobertura_cxc_cxp
  const liquidez = hayEfectivo ? efectivo + (cxc.total || 0) - (cxp.total || 0) : null
  const coberturaLiq = hayEfectivo && cxp.total > 0 ? (efectivo + (cxc.total || 0)) / cxp.total : null

  const monedasSub = (b?.efectivo?.monedas || [])
    .filter(m => m.saldo)
    .sort((a, z) => (a.moneda === 'Q' ? -1 : z.moneda === 'Q' ? 1 : z.saldo_q - a.saldo_q))
    .map(m => fmtMonCorto(m.moneda, m.saldo)).join(' · ')

  const topDeudores = (cxcDetalle.top_deudores || []).map(d => ({ ...d, key: d.codigo, nombre: d.cliente }))
  const topProv = (cxpDetalle.top_proveedores || []).slice(0, 8).map(p => ({ ...p, key: p.codigo, nombre: p.proveedor }))

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
              {hayEfectivo
                ? <>Efectivo en bancos al {fmtFecha(b.corte)} · CxC y CxP del ERP al día</>
                : <>Capital de trabajo al {fmtFecha(pos.fecha_corte)} · CxC y CxP del ERP al día</>}
            </p>
            <PeriodoActivo
              nota={hayEfectivo ? 'efectivo al cierre del período; CxC y CxP de documentos emitidos en el período' : 'CxC y CxP de documentos emitidos en el período'}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${conBancos ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {conBancos ? (
          <Kpi
            label="Efectivo en bancos" leyenda="efectivo_bancos" icon={BuildingLibraryIcon} iconClass="text-[var(--accent-blue)]"
            valor={loadingBancos ? '—' : errorBancos ? 'Error' : fmtQ(efectivo)}
            sub={hayEfectivo ? `${monedasSub} · ${b.cuentas?.length || 0} cuentas` : errorBancos ? 'No se pudo leer la conciliación bancaria' : null}
          />
        ) : (
          <Kpi
            label="Efectivo en bancos" leyenda="efectivo_bancos" icon={BuildingLibraryIcon} dashed
            valor={<span className="text-[var(--text-muted)]">—</span>}
            sub="Tu rol no tiene acceso a los saldos bancarios"
          />
        )}
        <Kpi
          label="Por cobrar (CxC)" leyenda="cxc_total" icon={ArrowTrendingUpIcon} iconClass="text-[var(--success)]"
          valor={loadingPos ? '—' : fmtQ(cxc.total)}
          sub={`${fmtNum(cxc.documentos)} documentos · vencido ${fmtM(cxc.vencido)}`}
        />
        <Kpi
          label="Por pagar (CxP)" leyenda="cxp_total" icon={ArrowTrendingDownIcon} iconClass="text-[var(--warning)]"
          valor={loadingPos ? '—' : fmtQ(cxp.total)}
          sub={`${fmtNum(cxp.facturas)} facturas · ${fmtNum(cxp.proveedores)} proveedores · vencido ${fmtM(cxp.vencido)}`}
        />
        <Kpi
          label="Posición neta WC" leyenda="posicion_neta_wc" icon={ScaleIcon}
          valor={loadingPos ? '—' : fmtQ(pos.posicion_neta_working_capital)}
          valorClass={netaPositiva ? 'text-[var(--success)]' : 'text-[var(--danger)]'}
          sub={`CxC − CxP${ratio != null ? ` · cobertura ${ratio.toFixed(2)}×` : ''}`}
        />
        {conBancos && (
          <Kpi
            label="Liquidez neta" leyenda="liquidez_neta" icon={ShieldCheckIcon}
            valor={liquidez == null || loadingPos ? '—' : fmtQ(liquidez)}
            valorClass={liquidez == null ? '' : liquidez >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}
            sub={`Efectivo + CxC − CxP${coberturaLiq != null ? ` · cobertura ${coberturaLiq.toFixed(2)}×` : ''}`}
          />
        )}
      </div>

      {/* Semáforo de cartera vencida */}
      <SemaforoCxc total={cxc.total} vencido={cxc.vencido} link="/tesoreria/cuentas-por-cobrar" cargando={loadingPos} />

      {/* Insights del analista diario (vertical cartera) */}
      <PageInsights vertical="cartera" maxInsights={4} />

      {/* Bancos: flujo de caja real, efectivo por cuenta y composición */}
      {hayEfectivo && (
        <>
          <FlujoCaja b={b} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EfectivoCuentas b={b} />
            <Composicion b={b} />
          </div>
        </>
      )}

      {/* Antigüedad comparada + vencimientos */}
      <AgingComparado pos={pos} cxcDetalle={cxcDetalle} cxpDetalle={cxpDetalle} />
      <Vencimientos pos={pos} efectivoHoy={hayEfectivo ? efectivo : null} />

      {/* Alerta si CxP > CxC */}
      {(cxp.total || 0) > (cxc.total || 0) && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg,#fff7ed)] p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--warning)]">CxP mayor que CxC</p>
            <p className="text-[var(--text-secondary)]">
              Debés a proveedores <strong>{fmtQ((cxp.total || 0) - (cxc.total || 0))}</strong> más de lo que te deben tus clientes.
              {hayEfectivo
                ? (efectivo >= (cxp.total || 0) - (cxc.total || 0)
                  ? <> El efectivo en bancos ({fmtQ(efectivo)}) alcanza para cubrir esa diferencia.</>
                  : <> El efectivo en bancos ({fmtQ(efectivo)}) <strong>no alcanza</strong> para cubrir esa diferencia.</>)
                : <> Normal en manufactura con stock, pero si no hay caja suficiente aparece presión de tesorería.</>}
            </p>
          </div>
        </div>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Ranking
          icon={UserGroupIcon} titulo="Clientes con más saldo por cobrar" leyenda="top_deudores_tesoreria"
          link={<VerMas to="/tesoreria/cuentas-por-cobrar">Ver cartera</VerMas>}
          filas={topDeudores} total={cxcDetalle.total_cxc || cxc.total} color={C.cxc}
          vacio={cxcRes ? 'Sin saldos por cobrar en el período.' : 'Cargando…'}
          hrefFila={(f) => (f.cliente_id ? `/tesoreria/cuentas-por-cobrar/cliente/${f.cliente_id}` : null)}
          renderSub={(f) => (f.vencido > 0
            ? <>Vencido {fmtQ(f.vencido)} · hasta {f.dias} días de atraso</>
            : <>Al corriente</>)}
        />
        <Ranking
          icon={UserGroupIcon} titulo="Proveedores con más saldo por pagar" leyenda="top_proveedores_cxp"
          link={<VerMas to="/tesoreria/cuentas-por-pagar">Ver CxP</VerMas>}
          filas={topProv} total={cxpDetalle.total_cxp || cxp.total} color={C.cxp}
          vacio={cxpRes ? 'Sin saldos por pagar en el período.' : 'Cargando…'}
          hrefFila={(f) => (f.proveedor_id ? `/tesoreria/cuentas-por-pagar/proveedor/${f.proveedor_id}` : null)}
          renderSub={(f) => <>{fmtNum(f.facturas)} facturas{f.facturas_vencidas ? ` · ${fmtNum(f.facturas_vencidas)} vencidas` : ''}{f.dias_credito ? ` · crédito ${f.dias_credito} d` : ''}</>}
        />
      </div>

      {/* Próximos pagos (siguientes 30 días) */}
      <Card icon={ClockIcon} titulo="Próximos pagos a proveedores (30 días)" leyenda="proximos_pagos"
        derecha={<span className="text-xs text-[var(--text-muted)]">
          {fmtNum((cxpDetalle.proximos_pagos || []).length)} facturas · {fmtQ((cxpDetalle.proximos_pagos || []).reduce((s, p) => s + p.monto, 0))}
        </span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left  font-semibold py-2">Vence</th>
                <th className="text-left  font-semibold py-2">Proveedor</th>
                <th className="text-left  font-semibold py-2">Factura</th>
                <th className="text-right font-semibold py-2">Monto</th>
                <th className="text-right font-semibold py-2">Días <Leyenda k="dias_restantes" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {(cxpDetalle.proximos_pagos || []).length === 0 && (
                <tr><td colSpan={5} className="py-4 text-sm text-[var(--text-muted)] text-center">
                  {cxpRes ? 'Sin pagos que venzan en los próximos 30 días.' : 'Cargando…'}
                </td></tr>
              )}
              {(cxpDetalle.proximos_pagos || []).slice(0, 15).map((p, i) => (
                <tr key={`${p.numero_interno}-${i}`} className="text-sm hover:bg-[var(--bg-secondary)]">
                  <td className="py-2 pr-3 tabular-nums text-[var(--text-secondary)] whitespace-nowrap">{fmtFecha(p.fecha_vencimiento)}</td>
                  <td className="py-2 pr-3">
                    <Link to={`/tesoreria/cuentas-por-pagar/proveedor/${p.proveedor_id}`} className="font-medium truncate max-w-[280px] block hover:underline">{p.proveedor}</Link>
                    <p className="text-xs text-[var(--text-muted)]">{p.codigo}</p>
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-secondary)]">{p.factura_proveedor || p.numero_interno || '—'}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{fmtQ(p.monto)}</td>
                  <td className={`py-2 text-right tabular-nums text-sm font-semibold ${
                    p.dias_restantes <= 7 ? 'text-[var(--danger)]' : p.dias_restantes <= 15 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                  }`}>{p.dias_restantes}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nota metodológica */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--text-muted)] leading-relaxed space-y-1">
          <p><strong>Origen de los datos:</strong> ERP Profit, sincronizado a diario por n8n.</p>
          <p>
            CxC de <code>vstCuentaPorCobrar</code> (último corte). CxP de <code>vstAnalisisCxP</code>, con la
            fecha de vencimiento real acordada con cada proveedor.
            {conBancos && <> Bancos de <code>vst_ConciliacionBancaria</code> (todos los días a las 06:00): saldo según los libros de Profit;
            las partidas en tránsito se revisan en <Link to="/tesoreria/conciliacion-bancaria" className="text-[var(--accent-blue)] hover:underline">Conciliación bancaria</Link>.</>}
          </p>
        </div>
      </div>
    </div>
  )
}
