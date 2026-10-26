import { useState } from 'react'
import { useQuery, useInfiniteQuery } from 'react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'
import {
  ArrowLeftIcon, ArrowDownTrayIcon, ArrowTrendingUpIcon, UserIcon, ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon,
  ChartBarIcon, UserGroupIcon, CubeIcon, ReceiptPercentIcon, BanknotesIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { endpoints } from '../services/cfoApi'
import { usePeriodo } from '../context/PeriodoContext'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'
import FiltroProducto, { FILTRO_VACIO } from '../components/ventas/FiltroProducto'
import { Puente } from '../components/ventas/TabCategorias'
import { exportarExcel, traerTodo } from '../services/excel'

// Ficha de un vendedor: cuánto vende, cómo evoluciona, a quién le vende, qué vende
// y la cartera por cobrar que el ERP le tiene asignada.

const fmtQ = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })
const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT')
const fmtPct = (n, d = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`)
const fmtF = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: '2-digit' }) : '—')
const fmtPeriod = (p) => {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${meses[+m - 1]} ${y.slice(2)}`
}
const tooltipStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }

const margenTone = (pct) => {
  if (pct === null || pct === undefined) return 'text-[var(--text-muted)]'
  if (pct >= 40) return 'text-[var(--success)]'
  if (pct >= 25) return 'text-[var(--warning)]'
  return 'text-[var(--danger)]'
}

const Var = ({ pct, nuevo }) => {
  if (nuevo) return <span className="text-xs font-semibold text-[var(--success)]">nuevo</span>
  if (pct === null || pct === undefined) return <span className="text-[var(--text-muted)]">—</span>
  const tone = pct > 0 ? 'text-[var(--success)]' : pct < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
  return <span className={`tabular-nums font-semibold ${tone}`}>{pct > 0 ? '+' : ''}{Number(pct).toFixed(1)}%</span>
}

const SinCosto = ({ pct }) => (pct >= 1 ? (
  <p className="text-[10px] font-normal text-[var(--text-muted)] whitespace-nowrap" title="El margen % se calcula solo con las líneas que traen costo en el ERP">
    {Number(pct).toFixed(1)}% sin costo
  </p>
) : null)

const COLUMNAS_LINEAS = [
  { label: 'Fecha', get: f => String(f.fecha_emision).slice(0, 10) },
  { label: 'Documento', get: f => `${f.tipo_doc} ${f.fact_num}` },
  { label: 'Código cliente', get: f => f.codigo_cliente },
  { label: 'Cliente', get: f => f.cliente },
  { label: 'Sucursal', get: f => f.sucursal },
  { label: 'Código artículo', get: f => f.codigo_articulo },
  { label: 'Artículo', get: f => f.articulo },
  { label: 'Subcategoría', get: f => f.linea },
  { label: 'Unidades', get: f => f.unidades },
  { label: 'Total sin IVA', get: f => f.total_sin_iva.toFixed(2) },
  { label: 'Total con IVA', get: f => f.total_con_iva.toFixed(2) },
  { label: 'Margen bruto', get: f => (f.margen_bruto === null ? '' : f.margen_bruto.toFixed(2)) },
  { label: 'Margen %', get: f => (f.margen_bruto_pct === null ? '' : Number(f.margen_bruto_pct).toFixed(1)) },
]

const TABS = [
  { id: 'resumen',   label: 'Resumen',           icon: ChartBarIcon },
  { id: 'clientes',  label: 'Clientes',          icon: UserGroupIcon },
  { id: 'productos', label: 'Productos',         icon: CubeIcon },
  { id: 'historial', label: 'Historial de ventas', icon: ReceiptPercentIcon },
  { id: 'cartera',   label: 'Cartera por cobrar', icon: BanknotesIcon },
]

export default function VendedorVentas() {
  const { codigo } = useParams()
  const { desde, hasta } = usePeriodo()
  const [tab, setTab] = useState('resumen')
  const [producto, setProducto] = useState(FILTRO_VACIO)
  const prodParams = Object.fromEntries(Object.entries(producto).filter(([, v]) => v))

  const { data, isLoading, isError, error, isFetching } = useQuery(
    ['ventas-vendedor', codigo, desde, hasta, JSON.stringify(prodParams)],
    () => endpoints.ventas.vendedor(codigo, { desde, hasta, ...prodParams }),
    { keepPreviousData: true }
  )
  const d = data?.data
  // Con keepPreviousData, al cambiar de vendedor no se muestra la ficha del anterior
  const vigente = d && d.vendedor.codigo === codigo

  if (isError) {
    return (
      <div className="max-w-7xl space-y-4">
        <Volver />
        <div className="card p-10 text-center text-sm text-[var(--text-muted)]">
          No se pudo cargar el vendedor. {error?.response?.data?.message || error?.message}
        </div>
      </div>
    )
  }
  if (isLoading || !vigente) return <Esqueleto />

  const { vendedor: v, resumen: r, equipo: e, cartera } = d
  const senales = calcularSenales(d)

  return (
    <div className={`space-y-6 animate-fade-in max-w-7xl ${isFetching ? 'opacity-80' : ''}`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <Volver />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-[var(--text-muted)] shrink-0 hidden sm:block" />
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight sm:truncate">{v.nombre}</h1>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-2">
              <span>Código {v.codigo}</span>
              {r.posicion && <span>· #{r.posicion} de {r.n_vendedores} en ventas <Leyenda k="posicion_vendedor" /></span>}
              <span>· Primera venta registrada: {fmtF(v.primera_venta)}</span>
              <span>· Última venta: {fmtF(v.ultima_venta)}{v.dias_sin_vender !== null && ` (hace ${v.dias_sin_vender} días)`}</span>
            </p>
            <PeriodoActivo nota="la cartera es al último corte" className="mt-1" />
          </div>
        </div>
        <FiltroProducto value={producto} onChange={setProducto} />
      </div>

      {/* Señales */}
      {senales.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 flex items-center gap-1">Señales <Leyenda k="senales_vendedor" /></p>
          <ul className="space-y-1.5">
            {senales.map((s, i) => {
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
        <Kpi titulo="Ventas del período" leyenda="ventas" valor={fmtM(r.ventas)}
          delta={r.variacion_pct} sub={`vs ${fmtM(r.ventas_prev)} año ant.`} />
        <Kpi titulo="% de las ventas" leyenda="participacion" valor={fmtPct(r.participacion)}
          sub={r.posicion ? `#${r.posicion} de ${r.n_vendedores} vendedores` : 'sin ventas en el período'} />
        <Kpi titulo="Margen bruto" leyenda="margen_bruto" valor={fmtPct(r.margen_pct)}
          tono={r.margen_pct === null || e.margen_pct === null ? undefined : r.margen_pct >= e.margen_pct ? 'success' : 'warning'}
          sub={<>equipo {fmtPct(e.margen_pct)}{r.margen_pct_prev !== null && <> · año ant. {fmtPct(r.margen_pct_prev)}</>}</>} />
        <Kpi titulo="Clientes atendidos" leyenda="clientes_compraron" valor={fmtInt(r.clientes)}
          sub={<>{d.n_clientes_nuevos} nuevos · {d.n_clientes_perdidos} perdidos</>} />
        <Kpi titulo="Ticket promedio" leyenda="ticket_promedio" valor={r.ticket_promedio === null ? '—' : fmtM(r.ticket_promedio)}
          sub={`${fmtInt(r.facturas)} facturas · equipo ${fmtM(e.ticket_promedio)}`} />
        <Kpi titulo="Cartera vencida" leyenda="cartera_vendedor" valor={fmtM(cartera.vencido)}
          tono={cartera.vencido <= 0 ? 'success' : cartera.mas_60 > 0 ? 'danger' : 'warning'}
          sub={`de ${fmtM(cartera.saldo)} por cobrar`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-[#001639] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen'   && <TabResumen d={d} />}
      {tab === 'clientes'  && <TabClientes d={d} />}
      {tab === 'productos' && <TabProductos d={d} />}
      {tab === 'historial' && <TabHistorial vendedor={v.nombre} params={{ desde, hasta, ...prodParams }} />}
      {tab === 'cartera'   && <TabCartera cartera={cartera} />}
    </div>
  )
}

// Señales automáticas a partir de los números de la ficha
function calcularSenales(d) {
  const { resumen: r, equipo: e, cartera } = d
  const s = []
  if (r.variacion_pct !== null) {
    if (r.variacion_pct <= -10) s.push({ tipo: 'alerta', texto: `Vende ${fmtPct(Math.abs(r.variacion_pct))} menos que en el mismo período del año anterior (${fmtM(r.ventas_prev)} → ${fmtM(r.ventas)}).` })
    else if (r.variacion_pct >= 10) s.push({ tipo: 'bien', texto: `Crece ${fmtPct(r.variacion_pct)} contra el mismo período del año anterior.` })
  }
  if (r.margen_pct !== null && e.margen_pct !== null) {
    const dif = r.margen_pct - e.margen_pct
    if (dif <= -5) s.push({ tipo: 'aviso', texto: `Su margen (${fmtPct(r.margen_pct)}) está ${Math.abs(dif).toFixed(1)} pts debajo del promedio del equipo (${fmtPct(e.margen_pct)}).` })
    else if (dif >= 5) s.push({ tipo: 'bien', texto: `Su margen (${fmtPct(r.margen_pct)}) está ${dif.toFixed(1)} pts arriba del promedio del equipo.` })
  }
  if (r.concentracion_top10 !== null && r.concentracion_top10 >= 70 && r.clientes > 10) {
    s.push({ tipo: 'aviso', texto: `Sus 10 clientes más grandes son el ${fmtPct(r.concentracion_top10)} de lo que vende.` })
  }
  if (d.n_clientes_perdidos > 0 && d.venta_perdida > 0) {
    s.push({ tipo: d.venta_perdida > r.ventas_prev * 0.15 ? 'alerta' : 'aviso', texto: `${d.n_clientes_perdidos} clientes que le compraron el año anterior no han comprado este período (le compraron ${fmtM(d.venta_perdida)}).` })
  }
  if (cartera.mas_60 > 0) s.push({ tipo: 'alerta', texto: `Tiene ${fmtM(cartera.mas_60)} de cartera con más de 60 días de vencida.` })
  if (d.vendedor.dias_sin_vender !== null && d.vendedor.dias_sin_vender > 30) s.push({ tipo: 'aviso', texto: `No factura desde hace ${d.vendedor.dias_sin_vender} días.` })
  return s
}

// -------------------------------------------------------------------
// TAB: RESUMEN
// -------------------------------------------------------------------
function TabResumen({ d }) {
  const { desde, hasta } = d.ventana
  const enPeriodo = (p) => p >= desde.slice(0, 7) && p <= hasta.slice(0, 7)
  const maxCat = Math.max(...d.categorias.map(c => c.ventas), 1)
  // Eje de margen en marcas de 25%; baja de 0 solo si algún mes tuvo margen negativo
  const minPct = Math.min(0, ...d.serie.map(m => m.margen_pct ?? 0))
  const ticksPct = []
  for (let t = Math.floor(minPct / 25) * 25; t <= 100; t += 25) ticksPct.push(t)

  return (
    <div className="space-y-6">
      <Seccion icon={ChartBarIcon} titulo="Historial de ventas (24 meses)" leyenda="historial_vendedor"
        extra={
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#001639] rounded-sm" /> En el período</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#94a3b8] rounded-sm" /> Fuera</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-amber-500" /> Margen %</span>
          </div>
        }>
        {d.serie.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin ventas en los últimos 24 meses.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={d.serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="periodo" tickFormatter={fmtPeriod} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis yAxisId="q" tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={60} />
              <YAxis yAxisId="pct" orientation="right" domain={[ticksPct[0], 100]} ticks={ticksPct} allowDataOverflow tickFormatter={(x) => `${x}%`} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={42} />
              <Tooltip
                cursor={{ fill: 'var(--bg-secondary)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload
                  return (
                    <div style={tooltipStyle} className="px-3 py-2 space-y-0.5">
                      <p className="font-semibold">{fmtPeriod(p.periodo)}</p>
                      <p className="tabular-nums">Ventas {fmtQ(p.ventas)}</p>
                      <p className="tabular-nums">Margen {fmtPct(p.margen_pct)}</p>
                      <p className="tabular-nums text-[var(--text-muted)]">{fmtInt(p.facturas)} facturas · {fmtInt(p.clientes)} clientes</p>
                      <p className="tabular-nums text-[var(--text-muted)]">{fmtPct(p.participacion)} de la empresa</p>
                    </div>
                  )
                }}
              />
              <Bar yAxisId="q" dataKey="ventas" radius={[4, 4, 0, 0]}>
                {d.serie.map(m => <Cell key={m.periodo} fill={enPeriodo(m.periodo) ? '#001639' : '#94a3b8'} />)}
              </Bar>
              <Line yAxisId="pct" dataKey="margen_pct" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Seccion>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Seccion icon={ArrowTrendingUpIcon} titulo="¿Por qué cambiaron sus ventas?" leyenda="puente">
          {d.puente && d.puente.anterior > 0 ? (
            <Puente puente={d.puente} />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin ventas en el período anterior para comparar.</p>
          )}
        </Seccion>

        <Seccion icon={CubeIcon} titulo="Ventas por categoría" leyenda="jerarquia_producto">
          {d.categorias.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {d.categorias.map(c => (
                <div key={c.clave}>
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate font-medium">{c.nombre}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="font-semibold">{fmtM(c.ventas)}</span>
                      <span className="text-xs text-[var(--text-muted)] ml-2">{fmtPct(c.participacion)}</span>
                      <span className="text-xs ml-2"><Var pct={c.variacion_pct} nuevo={c.nuevo} /></span>
                      <span className={`text-xs ml-2 ${margenTone(c.margen_pct)}`}>mg {fmtPct(c.margen_pct)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] mt-1">
                    <div className="h-1.5 rounded-full bg-[#001639]" style={{ width: `${(c.ventas / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// TAB: CLIENTES
// -------------------------------------------------------------------
function TabClientes({ d }) {
  const [verPerdidos, setVerPerdidos] = useState(false)
  const lista = verPerdidos ? d.clientes_perdidos : d.clientes

  return (
    <Seccion icon={UserGroupIcon} titulo={verPerdidos ? `Clientes perdidos (${d.n_clientes_perdidos})` : `Clientes del período (${d.clientes.length})`}
      leyenda={verPerdidos ? 'clientes_perdidos' : 'clientes_compraron'} sinPadding
      extra={
        <div className="flex gap-1 text-xs">
          <button onClick={() => setVerPerdidos(false)} className={`px-3 py-1 rounded-md ${!verPerdidos ? 'bg-[var(--bg-tertiary)] font-semibold' : 'text-[var(--text-muted)]'}`}>Activos</button>
          <button onClick={() => setVerPerdidos(true)} className={`px-3 py-1 rounded-md ${verPerdidos ? 'bg-[var(--bg-tertiary)] font-semibold' : 'text-[var(--text-muted)]'}`}>
            Perdidos {d.venta_perdida > 0 && `· ${fmtM(d.venta_perdida)}`}
          </button>
        </div>
      }>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
            <tr className="text-xs text-[var(--text-muted)] uppercase">
              <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Facturas</th>}
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Ventas</th>}
              <th className="px-3 py-2.5 text-right font-semibold">Año ant.</th>
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Var.</th>}
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Margen%</th>}
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">% de sus ventas</th>}
              {!verPerdidos && <th className="px-4 py-2.5 text-right font-semibold">Última compra</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {lista.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin clientes.</td></tr>
            )}
            {lista.map(c => (
              <tr key={c.codigo} className="text-sm hover:bg-[var(--bg-secondary)]">
                <td className="px-4 py-2">
                  <NombreCliente id={c.cliente_id} nombre={c.cliente} codigo={c.codigo} />
                </td>
                {!verPerdidos && <td className="px-3 py-2 text-right tabular-nums">{fmtInt(c.facturas)}</td>}
                {!verPerdidos && <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtM(c.ventas)}</td>}
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">{c.ventas_prev ? fmtM(c.ventas_prev) : '—'}</td>
                {!verPerdidos && <td className="px-3 py-2 text-right"><Var pct={c.variacion_pct} nuevo={c.nuevo} /></td>}
                {!verPerdidos && (
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${margenTone(c.margen_pct)}`}>
                    {fmtPct(c.margen_pct)}
                    <SinCosto pct={c.pct_sin_costo} />
                  </td>
                )}
                {!verPerdidos && <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{fmtPct(c.participacion)}</td>}
                {!verPerdidos && <td className="px-4 py-2 text-right tabular-nums text-[var(--text-secondary)] whitespace-nowrap">{fmtF(c.ultima_venta)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}

// -------------------------------------------------------------------
// TAB: PRODUCTOS
// -------------------------------------------------------------------
function TabProductos({ d }) {
  return (
    <Seccion icon={CubeIcon} titulo={`Top ${d.articulos.length} artículos que vende (de ${fmtInt(d.resumen.skus)})`} leyenda="productos_skus" sinPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
            <tr className="text-xs text-[var(--text-muted)] uppercase">
              <th className="px-4 py-2.5 text-left font-semibold">Artículo</th>
              <th className="px-3 py-2.5 text-left font-semibold">Categoría</th>
              <th className="px-3 py-2.5 text-right font-semibold">Clientes</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unidades <Leyenda k="unidades" /></th>
              <th className="px-3 py-2.5 text-right font-semibold">Precio prom. <Leyenda k="precio_promedio" /></th>
              <th className="px-3 py-2.5 text-right font-semibold">Ventas</th>
              <th className="px-3 py-2.5 text-right font-semibold">Var.</th>
              <th className="px-4 py-2.5 text-right font-semibold">Margen%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {d.articulos.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin ventas en el período.</td></tr>
            )}
            {d.articulos.map(a => (
              <tr key={a.codigo} className="text-sm hover:bg-[var(--bg-secondary)]">
                <td className="px-4 py-2">
                  <p className="font-medium truncate max-w-[300px]">{a.descripcion}</p>
                  <p className="text-xs text-[var(--text-muted)]">{a.codigo}</p>
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{a.categoria || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtInt(a.clientes)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(a.unidades)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{a.precio_promedio === null ? '—' : `Q${fmtNum(a.precio_promedio)}`}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtM(a.ventas)}</td>
                <td className="px-3 py-2 text-right"><Var pct={a.variacion_pct} nuevo={a.nuevo} /></td>
                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${margenTone(a.margen_pct)}`}>
                  {fmtPct(a.margen_pct)}
                  <SinCosto pct={a.pct_sin_costo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}

// -------------------------------------------------------------------
// TAB: HISTORIAL (líneas de factura del vendedor, paginadas)
// -------------------------------------------------------------------
const PAGINA = 100

function TabHistorial({ vendedor, params }) {
  const [busqueda, setBusqueda] = useState('')
  const [exportando, setExportando] = useState(false)
  const filtros = { ...params, vendedor, busqueda }

  const { data, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    ['ventas-vendedor-detalle', JSON.stringify(filtros)],
    ({ pageParam = 0 }) => endpoints.ventas.detalle({ ...filtros, limit: PAGINA, offset: pageParam }),
    {
      keepPreviousData: true,
      getNextPageParam: (ult, paginas) => {
        const cargadas = paginas.reduce((s, p) => s + (p?.data?.filas?.length || 0), 0)
        return cargadas < (ult?.data?.total_filas || 0) ? cargadas : undefined
      },
    }
  )
  const filas = (data?.pages || []).flatMap(p => p?.data?.filas || [])
  const total = data?.pages?.[0]?.data?.total_filas || 0
  const suma = data?.pages?.[0]?.data?.suma_ventas || 0

  const exportar = async () => {
    setExportando(true)
    try {
      const lineas = await traerTodo(endpoints.ventas.detalle, filtros)
      await exportarExcel(`ventas_${vendedor.replace(/\s+/g, '_')}_${params.desde}_${params.hasta}.xlsx`, COLUMNAS_LINEAS, lineas, { hoja: 'Ventas' })
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, artículo, factura o FEL…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input w-full pl-12"
          />
        </div>
        <button onClick={exportar} disabled={exportando || total === 0} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowDownTrayIcon className="w-4 h-4" />
          {exportando ? 'Exportando…' : 'Exportar a Excel'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] flex-wrap gap-2">
          <span className="text-sm text-[var(--text-muted)]">
            {isFetching && !isFetchingNextPage ? 'Actualizando…' : `${fmtInt(filas.length)} de ${fmtInt(total)} líneas`}
          </span>
          <span className="text-sm font-semibold">Total sin IVA: {fmtM(suma)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                <th className="px-3 py-3 text-left font-semibold">Factura</th>
                <th className="px-3 py-3 text-left font-semibold">Cliente</th>
                <th className="px-3 py-3 text-left font-semibold">Artículo</th>
                <th className="px-3 py-3 text-right font-semibold">Unid.</th>
                <th className="px-3 py-3 text-right font-semibold">Sin IVA</th>
                <th className="px-3 py-3 text-right font-semibold">Margen% <Leyenda k="margen_bruto" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{isFetching ? 'Cargando…' : 'Sin líneas que coincidan.'}</td></tr>
              )}
              {filas.map(f => (
                <tr key={f.id} className="hover:bg-[var(--bg-secondary)] transition-colors text-sm">
                  <td className="px-3 py-2 text-[var(--text-secondary)] tabular-nums whitespace-nowrap">{String(f.fecha_emision).slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{f.tipo_doc} {f.fact_num}</p>
                    {f.sucursal && <p className="text-xs text-[var(--text-muted)]">{f.sucursal}</p>}
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">
                    <p className="font-medium truncate">{f.cliente}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.codigo_cliente}</p>
                  </td>
                  <td className="px-3 py-2 max-w-[260px]">
                    <p className="truncate">{f.articulo}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.codigo_articulo}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(f.unidades)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtM(f.total_sin_iva)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${margenTone(f.margen_bruto_pct)}`}>
                    {f.margen_bruto_pct !== null ? `${f.margen_bruto_pct.toFixed(1)}%` : (
                      <span className="text-xs font-normal text-[var(--text-muted)]" title="El ERP no trae costo para esta línea">sin costo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasNextPage && (
          <div className="p-3 border-t border-[var(--border-default)] text-center">
            <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-secondary text-sm">
              {isFetchingNextPage ? 'Cargando…' : `Cargar ${Math.min(PAGINA, total - filas.length)} más`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// TAB: CARTERA
// -------------------------------------------------------------------
function TabCartera({ cartera: c }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi titulo="Saldo por cobrar" leyenda="cartera_vendedor" valor={fmtQ(c.saldo)} sub={`${fmtInt(c.documentos)} documentos · ${fmtInt(c.clientes)} clientes`} />
        <Kpi titulo="Por vencer" valor={fmtQ(c.por_vencer)} />
        <Kpi titulo="Vencido" leyenda="dias_vencido" valor={fmtQ(c.vencido)} tono={c.vencido > 0 ? 'warning' : 'success'}
          sub={c.saldo > 0 ? `${fmtPct(c.vencido / c.saldo * 100, 0)} del saldo` : null} />
        <Kpi titulo="Vencido +60 días" valor={fmtQ(c.mas_60)} tono={c.mas_60 > 0 ? 'danger' : 'success'} />
      </div>

      <Seccion icon={BanknotesIcon} titulo="Clientes con más saldo vencido" sinPadding
        extra={<span className="text-xs text-[var(--text-muted)]">Corte {fmtF(c.corte)}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
                <th className="px-3 py-2.5 text-right font-semibold">Saldo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Vencido</th>
                <th className="px-4 py-2.5 text-right font-semibold">Atraso máx.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {c.top.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin cartera asignada en el último corte.</td></tr>
              )}
              {c.top.map(x => (
                <tr key={x.cliente_id} className="text-sm hover:bg-[var(--bg-secondary)]">
                  <td className="px-4 py-2"><NombreCliente id={x.cliente_id} nombre={x.cliente} codigo={x.codigo} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQ(x.saldo)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${x.vencido > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>{fmtQ(x.vencido)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${x.atraso_max > 60 ? 'text-[var(--danger)] font-semibold' : 'text-[var(--text-secondary)]'}`}>
                    {x.atraso_max === null ? '—' : `${x.atraso_max} d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  )
}

// -------------------------------------------------------------------
// Piezas
// -------------------------------------------------------------------
function NombreCliente({ id, nombre, codigo }) {
  const contenido = (
    <>
      <p className="font-medium truncate max-w-[280px]">{nombre}</p>
      <p className="text-xs text-[var(--text-muted)]">{codigo}</p>
    </>
  )
  if (!id) return contenido
  return (
    <Link to={`/tesoreria/cuentas-por-cobrar/cliente/${id}`} title="Ver ficha del cliente" className="block hover:underline">
      {contenido}
    </Link>
  )
}

function Volver() {
  return (
    <Link
      to="/ventas?tab=vendedores"
      title="Volver a Vendedores"
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

function Seccion({ icon: Icon, titulo, leyenda, extra, children, sinPadding }) {
  return (
    <div className="card overflow-hidden">
      <div className="section-header flex-wrap gap-2">
        {Icon && <Icon className="w-5 h-5 text-[var(--text-muted)]" />}
        <h2 className="font-semibold">{titulo}</h2>
        {leyenda && <Leyenda k={leyenda} />}
        {extra && <div className="ml-auto">{extra}</div>}
      </div>
      <div className={sinPadding ? '' : 'p-5 pt-0'}>{children}</div>
    </div>
  )
}
