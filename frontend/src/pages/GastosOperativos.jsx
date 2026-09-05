import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import {
  BuildingOffice2Icon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ReceiptPercentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

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

export default function GastosOperativos() {
  const [rango, setRango]                 = useState('12m')
  const [busqueda, setBusqueda]           = useState('')
  const [proveedorSel, setProveedorSel]   = useState('')
  const [centroSel, setCentroSel]         = useState('')

  const desde = useMemo(() => rangoDesde(rango), [rango])
  const hasta = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const commonParams = { desde, hasta }

  const { data: resumenRes, isLoading: loadingResumen } = useQuery(
    ['gastos-resumen', desde, hasta],
    () => endpoints.gastos.resumen(commonParams),
    { keepPreviousData: true }
  )
  const { data: ccRes } = useQuery(
    ['gastos-centros', desde, hasta],
    () => endpoints.gastos.centrosCosto({ ...commonParams, limit: 15 }),
    { keepPreviousData: true }
  )
  const { data: provRes } = useQuery(
    ['gastos-proveedores', desde, hasta],
    () => endpoints.gastos.proveedores({ ...commonParams, limit: 10 }),
    { keepPreviousData: true }
  )
  const { data: detalleRes, isFetching: fetchingDetalle } = useQuery(
    ['gastos-detalle', desde, hasta, busqueda, proveedorSel, centroSel],
    () => endpoints.gastos.detalle({
      ...commonParams, busqueda, codigo_proveedor: proveedorSel, centro_costo: centroSel,
      limit: 300, offset: 0,
    }),
    { keepPreviousData: true }
  )

  const resumen = resumenRes?.data || {}
  const serie   = resumen.serie_mensual || []
  const centros = ccRes?.data?.centros || []
  const provs   = provRes?.data?.proveedores || []
  const filas   = detalleRes?.data?.filas || []
  const totalFilas   = detalleRes?.data?.total_filas || 0
  const sumaFiltrada = detalleRes?.data?.suma_sin_iva_filtrada || 0

  const tendenciaMensual = useMemo(() => {
    if (serie.length < 2) return null
    const ult = serie[serie.length - 1].gasto_sin_iva
    const prev = serie.slice(0, -1)
    const avgPrev = prev.reduce((a, b) => a + (b.gasto_sin_iva || 0), 0) / prev.length
    if (avgPrev === 0) return null
    return ((ult - avgPrev) / avgPrev) * 100
  }, [serie])

  const centroDominante = centros[0]
  const alertaConcentracion = centroDominante && centroDominante.porcentaje >= 40

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
              <BuildingOffice2Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Gastos Operativos</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {loadingResumen
                  ? 'Cargando…'
                  : `${fmtNum(resumen.facturas)} facturas · ${fmtNum(resumen.centros_costo)} centros de costo · ${fmtNum(resumen.proveedores)} proveedores`}
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
          <span className="kpi-label">Gasto operativo (sin IVA)</span>
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
          <span className="kpi-label">Centros de costo activos</span>
          <p className="kpi-value">{fmtNum(resumen.centros_costo)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {fmtNum(resumen.lineas)} líneas registradas
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

      {/* Alerta concentración de centro dominante */}
      {alertaConcentracion && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg,#fff7ed)] p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--warning)]">Alta concentración de gasto en un centro</p>
            <p className="text-[var(--text-secondary)]">
              <strong>{centroDominante.centro_costo}</strong> concentra el <strong>{centroDominante.porcentaje}%</strong> del gasto operativo del período
              ({fmtQ(centroDominante.gasto_sin_iva)}). Revisá si es correcto o si hay imputaciones mal categorizadas.
            </p>
          </div>
        </div>
      )}

      {/* Gráfico mensual */}
      <div className="card">
        <div className="section-header">
          <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Gasto operativo mensual</h2>
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

      {/* Centros de costo + proveedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Centros de costo */}
        <div className="card">
          <div className="section-header">
            <Squares2X2Icon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Gasto por centro de costo</h2>
          </div>
          <div className="p-5 pt-0 space-y-3">
            {centros.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin datos.</p>}
            {centros.map((c, i) => (
              <button
                key={c.centro_costo}
                onClick={() => setCentroSel(c.centro_costo === centroSel ? '' : c.centro_costo)}
                className="w-full text-left space-y-1.5 hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-muted)] tabular-nums w-6">#{i + 1}</span>
                    <span className="text-sm truncate">{c.centro_costo}</span>
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">· {fmtNum(c.facturas)} facturas</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                    {fmtQ(c.gasto_sin_iva)} <span className="text-xs text-[var(--text-muted)]">({c.porcentaje}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      centroSel === c.centro_costo ? 'bg-[#001639]' : 'bg-indigo-500'
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
            <h2 className="font-semibold">Top proveedores de gastos</h2>
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
                    <td className="py-2 text-right tabular-nums font-semibold text-[var(--text-secondary)]">{p.porcentaje}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(proveedorSel || centroSel) && (
              <button
                onClick={() => { setProveedorSel(''); setCentroSel('') }}
                className="mt-3 text-xs text-[var(--accent-blue)] hover:underline"
              >
                Limpiar filtros seleccionados
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros + detalle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, concepto o número de factura…"
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
              {(proveedorSel || centroSel) && (
                <>
                  {' · filtro: '}
                  {proveedorSel && <span className="badge-warning ml-1">{proveedorSel}</span>}
                  {centroSel && <span className="badge-warning ml-1">{centroSel}</span>}
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
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Concepto</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Centro de costo</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Sin IVA</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">IVA</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Con IVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
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
                  <td className="px-3 py-2 text-sm max-w-[220px]">
                    <p className="font-medium truncate">{r.proveedor}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.codigo_proveedor}</p>
                  </td>
                  <td className="px-3 py-2 text-sm max-w-[260px]">
                    <p className="truncate">{r.articulo || r.codigo_articulo}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.codigo_articulo}</p>
                  </td>
                  <td className="px-3 py-2 text-sm text-[var(--text-secondary)]">{r.centro_costo || '—'}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold">{fmtQ(r.total_sin_iva)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-[var(--text-muted)]">{fmtQ(r.iva)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold">{fmtQ(r.total_con_iva)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] italic">
        Fuente: ERP <code>vstCompras</code>, filtrado por <em>Categoría = "Gastos de Operación"</em>.
        {' '}El centro de costo corresponde al campo <em>sublinea</em> del ERP. Sincronización diaria.
      </p>
    </div>
  )
}
