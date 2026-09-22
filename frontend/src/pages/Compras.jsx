import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import PageInsights from "../components/agents/PageInsights"
import {
  ShoppingCartIcon,
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
  ReceiptPercentIcon,
  BoltIcon,
  ClockIcon,
  ArrowUpRightIcon,
  ClipboardDocumentCheckIcon,
  FireIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const fmtQ = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtQfull = (n) => `Q${(Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })}`
const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT')
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

export default function Compras() {
  const [rango, setRango]                 = useState('12m')
  const [incluirGastos, setIncluirGastos] = useState(false)
  const [busqueda, setBusqueda]           = useState('')
  const [proveedorSel, setProveedorSel]   = useState('')
  const [categoriaSel, setCategoriaSel]   = useState('')

  const desde = useMemo(() => rangoDesde(rango), [rango])
  const hasta = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const commonParams = { desde, hasta, incluir_gastos: incluirGastos }

  const { data: resumenRes, isLoading: loadingResumen } = useQuery(
    ['compras-resumen', desde, hasta, incluirGastos],
    () => endpoints.compras.resumen(commonParams),
    { keepPreviousData: true }
  )
  const { data: catRes } = useQuery(
    ['compras-categorias', desde, hasta, incluirGastos],
    () => endpoints.compras.categorias({ ...commonParams, limit: 10 }),
    { keepPreviousData: true }
  )
  const { data: provRes } = useQuery(
    ['compras-proveedores', desde, hasta, incluirGastos],
    () => endpoints.compras.proveedores({ ...commonParams, limit: 10 }),
    { keepPreviousData: true }
  )
  const { data: detalleRes, isFetching: fetchingDetalle } = useQuery(
    ['compras-detalle', desde, hasta, incluirGastos, busqueda, proveedorSel, categoriaSel],
    () => endpoints.compras.detalle({
      ...commonParams, busqueda, codigo_proveedor: proveedorSel, categoria: categoriaSel,
      limit: 300, offset: 0,
    }),
    { keepPreviousData: true }
  )

  // Recomendaciones de reposición
  const [recoParams, setRecoParams] = useState({ horizonte_meses: 3, meses_consumo: 6, lead_time: 45 })
  const { data: recoRes, isLoading: loadingReco } = useQuery(
    ['compras-recomendaciones', recoParams.horizonte_meses, recoParams.meses_consumo, recoParams.lead_time],
    () => endpoints.compras.recomendaciones(recoParams),
    { keepPreviousData: true, staleTime: 60_000 }
  )
  const reco = recoRes?.data || {}

  const resumen = resumenRes?.data || {}
  const serie   = resumen.serie_mensual || []
  const cats    = catRes?.data?.categorias || []
  const provs   = provRes?.data?.proveedores || []
  const filas   = detalleRes?.data?.filas || []
  const totalFilas   = detalleRes?.data?.total_filas || 0
  const sumaFiltrada = detalleRes?.data?.suma_sin_iva_filtrada || 0

  // Tendencia mes actual vs promedio de meses previos
  const tendenciaMensual = useMemo(() => {
    if (serie.length < 2) return null
    const ult = serie[serie.length - 1].gasto_sin_iva
    const prev = serie.slice(0, -1)
    const avgPrev = prev.reduce((a, b) => a + (b.gasto_sin_iva || 0), 0) / prev.length
    if (avgPrev === 0) return null
    return ((ult - avgPrev) / avgPrev) * 100
  }, [serie])

  const alertaConcentracion = provs.length > 0 && provs[0].porcentaje >= 25

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <ShoppingCartIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Compras</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {loadingResumen
                  ? 'Cargando…'
                  : `${fmtNum(resumen.facturas)} facturas · ${fmtNum(resumen.proveedores)} proveedores · ${fmtNum(resumen.lineas)} líneas`}
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
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer select-none px-3 py-2 rounded-lg bg-[var(--bg-secondary)]">
            <input
              type="checkbox"
              checked={incluirGastos}
              onChange={(e) => setIncluirGastos(e.target.checked)}
              className="accent-[#001639]"
            />
            Incluir gastos operativos
          </label>
          <button className="btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <span className="kpi-label">Gasto en compras (sin IVA)</span>
          <p className="kpi-value">{fmtQ(resumen.gasto_sin_iva)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Con IVA: {fmtQ(resumen.gasto_con_iva)}
          </p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">IVA acreditable</span>
          <p className="kpi-value">{fmtQ(resumen.iva_acreditable)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {resumen.gasto_sin_iva > 0
              ? `${((resumen.iva_acreditable / resumen.gasto_sin_iva) * 100).toFixed(1)}% de la base`
              : '—'}
          </p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">Devoluciones</span>
          <p className="kpi-value">{fmtQ(resumen.devoluciones_sin_iva)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Gasto neto: {fmtQ(resumen.gasto_neto_sin_iva)}
          </p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label">Tendencia mes actual</span>
          {tendenciaMensual === null ? (
            <p className="kpi-value text-[var(--text-muted)]">—</p>
          ) : (
            <p className={`kpi-value ${tendenciaMensual >= 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
              {tendenciaMensual >= 0 ? '+' : ''}{tendenciaMensual.toFixed(1)}%
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
            {tendenciaMensual === null ? 'sin base comparable' : (
              <>
                {tendenciaMensual >= 0
                  ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
                  : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                vs promedio de meses previos
              </>
            )}
          </p>
        </div>
      </div>

      {/* Insights del analista diario (vertical compras) */}
      <PageInsights vertical="compras" maxInsights={4} />

      {/* Alerta concentración */}
      {alertaConcentracion && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg,#fff7ed)] p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--warning)]">Alta concentración con un proveedor</p>
            <p className="text-[var(--text-secondary)]">
              <strong>{provs[0].proveedor}</strong> representa el <strong>{provs[0].porcentaje}%</strong> del gasto del período.
              Un problema en ese proveedor te expone. Considerá segundas fuentes.
            </p>
          </div>
        </div>
      )}

      {/* ========== RECOMENDACIONES DE REPOSICIÓN ========== */}
      <RecomendacionesSection reco={reco} loading={loadingReco} params={recoParams} setParams={setRecoParams} />

      {/* Gráfico mensual */}
      <div className="card">
        <div className="section-header">
          <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Gasto mensual en compras</h2>
        </div>
        <div className="p-5 pt-0">
          {serie.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">Sin datos en el rango.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="periodo" tickFormatter={fmtPeriod} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tickFormatter={(v) => `Q${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={60} />
                <Tooltip
                  formatter={(v) => fmtQ(v)}
                  labelFormatter={fmtPeriod}
                  contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8 }}
                />
                <Bar dataKey="gasto_sin_iva" fill="#001639" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top categorías + Top proveedores side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Categorías */}
        <div className="card">
          <div className="section-header">
            <Squares2X2Icon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Top categorías por gasto</h2>
          </div>
          <div className="p-5 pt-0 space-y-3">
            {cats.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin datos.</p>}
            {cats.map((c, i) => (
              <button
                key={`${c.categoria}-${c.linea}`}
                onClick={() => setCategoriaSel(c.categoria === categoriaSel ? '' : c.categoria)}
                className="w-full text-left space-y-1.5 hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-muted)] tabular-nums w-6">#{i + 1}</span>
                    <span className="text-sm truncate">
                      {c.categoria} <span className="text-[var(--text-muted)]">· {c.linea}</span>
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                    {fmtQ(c.gasto_sin_iva)} <span className="text-xs text-[var(--text-muted)]">({c.porcentaje}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      categoriaSel === c.categoria ? 'bg-[#001639]' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(c.porcentaje, 1)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Proveedores */}
        <div className="card">
          <div className="section-header">
            <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Top proveedores</h2>
          </div>
          <div className="p-5 pt-0">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left  font-semibold pb-2">Proveedor</th>
                  <th className="text-right font-semibold pb-2">Facturas</th>
                  <th className="text-right font-semibold pb-2">Gasto</th>
                  <th className="text-right font-semibold pb-2">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {provs.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-sm text-[var(--text-muted)]">Sin datos.</td></tr>
                )}
                {provs.map((p) => (
                  <tr
                    key={p.codigo}
                    className={`text-sm hover:bg-[var(--bg-secondary)] cursor-pointer ${proveedorSel === p.codigo ? 'bg-[var(--bg-secondary)]' : ''}`}
                    onClick={() => setProveedorSel(p.codigo === proveedorSel ? '' : p.codigo)}
                  >
                    <td className="py-2 pr-2">
                      <p className="font-medium truncate max-w-[220px]">{p.proveedor}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.codigo}{p.rif ? ` · ${p.rif}` : ''}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmtNum(p.facturas)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtQ(p.gasto_sin_iva)}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${
                      p.porcentaje >= 25 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                    }`}>
                      {p.porcentaje}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(proveedorSel || categoriaSel) && (
              <button
                onClick={() => { setProveedorSel(''); setCategoriaSel('') }}
                className="mt-3 text-xs text-[var(--accent-blue)] hover:underline"
              >
                Limpiar filtros seleccionados
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros y detalle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, artículo o número de factura…"
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
              {fetchingDetalle ? 'Actualizando…' : `${fmtNum(filas.length)} de ${fmtNum(totalFilas)} líneas`}
              {(proveedorSel || categoriaSel) && (
                <>
                  {' · filtro: '}
                  {proveedorSel && <span className="badge-warning ml-1">{proveedorSel}</span>}
                  {categoriaSel && <span className="badge-warning ml-1">{categoriaSel}</span>}
                </>
              )}
            </span>
          </div>
          <span className="text-sm font-semibold">
            Total filtrado sin IVA: {fmtQfull(sumaFiltrada)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Fecha</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Doc</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Proveedor</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Artículo</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Categoría</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Unid.</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Sin IVA</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">IVA</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Con IVA</th>
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
              {filas.map(r => (
                <tr key={r.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-3 py-2 text-sm text-[var(--text-secondary)] tabular-nums whitespace-nowrap">{fmtDate(r.fecha_emision)}</td>
                  <td className="px-3 py-2 text-sm">
                    <p className="font-medium">{r.tipo_doc} {r.fact_num}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.sucursal}</p>
                  </td>
                  <td className="px-3 py-2 text-sm max-w-[200px]">
                    <p className="font-medium truncate">{r.proveedor}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.codigo_proveedor}</p>
                  </td>
                  <td className="px-3 py-2 text-sm max-w-[220px]">
                    <p className="truncate flex items-center gap-1">
                      <CubeIcon className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                      <span className="truncate">{r.articulo || r.codigo_articulo}</span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{r.codigo_articulo}</p>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <p className="text-[var(--text-secondary)]">{r.categoria}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.linea}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">{fmtNum(r.unidades)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold">{fmtQ(r.total_sin_iva)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-[var(--text-muted)]">{fmtQ(r.iva)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold">{fmtQ(r.total_con_iva)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota metodológica */}
      <p className="text-xs text-[var(--text-muted)] italic">
        Datos del ERP (vista <code>vstCompras</code>) sincronizados diariamente.
        {' '}Toggle <em>Incluir gastos operativos</em> {incluirGastos ? 'activo' : 'desactivado'}
        {' '}(categoría <em>Gastos de Operación</em> {incluirGastos ? 'incluida' : 'excluida'} de los totales).
      </p>
    </div>
  )
}

// =========================================================================
// RECOMENDACIONES DE REPOSICIÓN
// =========================================================================
const PRIORIDAD = {
  urgente: { label: 'Urgente', bg: 'bg-rose-500/10',   text: 'text-rose-600',   ring: 'ring-rose-500/40',   dot: 'bg-rose-500'  },
  alta:    { label: 'Alta',    bg: 'bg-amber-500/10',  text: 'text-amber-600',  ring: 'ring-amber-500/40',  dot: 'bg-amber-500' },
  media:   { label: 'Media',   bg: 'bg-sky-500/10',    text: 'text-sky-600',    ring: 'ring-sky-500/40',    dot: 'bg-sky-500'   },
  ok:      { label: 'OK',      bg: 'bg-emerald-500/10',text: 'text-emerald-600',ring: 'ring-emerald-500/40',dot: 'bg-emerald-500'},
}

function RecomendacionesSection({ reco, loading, params, setParams }) {
  const [tab, setTab] = useState('urgentes') // 'urgentes' | 'lineas' | 'todos'
  const [filtroLinea, setFiltroLinea] = useState('')
  const kpis = reco?.kpis || {}
  const lineas = reco?.lineas || []
  const urgentes = reco?.urgentes || []

  const urgentesFiltrados = filtroLinea
    ? urgentes.filter(u => u.linea === filtroLinea)
    : urgentes

  if (loading && !reco?.kpis) {
    return (
      <div className="card p-8">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-[var(--bg-secondary)] rounded w-1/3" />
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded" />)}
          </div>
          <div className="h-64 bg-[var(--bg-secondary)] rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Header con gradient */}
      <div className="bg-gradient-to-r from-[#001639] via-[#001a45] to-[#003a7a] p-5 text-white">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg font-bold">Recomendación de reposición</h2>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Basado en consumo de {params.meses_consumo}m · lead time {params.lead_time}d · horizonte {params.horizonte_meses}m · safety stock 30%
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5">
              <span className="text-white/60">Horizonte</span>
              <select
                value={params.horizonte_meses}
                onChange={(e) => setParams(p => ({ ...p, horizonte_meses: +e.target.value }))}
                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
              >
                <option value={1}>1 mes</option>
                <option value={2}>2 meses</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-white/60">Lead</span>
              <select
                value={params.lead_time}
                onChange={(e) => setParams(p => ({ ...p, lead_time: +e.target.value }))}
                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
              >
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
                <option value={45}>45 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
              </select>
            </label>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <RecoKpi
            label="SKUs urgentes"
            value={kpis.skus_urgentes ?? 0}
            sublabel={`de ${kpis.skus_activos || 0} activos`}
            icon={FireIcon}
            tone="rose"
          />
          <RecoKpi
            label="Alta prioridad"
            value={kpis.skus_alta ?? 0}
            sublabel="< 1.5x lead time"
            icon={ExclamationTriangleIcon}
            tone="amber"
          />
          <RecoKpi
            label="Valor sugerido"
            value={fmtQm(kpis.valor_sugerido_total)}
            sublabel={`Cobertura prom ${kpis.cobertura_promedio_dias || 0}d`}
            icon={BoltIcon}
            tone="emerald"
            isValue
          />
          <RecoKpi
            label="Inventario actual"
            value={fmtQm(kpis.valor_inventario_total)}
            sublabel={`${kpis.skus_ok || 0} SKUs OK · ${kpis.skus_media || 0} media`}
            icon={CubeIcon}
            tone="sky"
            isValue
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border-default)] flex items-center gap-1 px-4 bg-[var(--bg-secondary)]">
        <TabBtn active={tab === 'urgentes'} onClick={() => setTab('urgentes')} icon={FireIcon} count={kpis.skus_urgentes + kpis.skus_alta}>
          Acción inmediata
        </TabBtn>
        <TabBtn active={tab === 'lineas'} onClick={() => setTab('lineas')} icon={Squares2X2Icon} count={lineas.length}>
          Por línea
        </TabBtn>
      </div>

      {/* Contenido de tab */}
      {tab === 'lineas' && (
        <div className="p-5 space-y-3">
          {lineas.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">Sin líneas con consumo en el período.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {lineas.map(l => (
                <LineaCard
                  key={l.linea}
                  linea={l}
                  onFocus={() => { setFiltroLinea(l.linea); setTab('urgentes') }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'urgentes' && (
        <div className="p-5">
          {/* filtro por línea si aplica */}
          {filtroLinea && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)]">Línea:</span>
              <span className="badge-warning">{filtroLinea}</span>
              <button
                onClick={() => setFiltroLinea('')}
                className="text-[var(--accent-blue)] hover:underline"
              >
                limpiar
              </button>
            </div>
          )}
          {urgentesFiltrados.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">Nada urgente en el filtro actual.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-default)]">
                    <th className="text-left  font-semibold py-2">Prioridad</th>
                    <th className="text-left  font-semibold py-2">Artículo</th>
                    <th className="text-left  font-semibold py-2">Línea</th>
                    <th className="text-right font-semibold py-2">Stock</th>
                    <th className="text-right font-semibold py-2">Cobertura</th>
                    <th className="text-right font-semibold py-2">Consumo/mes</th>
                    <th className="text-right font-semibold py-2">Sugerido (uds)</th>
                    <th className="text-right font-semibold py-2">Valor sugerido</th>
                    <th className="text-left  font-semibold py-2 pl-3">Proveedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {urgentesFiltrados.map((u, i) => (
                    <SkuUrgenteRow key={u.codigo + i} item={u} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon: Icon, count, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[#001639] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
      {count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
          active ? 'bg-[#001639] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

function RecoKpi({ label, value, sublabel, icon: Icon, tone, isValue }) {
  const toneCls = tone === 'rose'    ? 'text-rose-300'
                : tone === 'amber'   ? 'text-amber-300'
                : tone === 'emerald' ? 'text-emerald-300'
                : tone === 'sky'     ? 'text-sky-300'
                :                       'text-white'
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">{label}</span>
        <Icon className={`w-4 h-4 ${toneCls}`} />
      </div>
      <p className={`text-2xl font-bold tabular-nums leading-tight ${toneCls}`}>{isValue ? value : Number(value).toLocaleString('es-GT')}</p>
      <p className="text-[10px] text-white/50 mt-1">{sublabel}</p>
    </div>
  )
}

function LineaCard({ linea, onFocus }) {
  const total = linea.skus || 1
  const pctUrgente = (linea.skus_urgentes / total) * 100
  const pctAlta    = (linea.skus_alta    / total) * 100
  const pctMedia   = (linea.skus_media   / total) * 100
  const pctOk      = (linea.skus_ok      / total) * 100
  const priorityCls = linea.skus_urgentes > 0
    ? 'border-rose-500/40 bg-gradient-to-br from-rose-500/5 to-transparent'
    : linea.skus_alta > 0
      ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent'
      : 'border-[var(--border-default)]'

  return (
    <button
      onClick={onFocus}
      className={`text-left rounded-lg border ${priorityCls} p-4 hover:shadow-md transition-all bg-[var(--bg-primary)] card-hover`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{linea.linea}</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{linea.proveedor_top || 'Sin proveedor principal'}</p>
        </div>
        {linea.skus_urgentes > 0 && (
          <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded ring-1 ring-rose-500/30">
            {linea.skus_urgentes} urg
          </span>
        )}
      </div>

      {/* Stack bar por prioridad */}
      <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex mb-2">
        {pctUrgente > 0 && <div className="bg-rose-500 h-full" style={{ width: `${pctUrgente}%` }} />}
        {pctAlta    > 0 && <div className="bg-amber-500 h-full" style={{ width: `${pctAlta}%` }} />}
        {pctMedia   > 0 && <div className="bg-sky-500 h-full" style={{ width: `${pctMedia}%` }} />}
        {pctOk      > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${pctOk}%` }} />}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <p className="text-[var(--text-muted)]">SKUs</p>
          <p className="font-semibold tabular-nums">{linea.skus}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Cobertura</p>
          <p className={`font-semibold tabular-nums ${linea.cobertura_dias < 30 ? 'text-rose-500' : linea.cobertura_dias < 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {linea.cobertura_dias !== null ? `${linea.cobertura_dias}d` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Inventario</p>
          <p className="font-semibold tabular-nums">{fmtQm(linea.valor_inventario)}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Sugerido</p>
          <p className="font-bold tabular-nums text-[var(--accent-blue)]">{fmtQm(linea.valor_sugerido_total)}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border-default)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>Ver detalle</span>
        <ArrowUpRightIcon className="w-3 h-3" />
      </div>
    </button>
  )
}

function SkuUrgenteRow({ item }) {
  const p = PRIORIDAD[item.prioridad] || PRIORIDAD.media
  const stockCritico = item.dias_cobertura !== null && item.dias_cobertura < item.lead_time_dias
  return (
    <tr className="text-xs hover:bg-[var(--bg-secondary)]">
      <td className="py-2 pr-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.bg} ${p.text} ring-1 ${p.ring}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </span>
      </td>
      <td className="py-2 pr-3 max-w-[280px]">
        <p className="font-semibold truncate text-[var(--text-primary)]">{item.descripcion}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{item.codigo}</p>
      </td>
      <td className="py-2 pr-2 text-[var(--text-secondary)]">
        <p className="truncate max-w-[110px]">{item.linea}</p>
      </td>
      <td className="py-2 text-right tabular-nums">
        <p className={`font-semibold ${stockCritico ? 'text-rose-500' : ''}`}>{fmtNum(Math.round(item.stock_actual))}</p>
        {item.stock_transito > 0 && (
          <p className="text-[10px] text-[var(--text-muted)]">+{fmtNum(Math.round(item.stock_transito))} tránsito</p>
        )}
      </td>
      <td className="py-2 text-right tabular-nums">
        {item.dias_cobertura === null ? (
          <span className="text-rose-500 font-bold">0d</span>
        ) : (
          <span className={`font-bold ${item.dias_cobertura < item.lead_time_dias ? 'text-rose-500' : item.dias_cobertura < item.lead_time_dias * 1.5 ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>
            {item.dias_cobertura}d
          </span>
        )}
        <p className="text-[10px] text-[var(--text-muted)]">vs {item.lead_time_dias}d lead</p>
      </td>
      <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
        {fmtNum(Math.round(item.consumo_mensual))}
      </td>
      <td className="py-2 text-right tabular-nums font-semibold">
        {fmtNum(item.cantidad_sugerida)}
      </td>
      <td className="py-2 text-right tabular-nums font-bold text-[var(--accent-blue)]">
        {fmtQm(item.valor_sugerido)}
      </td>
      <td className="py-2 pl-3 max-w-[180px]">
        <p className="truncate text-[var(--text-secondary)]">{item.proveedor_sugerido}</p>
        {item.proveedor_dias_credito !== null && (
          <p className="text-[10px] text-[var(--text-muted)]">crédito {item.proveedor_dias_credito}d</p>
        )}
      </td>
    </tr>
  )
}

// Helper Q compact para recomendaciones
function fmtQm(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return `Q${Math.round(v).toLocaleString('es-GT')}`
}
