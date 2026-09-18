import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import {
  CubeIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  Squares2X2Icon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  TruckIcon,
  ChartBarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

const fmtQ  = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtQfull = (n) => `Q${(Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })}`
const fmtM  = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })
const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT')

export default function Inventario() {
  const [busqueda, setBusqueda] = useState('')
  const [lineaSel, setLinea]    = useState('')
  const [filtro, setFiltro]     = useState('con_stock')

  const { data: resumenRes, isLoading: loadingResumen } = useQuery(
    'inventario-resumen',
    endpoints.inventario.resumen,
  )
  const { data: detalleRes, isFetching: fetchingDetalle } = useQuery(
    ['inventario-detalle', busqueda, lineaSel, filtro],
    () => endpoints.inventario.detalle({ busqueda, linea: lineaSel, filtro, limit: 400 }),
    { keepPreviousData: true }
  )

  const r      = resumenRes?.data || {}
  const kpis   = r.kpis || {}
  const lineas = r.por_linea || []
  const topVal = r.top_valor || []
  const topProv = r.top_proveedores || []
  const filas  = detalleRes?.data?.filas || []
  const totalFilas   = detalleRes?.data?.total_filas || 0
  const sumaFiltrada = detalleRes?.data?.suma_valor || 0

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
              <CubeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Inventario</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {loadingResumen ? 'Cargando…' :
                  `${fmtInt(kpis.total_articulos)} artículos en catálogo · ${fmtInt(kpis.articulos_con_stock)} con stock`}
              </p>
            </div>
          </div>
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Valor total en stock</span>
            <CurrencyDollarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className="kpi-value">{fmtM(kpis.valor_total)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Costo promedio × stock actual
          </p>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Artículos con stock</span>
            <Squares2X2Icon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className="kpi-value">{fmtInt(kpis.articulos_con_stock)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {fmtInt(kpis.articulos_sin_stock)} sin existencia
          </p>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Margen bruto teórico</span>
            <ChartBarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className={`kpi-value ${
            (kpis.margen_bruto_promedio || 0) >= 30 ? 'text-[var(--success)]' :
            (kpis.margen_bruto_promedio || 0) >= 15 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
          }`}>{(kpis.margen_bruto_promedio || 0).toFixed(1)}%</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Promedio · {fmtInt(kpis.articulos_con_margen)} artículos con precio
          </p>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Stock en tránsito</span>
            <TruckIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <p className="kpi-value">{fmtM(kpis.valor_transito)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Ordenado, aún no recibido
          </p>
        </div>
      </div>

      {/* Alerta si hay muchos sin precio */}
      {kpis.total_articulos > 0 && kpis.articulos_con_margen > 0 &&
       (kpis.articulos_con_margen / kpis.total_articulos) < 0.3 && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg,#fff7ed)] p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--warning)]">Baja cobertura de precios de venta</p>
            <p className="text-[var(--text-secondary)]">
              Solo {fmtInt(kpis.articulos_con_margen)} de {fmtInt(kpis.total_articulos)} artículos
              ({((kpis.articulos_con_margen / kpis.total_articulos) * 100).toFixed(0)}%) tienen precio de venta configurado.
              El margen bruto teórico no representa el catálogo completo.
            </p>
          </div>
        </div>
      )}

      {/* Distribución por línea + Top proveedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="section-header">
            <Squares2X2Icon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Valor por línea de producto</h2>
          </div>
          <div className="p-5 pt-0 space-y-3">
            {lineas.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin datos.</p>}
            {lineas.map((c, i) => (
              <button
                key={c.linea}
                onClick={() => setLinea(c.linea === lineaSel ? '' : c.linea)}
                className="w-full text-left space-y-1.5 hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-muted)] tabular-nums w-6">#{i + 1}</span>
                    <span className="text-sm truncate">{c.linea}</span>
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">· {fmtInt(c.articulos)}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                    {fmtM(c.valor)} <span className="text-xs text-[var(--text-muted)]">({c.porcentaje}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      lineaSel === c.linea ? 'bg-[#001639]' : 'bg-teal-500'
                    }`}
                    style={{ width: `${Math.max(c.porcentaje, 1)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Top proveedores por valor en stock</h2>
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left  font-semibold pb-2">Proveedor</th>
                  <th className="text-right font-semibold pb-2">Artículos</th>
                  <th className="text-right font-semibold pb-2">Valor</th>
                  <th className="text-right font-semibold pb-2">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {topProv.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-sm text-[var(--text-muted)]">Sin datos.</td></tr>
                )}
                {topProv.map((p) => (
                  <tr key={p.codigo} className="text-sm hover:bg-[var(--bg-secondary)]">
                    <td className="py-2 pr-2">
                      <p className="font-medium truncate max-w-[220px]">{p.proveedor}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.codigo}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmtInt(p.articulos)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtM(p.valor)}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${
                      p.porcentaje >= 25 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                    }`}>{p.porcentaje}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lineaSel && (
              <button onClick={() => setLinea('')} className="mt-3 text-xs text-[var(--accent-blue)] hover:underline">
                Limpiar filtro de línea: {lineaSel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top artículos por valor */}
      <div className="card">
        <div className="section-header">
          <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Top 10 artículos por valor en inventario</h2>
        </div>
        <div className="p-5 pt-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left  font-semibold py-2">Artículo</th>
                <th className="text-left  font-semibold py-2">Línea</th>
                <th className="text-left  font-semibold py-2">Proveedor</th>
                <th className="text-right font-semibold py-2">Stock</th>
                <th className="text-right font-semibold py-2">Costo prom</th>
                <th className="text-right font-semibold py-2">Precio</th>
                <th className="text-right font-semibold py-2">Margen</th>
                <th className="text-right font-semibold py-2">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {topVal.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-sm text-[var(--text-muted)] text-center">Cargando…</td></tr>
              )}
              {topVal.map((a) => (
                <tr key={a.codigo} className="text-sm hover:bg-[var(--bg-secondary)]">
                  <td className="py-2 pr-3">
                    <p className="font-medium truncate max-w-[260px]">{a.descripcion}</p>
                    <p className="text-xs text-[var(--text-muted)]">{a.codigo}</p>
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-secondary)]">
                    <p>{a.linea}</p>
                    {a.sublinea && <p className="text-xs text-[var(--text-muted)]">{a.sublinea}</p>}
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-secondary)] truncate max-w-[200px]">
                    {a.proveedor || '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtNum(a.stock_actual)}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                    {a.costo_promedio > 0 ? fmtQ(a.costo_promedio) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                    {a.precio_venta_1 > 0 ? fmtQ(a.precio_venta_1) : '—'}
                  </td>
                  <td className={`py-2 text-right tabular-nums font-semibold ${
                    a.margen_bruto_pct >= 30 ? 'text-[var(--success)]' :
                    a.margen_bruto_pct >= 15 ? 'text-[var(--warning)]' :
                    a.margen_bruto_pct > 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
                  }`}>
                    {a.margen_bruto_pct > 0 ? `${a.margen_bruto_pct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums font-bold">{fmtM(a.valor_inventario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, descripción o proveedor…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input w-full pl-12"
          />
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="input min-w-[180px]"
        >
          <option value="todos">Todos los artículos</option>
          <option value="con_stock">Con stock</option>
          <option value="sin_stock">Sin stock</option>
          <option value="sin_precio">Sin precio de venta</option>
          <option value="con_transito">Con stock en tránsito</option>
        </select>
      </div>

      {/* Tabla detalle */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CubeIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {fetchingDetalle ? 'Actualizando…' : `${fmtInt(filas.length)} de ${fmtInt(totalFilas)} artículos`}
              {lineaSel && (
                <>
                  {' · línea: '}<span className="badge-warning ml-1">{lineaSel}</span>
                </>
              )}
            </span>
          </div>
          <span className="text-sm font-semibold">Valor filtrado: {fmtQfull(sumaFiltrada)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Código</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Descripción</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Línea / Sublinea</th>
                <th className="px-3 py-3 text-left  text-xs font-semibold text-[var(--text-muted)] uppercase">Proveedor</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Stock<br /><span className="normal-case font-normal">actual · tránsito</span></th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Costo prom</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Precio 1</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Margen</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    {fetchingDetalle ? 'Cargando…' : 'Sin artículos que coincidan con el filtro.'}
                  </td>
                </tr>
              )}
              {filas.map(a => (
                <tr key={a.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-3 py-2 text-sm font-mono tabular-nums">{a.codigo}</td>
                  <td className="px-3 py-2 text-sm max-w-[240px]">
                    <p className="font-medium truncate">{a.descripcion}</p>
                    {a.marca && <p className="text-xs text-[var(--text-muted)]">{a.marca}</p>}
                  </td>
                  <td className="px-3 py-2 text-sm text-[var(--text-secondary)]">
                    <p>{a.linea}</p>
                    {a.sublinea && <p className="text-xs text-[var(--text-muted)]">{a.sublinea}</p>}
                  </td>
                  <td className="px-3 py-2 text-sm text-[var(--text-secondary)] truncate max-w-[180px]">
                    {a.proveedor || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    <span className={a.stock_actual > 0 ? '' : 'text-[var(--text-muted)]'}>
                      {fmtNum(a.stock_actual)}
                    </span>
                    {a.stock_en_transito > 0 && (
                      <p className="text-xs text-[var(--warning)]">
                        <TruckIcon className="w-3 h-3 inline mr-0.5" />
                        {fmtNum(a.stock_en_transito)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    {a.costo_promedio > 0 ? fmtQ(a.costo_promedio) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    {a.precio_venta_1 > 0 ? fmtQ(a.precio_venta_1) : (
                      <span className="text-xs text-[var(--text-muted)]">sin precio</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right text-sm tabular-nums font-semibold ${
                    a.margen_bruto_pct === null ? 'text-[var(--text-muted)]' :
                    a.margen_bruto_pct >= 30 ? 'text-[var(--success)]' :
                    a.margen_bruto_pct >= 15 ? 'text-[var(--warning)]' :
                    'text-[var(--danger)]'
                  }`}>
                    {a.margen_bruto_pct !== null && a.margen_bruto_pct > 0 ? `${a.margen_bruto_pct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums font-bold">{fmtM(a.valor_inventario)}</td>
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
          <p>
            Fuente: <code>vst_Articulos</code> del ERP.
            Valor de inventario = <em>stock_actual × costo_promedio</em>.
            Margen bruto teórico = <em>(precio_venta_1 − costo_promedio) / precio_venta_1</em>.
            Sincronización diaria. Faltantes por confirmar con el DBA:
            <em> bodega/almacén (asumimos único), stock mínimo/máximo (alertas MRP), fecha último movimiento (obsoletos)</em>.
          </p>
        </div>
      </div>
    </div>
  )
}
