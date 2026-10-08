import { Fragment, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine, Cell,
} from 'recharts'
import {
  ArrowLeftIcon, ArrowDownTrayIcon, BuildingOfficeIcon, ExclamationTriangleIcon, CheckCircleIcon,
  InformationCircleIcon, ChevronDownIcon, ChevronRightIcon, DocumentTextIcon, ClockIcon, ShoppingBagIcon,
} from '@heroicons/react/24/outline'
import { endpoints } from '../services/cfoApi'
import { usePeriodo } from '../context/PeriodoContext'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'

// Ficha de un cliente: estado de cuenta, cómo paga y qué compra.

const fmtQ = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtQ2 = (n) => `Q${(Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return `Q${Math.round(v)}`
}
const fmtF = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: '2-digit' }) : '—')
const fmtMes = (s) => {
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-GT', { month: 'short', year: '2-digit' })
}
const fmtDias = (n) => (n === null || n === undefined ? '—' : `${Math.round(n)} d`)
const fmtPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(0)}%`)
const variacion = (a, b) => (b ? (a / b - 1) * 100 : null)
const tooltipStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }

const TABS = [
  { id: 'cuenta',  label: 'Estado de cuenta', icon: DocumentTextIcon },
  { id: 'pagos',   label: 'Cómo paga',        icon: ClockIcon },
  { id: 'compras', label: 'Qué compra',       icon: ShoppingBagIcon },
]

export default function ClienteCxc() {
  const { id } = useParams()
  const { params: periodo } = usePeriodo()
  const [tab, setTab] = useState('cuenta')

  const { data, isLoading, isError, error, isFetching } = useQuery(
    ['cxc-cliente', id, periodo],
    () => endpoints.tesoreria.cxcCliente(id, periodo),
    { keepPreviousData: true }
  )
  const d = data?.data
  // Con keepPreviousData, al cambiar de cliente no se muestra la ficha del anterior
  const vigente = d && String(d.cliente.id) === String(id)

  if (isError) {
    return (
      <div className="max-w-7xl space-y-4">
        <Volver />
        <div className="card p-10 text-center text-sm text-[var(--text-muted)]">
          No se pudo cargar el cliente. {error?.response?.data?.message || error?.message}
        </div>
      </div>
    )
  }
  if (isLoading || !vigente) return <Esqueleto />

  const { cliente: c, saldo, comportamiento, compras } = d

  return (
    <div className={`space-y-6 animate-fade-in max-w-7xl ${isFetching ? 'opacity-80' : ''}`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <Volver />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-muted)] shrink-0 hidden sm:block" />
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight sm:truncate">{c.nombre}</h1>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-2">
              <span>Código {c.codigo}</span>
              {c.sector && <span>· {c.sector}</span>}
              {c.tipo_cliente && <span>· {c.tipo_cliente}</span>}
              {c.vendedor && <span>· Vendedor: <span className="text-[var(--text-secondary)]">{c.vendedor}</span></span>}
              {c.sucursal && <span>· {c.sucursal}</span>}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-2">
              <span>Crédito en ficha: <span className="font-medium text-[var(--text-secondary)]">{c.dias_credito !== null ? `${c.dias_credito} días` : '—'}</span> <Leyenda k="dias_credito" /></span>
              <span>· Primera compra registrada: {fmtF(c.primera_compra)}</span>
              <span>· Última compra: {fmtF(c.ultima_compra)}{c.dias_sin_comprar !== null && ` (hace ${c.dias_sin_comprar} días)`}</span>
            </p>
            <PeriodoActivo nota="el saldo es al último corte; pagos y compras son del período" className="mt-1" />
          </div>
        </div>
        <button onClick={() => descargarEstadoCuenta(d)} className="btn-secondary flex items-center gap-2 text-sm" disabled={!d.estado_cuenta.length}>
          <ArrowDownTrayIcon className="w-4 h-4" />
          Estado de cuenta (Excel)
        </button>
      </div>

      {/* Señales */}
      {d.senales.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 flex items-center gap-1">Señales <Leyenda k="senales_cliente" /></p>
          <ul className="space-y-1.5">
            {d.senales.map((s, i) => {
              const Icon = s.tipo === 'bien' ? CheckCircleIcon : s.tipo === 'alerta' ? ExclamationTriangleIcon : InformationCircleIcon
              const color = s.tipo === 'bien' ? 'text-[var(--success)]' : s.tipo === 'alerta' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                  <span className="text-[var(--text-secondary)]">{s.texto}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi titulo="Saldo actual" leyenda="saldo_cliente" valor={fmtQ(saldo.total)}
          sub={`${saldo.documentos} documento${saldo.documentos === 1 ? '' : 's'} abiertos`} />
        <Kpi titulo="Vencido" leyenda="dias_vencido" valor={fmtQ(saldo.vencido)}
          tono={saldo.vencido > 0 ? (saldo.mas_antiguo_dias > 60 ? 'danger' : 'warning') : 'success'}
          sub={saldo.vencido > 0 ? `${saldo.vencidos} docs · el más antiguo ${saldo.mas_antiguo_dias} d` : 'Nada vencido'} />
        <Kpi titulo="Días reales de pago" leyenda="dias_pago_real" valor={fmtDias(comportamiento.actual.dias_pago)}
          tono={c.dias_credito !== null && comportamiento.actual.dias_pago > c.dias_credito + 5 ? 'warning' : undefined}
          sub={<>
            ficha {c.dias_credito ?? '—'} d
            {comportamiento.anterior.dias_pago !== null && <> · año ant. {fmtDias(comportamiento.anterior.dias_pago)}</>}
          </>} />
        <Kpi titulo="Pagado a tiempo" leyenda="pct_a_tiempo" valor={fmtPct(comportamiento.actual.pct_a_tiempo)}
          tono={comportamiento.actual.pct_a_tiempo === null ? undefined : comportamiento.actual.pct_a_tiempo >= 80 ? 'success' : comportamiento.actual.pct_a_tiempo >= 50 ? 'warning' : 'danger'}
          sub={comportamiento.actual.atraso !== null ? `atraso promedio ${comportamiento.actual.atraso > 0 ? '+' : ''}${Math.round(comportamiento.actual.atraso)} d` : 'sin facturas pagadas'} />
        <Kpi titulo="Compras del período" leyenda="compras_cliente" valor={fmtM(compras.actual.ventas)}
          delta={compras.variacion_pct} sub="vs año anterior" />
        <Kpi titulo="Margen bruto" leyenda="margen_bruto" valor={fmtPct(compras.actual.margen_pct)}
          sub={compras.cada_dias ? `compra cada ${compras.cada_dias} d` : `${compras.actual.facturas} facturas`} />
      </div>

      {/* Pestañas */}
      <div className="border-b border-[var(--border-default)] flex gap-1 overflow-x-auto overflow-y-hidden">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-[#001639] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cuenta' && <TabEstadoCuenta d={d} />}
      {tab === 'pagos' && <TabPagos d={d} />}
      {tab === 'compras' && <TabCompras d={d} />}
    </div>
  )
}

// ------------------------------------------------------------------
function Volver() {
  return (
    <Link
      to="/tesoreria/cuentas-por-cobrar"
      title="Volver a Cuentas por Cobrar"
      className="w-10 h-10 shrink-0 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
    >
      <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
    </Link>
  )
}

function Esqueleto() {
  return (
    <div className="space-y-6 max-w-7xl animate-pulse">
      <div className="flex gap-4"><Volver /><div className="space-y-2"><div className="h-7 w-72 rounded bg-[var(--bg-tertiary)]" /><div className="h-4 w-96 max-w-full rounded bg-[var(--bg-tertiary)]" /></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-[var(--bg-tertiary)]" />)}
      </div>
      <div className="h-80 rounded-xl bg-[var(--bg-tertiary)]" />
    </div>
  )
}

const TONOS = { success: 'text-[var(--success)]', warning: 'text-[var(--warning)]', danger: 'text-[var(--danger)]' }

function Kpi({ titulo, leyenda, valor, sub, tono, delta }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</span>
      <p className={`text-xl font-bold tabular-nums mt-1 ${tono ? TONOS[tono] : ''}`}>{valor}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">
        {delta !== undefined && delta !== null && (
          <span className={`font-semibold mr-1 ${delta >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
        {sub}
      </p>
    </div>
  )
}

function Seccion({ titulo, leyenda, extra, children, sinPadding }) {
  return (
    <div className="card overflow-hidden">
      <div className="section-header flex-wrap gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {leyenda && <Leyenda k={leyenda} />}
        {extra && <div className="ml-auto">{extra}</div>}
      </div>
      <div className={sinPadding ? '' : 'p-5 pt-0'}>{children}</div>
    </div>
  )
}

const th = 'px-3 py-2.5 text-xs font-semibold text-[var(--text-muted)] uppercase whitespace-nowrap'
const td = 'px-3 py-2 text-sm whitespace-nowrap'

// Situación de un documento abierto según sus días desde el vencimiento
function Situacion({ dias }) {
  if (dias > 0) {
    const cls = dias > 60 ? 'badge-danger' : 'badge-warning'
    return <span className={cls}>Vencida {dias} d</span>
  }
  if (dias === 0) return <span className="badge-warning">Vence hoy</span>
  return <span className="badge-success">Vence en {-dias} d</span>
}

function Atraso({ dias }) {
  if (dias === null || dias === undefined) return <span className="text-[var(--text-muted)]">—</span>
  if (dias <= 0) return <span className="text-[var(--success)] font-medium">{dias < 0 ? `${-dias} d antes` : 'a tiempo'}</span>
  return <span className={`font-semibold ${dias > 30 ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`}>+{dias} d</span>
}

// ------------------------------------------------------------------
// Estado de cuenta
// ------------------------------------------------------------------
const TRAMOS = [
  { k: 'por_vencer', label: 'Por vencer', color: '#10b981' },
  { k: 'd1_30',      label: '1–30 d',     color: '#f59e0b' },
  { k: 'd31_60',     label: '31–60 d',    color: '#f97316' },
  { k: 'd61_90',     label: '61–90 d',    color: '#ef4444' },
  { k: 'd90_mas',    label: '+90 d',      color: '#991b1b' },
]

function TabEstadoCuenta({ d }) {
  const [verPagadas, setVerPagadas] = useState(false)
  const { saldo, estado_cuenta: docs, pagadas } = d
  const totalValor = docs.reduce((t, x) => t + (x.valor || 0), 0)
  const totalAbonado = docs.reduce((t, x) => t + (x.abonado || 0), 0)

  return (
    <div className="space-y-6">
      <Seccion titulo="Antigüedad del saldo" leyenda="aging_cxc">
        {saldo.total > 0 ? (
          <>
            <div className="flex h-4 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
              {TRAMOS.map(t => saldo.aging[t.k] > 0 && (
                <div key={t.k} style={{ width: `${saldo.aging[t.k] / saldo.total * 100}%`, background: t.color }} title={`${t.label}: ${fmtQ(saldo.aging[t.k])}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              {TRAMOS.map(t => (
                <div key={t.k}>
                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />{t.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{fmtQ(saldo.aging[t.k])}</p>
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">{(saldo.aging[t.k] / saldo.total * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3">Corte del reporte de cartera: {fmtF(saldo.corte)}{saldo.proximo_vencimiento && ` · próximo vencimiento ${fmtF(saldo.proximo_vencimiento)}`}</p>
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)] py-4">El cliente no tiene saldo pendiente al último corte.</p>
        )}
      </Seccion>

      <Seccion titulo={`Documentos abiertos (${docs.length})`} leyenda="estado_cuenta" sinPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
              <tr>
                <th className={`${th} text-left`}>Documento</th>
                <th className={`${th} text-left`}>Emisión</th>
                <th className={`${th} text-left`}>Vence</th>
                <th className={`${th} text-right`}>Valor</th>
                <th className={`${th} text-right`}>Abonado</th>
                <th className={`${th} text-right`}>Saldo</th>
                <th className={`${th} text-center`}>Situación</th>
                <th className={`${th} text-left`}>Último abono</th>
                <th className={`${th} text-left`}>Vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {docs.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Sin documentos abiertos.</td></tr>
              )}
              {docs.map(x => (
                <tr key={`${x.tipo_documento}-${x.documento}`} className="hover:bg-[var(--bg-secondary)]">
                  <td className={`${td} font-medium`}>{x.tipo_documento} {x.documento}</td>
                  <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtF(x.fecha_emision)}</td>
                  <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtF(x.fecha_vencimiento)}</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{x.valor !== null ? fmtQ2(x.valor) : '—'}</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{x.abonado ? fmtQ2(x.abonado) : '—'}</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ2(x.saldo)}</td>
                  <td className={`${td} text-center`}><Situacion dias={x.dias_vencido} /></td>
                  <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtF(x.ultimo_abono)}</td>
                  <td className={`${td} text-[var(--text-secondary)]`}>{x.vendedor || '—'}</td>
                </tr>
              ))}
            </tbody>
            {docs.length > 0 && (
              <tfoot className="border-t-2 border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <tr>
                  <td className={`${td} font-semibold`} colSpan={3}>Total</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ2(totalValor)}</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ2(totalAbonado)}</td>
                  <td className={`${td} text-right tabular-nums font-bold`}>{fmtQ2(saldo.total)}</td>
                  <td className={`${td} text-center text-xs text-[var(--danger)]`}>{saldo.vencido > 0 && `Vencido ${fmtQ(saldo.vencido)}`}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Seccion>

      <div className="card overflow-hidden">
        <button
          onClick={() => setVerPagadas(v => !v)}
          className="w-full section-header text-left hover:bg-[var(--bg-secondary)] transition-colors"
        >
          {verPagadas ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          <h2 className="font-semibold">Facturas pagadas ({pagadas.length}{pagadas.length === 200 ? ' más recientes' : ''})</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{verPagadas ? 'Ocultar' : 'Ver historial'}</span>
        </button>
        {verPagadas && (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)] sticky top-0">
                <tr>
                  <th className={`${th} text-left`}>Factura</th>
                  <th className={`${th} text-left`}>Emisión</th>
                  <th className={`${th} text-left`}>Vencía</th>
                  <th className={`${th} text-left`}>Pagada</th>
                  <th className={`${th} text-right`}>Valor</th>
                  <th className={`${th} text-right`}>Tardó <Leyenda k="dias_pago_real" /></th>
                  <th className={`${th} text-right`}>Vs vencimiento <Leyenda k="atraso_pago" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {pagadas.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Sin facturas pagadas en el historial.</td></tr>
                )}
                {pagadas.map(x => (
                  <tr key={x.documento} className="hover:bg-[var(--bg-secondary)]">
                    <td className={`${td} font-medium`}>{x.documento}</td>
                    <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtF(x.fecha_emision)}</td>
                    <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtF(x.fecha_vencimiento)}</td>
                    <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtF(x.fecha_cobro)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtQ2(x.valor)}</td>
                    <td className={`${td} text-right tabular-nums`}>{x.dias_pago} d</td>
                    <td className={`${td} text-right tabular-nums`}><Atraso dias={x.atraso} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Cómo paga
// ------------------------------------------------------------------
const TRAMOS_ATRASO = [
  { label: 'Antes o en fecha', min: -Infinity, max: 0, color: '#10b981' },
  { label: '1–7 d tarde',      min: 1,  max: 7,   color: '#facc15' },
  { label: '8–15 d tarde',     min: 8,  max: 15,  color: '#f59e0b' },
  { label: '16–30 d tarde',    min: 16, max: 30,  color: '#f97316' },
  { label: '31–60 d tarde',    min: 31, max: 60,  color: '#ef4444' },
  { label: '+60 d tarde',      min: 61, max: Infinity, color: '#991b1b' },
]

function TabPagos({ d }) {
  const { comportamiento: { actual: a, anterior: p }, cliente: c, serie, pagadas } = d

  const distribucion = useMemo(() => {
    const total = pagadas.reduce((t, x) => t + x.valor, 0)
    return TRAMOS_ATRASO.map(t => {
      const sel = pagadas.filter(x => x.atraso >= t.min && x.atraso <= t.max)
      const monto = sel.reduce((s, x) => s + x.valor, 0)
      return { ...t, facturas: sel.length, monto, pct: total > 0 ? monto / total * 100 : 0 }
    })
  }, [pagadas])

  const datos = serie.filter(s => !s.sin_datos).map(s => ({ ...s, etiqueta: fmtMes(s.mes) }))

  const filas = [
    { label: 'Días reales de pago', k: 'dias_pago_real', a: a.dias_pago, p: p.dias_pago, fmt: fmtDias, peorSiSube: true },
    { label: 'Mediana de días de pago', k: 'dias_pago_real', a: a.dias_pago_mediana, p: p.dias_pago_mediana, fmt: fmtDias, peorSiSube: true },
    { label: 'Atraso vs vencimiento', k: 'atraso_pago', a: a.atraso, p: p.atraso, fmt: (v) => (v === null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)} d`), peorSiSube: true },
    { label: 'Pagado a tiempo', k: 'pct_a_tiempo', a: a.pct_a_tiempo, p: p.pct_a_tiempo, fmt: fmtPct, peorSiSube: false, unidad: 'pts' },
    { label: 'Plazo en factura', k: 'plazo_facturado', a: a.plazo, p: p.plazo, fmt: fmtDias },
    { label: 'Peor atraso', k: 'peor_atraso', a: a.peor_atraso, p: p.peor_atraso, fmt: (v) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v} d`), peorSiSube: true },
    { label: 'Facturas pagadas', a: a.facturas, p: p.facturas, fmt: (v) => v.toLocaleString('es-GT') },
    { label: 'Monto pagado', a: a.monto, p: p.monto, fmt: fmtQ },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Seccion titulo="Período vs año anterior" leyenda="dias_pago_real" sinPadding>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
                  <tr>
                    <th className={`${th} text-left`}>Indicador</th>
                    <th className={`${th} text-right`}>Período</th>
                    <th className={`${th} text-right`}>Año anterior</th>
                    <th className={`${th} text-right`}>Cambio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filas.map(f => {
                    const dif = f.a !== null && f.p !== null && f.a !== undefined && f.p !== undefined ? f.a - f.p : null
                    const malo = f.peorSiSube === undefined || dif === null || Math.abs(dif) < 1 ? null : (dif > 0) === f.peorSiSube
                    return (
                      <tr key={f.label}>
                        <td className={`${td} text-[var(--text-secondary)]`}>{f.label} {f.k && <Leyenda k={f.k} />}</td>
                        <td className={`${td} text-right tabular-nums font-semibold`}>{f.fmt(f.a)}</td>
                        <td className={`${td} text-right tabular-nums text-[var(--text-muted)]`}>{f.fmt(f.p)}</td>
                        <td className={`${td} text-right tabular-nums ${malo === null ? 'text-[var(--text-muted)]' : malo ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                          {dif === null ? '—' : f.label === 'Monto pagado'
                            ? (f.p ? `${dif >= 0 ? '+' : ''}${(dif / f.p * 100).toFixed(0)}%` : '—')
                            : `${dif >= 0 ? '+' : ''}${Math.round(dif).toLocaleString('es-GT')}${f.unidad ? ` ${f.unidad}` : f.label === 'Facturas pagadas' ? '' : ' d'}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--text-muted)] px-5 py-3">
              Crédito pactado en la ficha: <strong>{c.dias_credito ?? '—'} días</strong>. Solo cuenta facturas que terminaron de pagarse en cada rango.
            </p>
          </Seccion>
        </div>

        <div className="lg:col-span-2">
          <Seccion titulo="Cuándo paga" leyenda="distribucion_atraso">
            {pagadas.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">Sin facturas pagadas en el historial.</p>
            ) : (
              <div className="space-y-3 pt-1">
                {distribucion.map(t => (
                  <div key={t.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--text-secondary)]">{t.label}</span>
                      <span className="tabular-nums text-[var(--text-muted)]">{t.facturas} fact. · <span className="font-semibold text-[var(--text-primary)]">{t.pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: t.color }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-[var(--text-muted)] pt-1">Sobre las últimas {pagadas.length} facturas pagadas, ponderado por monto.</p>
              </div>
            )}
          </Seccion>
        </div>
      </div>

      <Seccion titulo="Facturado vs cobrado por mes" leyenda="facturado_cobrado">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis yAxisId="q" tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={56} />
              <YAxis yAxisId="d" orientation="right" tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={40} tickFormatter={(v) => `${v}d`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, n) => (n === 'Días de pago' ? [v === null ? '—' : `${Math.round(v)} días`, n] : [fmtQ(v), n])}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="q" dataKey="facturado" name="Facturado (con IVA)" fill="#001639" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="q" dataKey="cobrado" name="Cobrado" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Line yAxisId="d" dataKey="dias_pago" name="Días de pago" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              {c.dias_credito !== null && (
                <ReferenceLine yAxisId="d" y={c.dias_credito} stroke="#f59e0b" strokeDasharray="4 4"
                  label={{ value: `ficha ${c.dias_credito}d`, position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">Hasta 24 meses; el historial de cobros del ERP empieza en septiembre de 2024.</p>
      </Seccion>
    </div>
  )
}

// ------------------------------------------------------------------
// Qué compra
// ------------------------------------------------------------------
function EstadoPago({ f }) {
  if (f.saldo === null || f.saldo === undefined) return <span className="text-xs text-[var(--text-muted)]">—</span>
  if (Number(f.saldo) === 0) {
    const dias = f.fecha_cobro ? Math.max(0, Math.round((new Date(`${f.fecha_cobro}T00:00:00`) - new Date(`${f.fecha}T00:00:00`)) / 86400000)) : null
    return <span className="badge-success">{dias === 0 ? 'Pagada (contado)' : dias !== null ? `Pagada en ${dias} d` : 'Pagada'}</span>
  }
  const venc = f.fecha_vencimiento ? Math.round((Date.now() - new Date(`${f.fecha_vencimiento}T00:00:00`)) / 86400000) : null
  if (venc !== null && venc > 0) return <span className={venc > 60 ? 'badge-danger' : 'badge-warning'}>Vencida {venc} d</span>
  return <span className="badge-warning">Pendiente · vence {fmtF(f.fecha_vencimiento)}</span>
}

function TabCompras({ d }) {
  const [abierta, setAbierta] = useState(null)
  const { serie, categorias, productos, ultimas_facturas: ultimas, compras } = d
  const datos = serie.filter(s => !s.sin_datos).map(s => ({ ...s, etiqueta: fmtMes(s.mes), enPeriodo: s.mes >= d.periodo.desde.slice(0, 7) }))
  const totalCat = categorias.reduce((t, x) => t + x.ventas, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniDato titulo="Facturas" valor={compras.actual.facturas.toLocaleString('es-GT')} prev={compras.anterior.facturas.toLocaleString('es-GT')} />
        <MiniDato titulo="Ticket promedio" valor={fmtQ(compras.actual.ticket)} prev={fmtQ(compras.anterior.ticket)} />
        <MiniDato titulo="Unidades" valor={Math.round(compras.actual.unidades).toLocaleString('es-GT')} prev={Math.round(compras.anterior.unidades).toLocaleString('es-GT')} />
        <MiniDato titulo="Frecuencia" leyenda="frecuencia_compra" valor={compras.cada_dias ? `cada ${compras.cada_dias} d` : '—'} prev={null} />
      </div>

      <Seccion titulo="Compras por mes (sin IVA)" leyenda="compras_cliente">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={56} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtQ(v), 'Compras']} />
              <Bar dataKey="compras" radius={[3, 3, 0, 0]}>
                {datos.map(x => <Cell key={x.mes} fill={x.enPeriodo ? '#001639' : '#cbd5e1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">Oscuro: meses del período seleccionado.</p>
      </Seccion>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Seccion titulo="Por categoría" leyenda="categoria" sinPadding>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
                  <tr>
                    <th className={`${th} text-left`}>Categoría</th>
                    <th className={`${th} text-right`}>Ventas</th>
                    <th className={`${th} text-right`}>vs año ant.</th>
                    <th className={`${th} text-right`}>Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {categorias.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Sin compras.</td></tr>}
                  {categorias.map(x => {
                    const v = variacion(x.ventas, x.ventas_prev)
                    return (
                      <tr key={x.categoria}>
                        <td className={td}>
                          <p className="font-medium">{x.categoria}</p>
                          <div className="h-1 mt-1 w-28 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div className="h-full bg-[#001639]" style={{ width: `${totalCat > 0 ? Math.max(0, x.ventas / totalCat * 100) : 0}%` }} />
                          </div>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{fmtM(x.ventas)}</td>
                        <td className={`${td} text-right tabular-nums ${v === null ? 'text-[var(--text-muted)]' : v >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                          {v === null ? (x.ventas > 0 ? 'nueva' : '—') : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{fmtPct(x.margen_pct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Seccion>
        </div>
        <div className="lg:col-span-3">
          <Seccion titulo="Productos que compra" sinPadding>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)] sticky top-0">
                  <tr>
                    <th className={`${th} text-left`}>Producto</th>
                    <th className={`${th} text-right`}>Unidades</th>
                    <th className={`${th} text-right`}>Ventas</th>
                    <th className={`${th} text-right`}>vs año ant.</th>
                    <th className={`${th} text-right`}>Margen</th>
                    <th className={`${th} text-left`}>Última</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {productos.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Sin compras.</td></tr>}
                  {productos.map(x => {
                    const v = variacion(x.ventas, x.ventas_prev)
                    return (
                      <tr key={x.codigo}>
                        <td className="px-3 py-2 text-sm max-w-[280px]">
                          <p className="font-medium truncate" title={x.articulo}>{x.articulo}</p>
                          <p className="text-xs text-[var(--text-muted)]">{x.codigo} · {x.categoria}</p>
                        </td>
                        <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{Math.round(x.unidades).toLocaleString('es-GT')}</td>
                        <td className={`${td} text-right tabular-nums font-semibold`}>{fmtM(x.ventas)}</td>
                        <td className={`${td} text-right tabular-nums ${v === null ? 'text-[var(--text-muted)]' : v >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                          {x.ventas === 0 ? 'no compró' : v === null ? 'nuevo' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{fmtPct(x.margen_pct)}</td>
                        <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtF(x.ultima_compra)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Seccion>
        </div>
      </div>

      <Seccion titulo="Compras más recientes" sinPadding extra={<span className="text-xs text-[var(--text-muted)]">Clic para ver el detalle</span>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
              <tr>
                <th className={`${th} text-left w-8`} />
                <th className={`${th} text-left`}>Fecha</th>
                <th className={`${th} text-left`}>Factura</th>
                <th className={`${th} text-left`}>Productos</th>
                <th className={`${th} text-right`}>Total sin IVA</th>
                <th className={`${th} text-right`}>Margen</th>
                <th className={`${th} text-left`}>Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {ultimas.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Sin compras registradas.</td></tr>}
              {ultimas.map(f => (
                <Fragment key={f.documento}>
                  <tr className="hover:bg-[var(--bg-secondary)] cursor-pointer" onClick={() => setAbierta(abierta === f.documento ? null : f.documento)}>
                    <td className="px-3 py-2">{abierta === f.documento ? <ChevronDownIcon className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRightIcon className="w-4 h-4 text-[var(--text-muted)]" />}</td>
                    <td className={`${td} tabular-nums`}>{fmtF(f.fecha)}</td>
                    <td className={`${td} font-medium`}>{f.documento}</td>
                    <td className="px-3 py-2 text-sm max-w-[320px]">
                      <p className="truncate text-[var(--text-secondary)]" title={f.lineas.map(l => l.articulo).join(' · ')}>
                        {f.lineas[0]?.articulo}{f.lineas.length > 1 && <span className="text-[var(--text-muted)]"> +{f.lineas.length - 1} más</span>}
                      </p>
                    </td>
                    <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ2(f.total_sin_iva)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtPct(f.margen_pct)}</td>
                    <td className={td}><EstadoPago f={f} /></td>
                  </tr>
                  {abierta === f.documento && (
                    <tr className="bg-[var(--bg-secondary)]">
                      <td />
                      <td colSpan={6} className="px-3 pb-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[var(--text-muted)]">
                              <th className="text-left font-semibold py-1.5">Producto</th>
                              <th className="text-left font-semibold py-1.5">Categoría</th>
                              <th className="text-right font-semibold py-1.5">Unidades</th>
                              <th className="text-right font-semibold py-1.5">Precio unit.</th>
                              <th className="text-right font-semibold py-1.5">Total sin IVA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.lineas.map((l, i) => (
                              <tr key={i} className="border-t border-[var(--border-default)]">
                                <td className="py-1.5 pr-3">{l.articulo} <span className="text-[var(--text-muted)]">({l.codigo})</span></td>
                                <td className="py-1.5 pr-3 text-[var(--text-secondary)]">{l.categoria || '—'}</td>
                                <td className="py-1.5 text-right tabular-nums">{(l.unidades ?? 0).toLocaleString('es-GT')}</td>
                                <td className="py-1.5 text-right tabular-nums">{l.precio !== null ? fmtQ2(l.precio) : '—'}</td>
                                <td className="py-1.5 text-right tabular-nums font-medium">{fmtQ2(l.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-xs text-[var(--text-muted)] mt-2">
                          Total con IVA {fmtQ2(f.total_con_iva)}{f.vendedor && ` · Vendedor: ${f.vendedor}`}
                          {f.fecha_vencimiento && ` · Vence ${fmtF(f.fecha_vencimiento)}`}
                          {f.fecha_cobro && Number(f.saldo) === 0 && ` · Pagada ${fmtF(f.fecha_cobro)}`}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  )
}

function MiniDato({ titulo, leyenda, valor, prev }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</span>
      <p className="text-lg font-bold tabular-nums mt-1">{valor}</p>
      {prev !== null && <p className="text-xs text-[var(--text-muted)] mt-0.5">año ant. {prev}</p>}
    </div>
  )
}

// ------------------------------------------------------------------
// Estado de cuenta en CSV (Excel lo abre directo; BOM para los acentos)
// ------------------------------------------------------------------
function descargarEstadoCuenta(d) {
  const { cliente: c, estado_cuenta: docs, saldo } = d
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const n = (v) => (v === null || v === undefined ? '' : Number(v).toFixed(2))
  const filas = [
    [`Estado de cuenta — ${c.nombre} (código ${c.codigo})`],
    [`Corte del reporte de cartera: ${saldo.corte || ''}`],
    [],
    ['Documento', 'Emisión', 'Vencimiento', 'Valor', 'Abonado', 'Saldo', 'Días vencido', 'Último abono', 'Vendedor'],
    ...docs.map(x => [
      `${x.tipo_documento} ${x.documento}`, x.fecha_emision, x.fecha_vencimiento, n(x.valor), n(x.abonado), n(x.saldo),
      x.dias_vencido > 0 ? x.dias_vencido : 0, x.ultimo_abono || '', x.vendedor || '',
    ]),
    [],
    ['Total', '', '', '', '', n(saldo.total)],
    ['Vencido', '', '', '', '', n(saldo.vencido)],
  ]
  const csv = '﻿' + filas.map(f => f.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `estado-de-cuenta-${c.codigo}-${saldo.corte || 'hoy'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
