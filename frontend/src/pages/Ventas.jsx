import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
  ReceiptPercentIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

const fmtQ    = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtM    = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtNum  = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })
const fmtInt  = (n) => Number(n || 0).toLocaleString('es-GT')
const fmtPct  = (n, d = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`)
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')
const fmtPeriod = (p) => {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${meses[+m - 1]} ${y.slice(2)}`
}

const rangoDesde = (rango) => {
  const hoy = new Date()
  const d = new Date(hoy)
  if (rango === '3m')  d.setMonth(hoy.getMonth() - 2, 1)
  if (rango === '6m')  d.setMonth(hoy.getMonth() - 5, 1)
  if (rango === '12m') d.setMonth(hoy.getMonth() - 11, 1)
  if (rango === '24m') d.setMonth(hoy.getMonth() - 23, 1)
  if (rango === 'ytd') { d.setMonth(0, 1) }
  return d.toISOString().slice(0, 10)
}

const margenTone = (pct) => {
  if (pct === null || pct === undefined) return 'text-[var(--text-muted)]'
  if (pct >= 40) return 'text-[var(--success)]'
  if (pct >= 25) return 'text-[var(--warning)]'
  return 'text-[var(--danger)]'
}

export default function Ventas() {
  const [rango, setRango]           = useState('12m')
  const [busqueda, setBusqueda]     = useState('')
  const [clienteSel, setCliente]    = useState('')
  const [vendedorSel, setVendedor]  = useState('')

  const desde = useMemo(() => rangoDesde(rango), [rango])
  const hasta = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const commonParams = { desde, hasta }

  const { data: rRes, isLoading: loadingR } = useQuery(
    ['ventas-resumen', desde, hasta],
    () => endpoints.ventas.resumen(commonParams),
    { keepPreviousData: true }
  )
  const { data: cRes } = useQuery(
    ['ventas-clientes', desde, hasta],
    () => endpoints.ventas.clientes({ ...commonParams, limit: 12 }),
    { keepPreviousData: true }
  )
  const { data: vRes } = useQuery(
    ['ventas-vendedores', desde, hasta],
    () => endpoints.ventas.vendedores(commonParams),
    { keepPreviousData: true }
  )
  const { data: aRes } = useQuery(
    ['ventas-articulos', desde, hasta],
    () => endpoints.ventas.articulos({ ...commonParams, limit: 12 }),
    { keepPreviousData: true }
  )
  const { data: dRes, isFetching: fetchingDetalle } = useQuery(
    ['ventas-detalle', desde, hasta, busqueda, clienteSel, vendedorSel],
    () => endpoints.ventas.detalle({
      ...commonParams, busqueda, codigo_cliente: clienteSel, vendedor: vendedorSel,
      limit: 300, offset: 0,
    }),
    { keepPreviousData: true }
  )

  const r         = rRes?.data || {}
  const serie     = r.serie_mensual || []
  const clientes  = cRes?.data?.clientes || []
  const vendedores = vRes?.data?.vendedores || []
  const articulos = aRes?.data?.articulos || []
  const filas     = dRes?.data?.filas || []
  const totalFilas   = dRes?.data?.total_filas || 0
  const sumaFiltrada = dRes?.data?.suma_ventas || 0

  const tendencia = useMemo(() => {
    if (serie.length < 2) return null
    const ult = serie[serie.length - 1].ventas
    const prev = serie.slice(0, -1)
    const avg = prev.reduce((s, x) => s + (x.ventas || 0), 0) / prev.length
    if (avg === 0) return null
    return ((ult - avg) / avg) * 100
  }, [serie])

  const clienteTop = clientes[0]
  const alertaConcentracionCliente = clienteTop && clienteTop.porcentaje >= 15

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Ventas</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {loadingR ? 'Cargando…' :
                  `${fmtInt(r.facturas)} facturas · ${fmtInt(r.clientes)} clientes · ${fmtInt(r.vendedores)} vendedores activos`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={rango} onChange={(e) => setRango(e.target.value)} className="input">
            <option value="3m">Últimos 3 meses</option>
            <option value="6m">Últimos 6 meses</option>
            <option value="12m">Últimos 12 meses</option>
            <option value="24m">Últimos 24 meses</option>
            <option value="ytd">Año en curso</option>
          </select>
          <button className="btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <span className="kpi-label">Ventas (sin IVA)</span>
          <p className="kpi-value">{fmtM(r.ventas_sin_iva)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Con IVA: {fmtM(r.ventas_con_iva)}
          </p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label">Margen bruto</span>
          <p className={`kpi-value ${margenTone(r.margen_bruto_pct)}`}>{fmtM(r.margen_bruto)}</p>
          <p className={`text-xs mt-1 ${margenTone(r.margen_bruto_pct)}`}>
            {fmtPct(r.margen_bruto_pct)} · costo {fmtM(r.costo_total)}
          </p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label">Ticket promedio</span>
          <p className="kpi-value">{fmtM(r.ticket_promedio)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {fmtInt(r.lineas)} líneas facturadas
          </p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label">Tendencia mes actual</span>
          {tendencia === null ? (
            <p className="kpi-value text-[var(--text-muted)]">—</p>
          ) : (
            <p className={`kpi-value ${tendencia >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {tendencia >= 0 ? '+' : ''}{tendencia.toFixed(1)}%
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
            {tendencia === null ? 'sin base comparable' : (
              <>
                {tendencia >= 0
                  ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
                  : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                vs promedio de meses previos
              </>
            )}
          </p>
        </div>
      </div>

      {/* Alerta concentración */}
      {alertaConcentracionCliente && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg,#fff7ed)] p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--warning)]">Concentración de cliente</p>
            <p className="text-[var(--text-secondary)]">
              <strong>{clienteTop.cliente}</strong> representa el <strong>{clienteTop.porcentaje}%</strong> de las ventas del período ({fmtM(clienteTop.ventas)}).
              Un problema con este cliente afecta un porcentaje material de la facturación.
            </p>
          </div>
        </div>
      )}

      {/* Serie mensual: ventas + margen */}
      <div className="card">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Ventas y margen mensual</h2>
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#001639] rounded-sm" /> Ventas</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-500 rounded-sm" /> Margen bruto</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-amber-500" /> Margen %</span>
          </div>
        </div>
        <div className="p-5 pt-0">
          {serie.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="periodo" tickFormatter={fmtPeriod} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis
                  yAxisId="q"
                  tickFormatter={(v) => `Q${(v / 1e6).toFixed(1)}M`}
                  tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={70}
                />
                <YAxis
                  yAxisId="pct" orientation="right" domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={45}
                />
                <Tooltip
                  formatter={(v, k) => k === 'margen_pct' ? `${Number(v).toFixed(1)}%` : fmtQ(v)}
                  labelFormatter={fmtPeriod}
                  contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8 }}
                />
                <Bar   yAxisId="q"   dataKey="ventas"     fill="#001639"   radius={[6, 6, 0, 0]} />
                <Bar   yAxisId="q"   dataKey="margen"     fill="#10b981"   radius={[6, 6, 0, 0]} />
                <Line  yAxisId="pct" dataKey="margen_pct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Margen %" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top clientes + Top vendedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="section-header">
            <UserGroupIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Top clientes por facturación</h2>
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left  font-semibold pb-2">Cliente</th>
                  <th className="text-right font-semibold pb-2">Ventas</th>
                  <th className="text-right font-semibold pb-2">Margen</th>
                  <th className="text-right font-semibold pb-2">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {clientes.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-sm text-[var(--text-muted)]">Sin datos.</td></tr>
                )}
                {clientes.map((c) => (
                  <tr key={c.codigo}
                      className={`text-sm hover:bg-[var(--bg-secondary)] cursor-pointer ${clienteSel === c.codigo ? 'bg-[var(--bg-secondary)]' : ''}`}
                      onClick={() => setCliente(c.codigo === clienteSel ? '' : c.codigo)}>
                    <td className="py-2 pr-2">
                      <p className="font-medium truncate max-w-[240px]">{c.cliente}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {c.codigo}{c.forma_pago ? ` · ${c.forma_pago}` : ''}
                      </p>
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtM(c.ventas)}</td>
                    <td className={`py-2 text-right tabular-nums ${margenTone(c.margen_pct)}`}>
                      {c.margen_pct !== null ? `${c.margen_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${
                      c.porcentaje >= 15 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                    }`}>{c.porcentaje}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <UsersIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Ranking de vendedores</h2>
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left  font-semibold pb-2">Vendedor</th>
                  <th className="text-right font-semibold pb-2">Clientes</th>
                  <th className="text-right font-semibold pb-2">Ventas</th>
                  <th className="text-right font-semibold pb-2">Margen%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {vendedores.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-sm text-[var(--text-muted)]">Sin datos.</td></tr>
                )}
                {vendedores.slice(0, 10).map((v) => (
                  <tr key={v.vendedor}
                      className={`text-sm hover:bg-[var(--bg-secondary)] cursor-pointer ${vendedorSel === v.vendedor ? 'bg-[var(--bg-secondary)]' : ''}`}
                      onClick={() => setVendedor(v.vendedor === vendedorSel ? '' : v.vendedor)}>
                    <td className="py-2 pr-2">
                      <p className="font-medium truncate max-w-[200px]">{v.vendedor}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {v.codigo || '—'} · {v.porcentaje}% del total
                      </p>
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmtInt(v.clientes)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtM(v.ventas)}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${margenTone(v.margen_pct)}`}>
                      {v.margen_pct !== null ? `${v.margen_pct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(clienteSel || vendedorSel) && (
              <button
                onClick={() => { setCliente(''); setVendedor('') }}
                className="mt-3 text-xs text-[var(--accent-blue)] hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top artículos */}
      <div className="card">
        <div className="section-header">
          <CubeIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Top artículos por facturación</h2>
        </div>
        <div className="p-5 pt-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left  font-semibold pb-2">Artículo</th>
                <th className="text-left  font-semibold pb-2">Línea</th>
                <th className="text-right font-semibold pb-2">Clientes</th>
                <th className="text-right font-semibold pb-2">Unidades</th>
                <th className="text-right font-semibold pb-2">Ventas</th>
                <th className="text-right font-semibold pb-2">Margen</th>
                <th className="text-right font-semibold pb-2">Margen%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {articulos.length === 0 && (
                <tr><td colSpan={7} className="py-3 text-sm text-[var(--text-muted)]">Cargando…</td></tr>
              )}
              {articulos.map((a) => (
                <tr key={a.codigo} className="text-sm hover:bg-[var(--bg-secondary)]">
                  <td className="py-2 pr-3">
                    <p className="font-medium truncate max-w-[260px]">{a.descripcion}</p>
                    <p className="text-xs text-[var(--text-muted)]">{a.codigo}</p>
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-secondary)]">
                    <p>{a.linea}</p>
                    {a.sublinea && <p className="text-xs text-[var(--text-muted)]">{a.sublinea}</p>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtInt(a.clientes)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtNum(a.unidades)}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{fmtM(a.ventas)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtM(a.margen)}</td>
                  <td className={`py-2 text-right tabular-nums font-semibold ${margenTone(a.margen_pct)}`}>
                    {a.margen_pct !== null ? `${a.margen_pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtros y detalle */}
      <div className="flex flex-col sm:flex-row gap-4">
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
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ReceiptPercentIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {fetchingDetalle ? 'Actualizando…' : `${fmtInt(filas.length)} de ${fmtInt(totalFilas)} líneas`}
              {clienteSel && <span className="ml-2 badge-warning">{clienteSel}</span>}
              {vendedorSel && <span className="ml-2 badge-warning">{vendedorSel}</span>}
            </span>
          </div>
          <span className="text-sm font-semibold">Total filtrado sin IVA: {fmtM(sumaFiltrada)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Fecha</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Factura</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Cliente</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Vendedor</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Artículo</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Unid.</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Sin IVA</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Margen</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Margen%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    {fetchingDetalle ? 'Cargando…' : 'Sin líneas que coincidan con el filtro.'}
                  </td>
                </tr>
              )}
              {filas.map(f => (
                <tr key={f.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-3 py-2 text-sm text-[var(--text-secondary)] tabular-nums whitespace-nowrap">{fmtDate(f.fecha_emision)}</td>
                  <td className="px-3 py-2 text-sm">
                    <p className="font-medium">{f.tipo_doc} {f.fact_num}</p>
                    {f.fel && <p className="text-xs text-[var(--text-muted)] truncate max-w-[120px]">FEL {f.fel}</p>}
                  </td>
                  <td className="px-3 py-2 text-sm max-w-[220px]">
                    <p className="font-medium truncate">{f.cliente}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.codigo_cliente}</p>
                  </td>
                  <td className="px-3 py-2 text-sm max-w-[160px]">
                    <p className="truncate text-[var(--text-secondary)]">{f.vendedor || '—'}</p>
                  </td>
                  <td className="px-3 py-2 text-sm max-w-[240px]">
                    <p className="truncate">{f.articulo}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.codigo_articulo}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">{fmtNum(f.unidades)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold">{fmtM(f.total_sin_iva)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">{fmtM(f.margen_bruto)}</td>
                  <td className={`px-3 py-2 text-right text-sm tabular-nums font-semibold ${margenTone(f.margen_bruto_pct)}`}>
                    {f.margen_bruto_pct !== null ? `${f.margen_bruto_pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] italic">
        Fuente: <code>vstFacturas_Devoluciones</code> del ERP. Margen bruto por línea =
        <em> total_sin_iva − (unidades × costo_promedio_facturado)</em>. Sincronización diaria via n8n.
      </p>
    </div>
  )
}
