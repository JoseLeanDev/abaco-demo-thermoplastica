import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
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
