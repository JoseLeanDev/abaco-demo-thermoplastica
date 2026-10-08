import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { endpoints } from '../../services/cfoApi'
import { usePeriodo } from '../../context/PeriodoContext'
import {
  ArrowDownTrayIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ReferenceLine,
} from 'recharts'

// -------------------------------------------------------------------
// Ventas por categoría con drill-down:
//   Categoría (marca ERP) → Subcategoría (línea) → Sublínea → Artículo
// Cada nivel muestra el período vs el período de comparación (mismo rango
// del año anterior) y, para la selección actual, qué clientes y vendedores
// la explican.
// -------------------------------------------------------------------

const NIVELES = [
  { dim: 'categoria',    singular: 'Categoría',    plural: 'Categorías' },
  { dim: 'subcategoria', singular: 'Subcategoría', plural: 'Subcategorías' },
  { dim: 'sublinea',     singular: 'Sublínea',     plural: 'Sublíneas' },
  { dim: 'articulo',     singular: 'Artículo',     plural: 'Artículos' },
]

const COLORS = ['#001639', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#a855f7', '#64748b', '#0ea5e9']
const OTROS_COLOR = '#cbd5e1'

const fmtQ = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 0 })
const fmtPeriod = (p) => {
  if (!p) return ''
  const [y, m] = p.split('-')
  return `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+m - 1]} ${y.slice(2)}`
}
const tooltipStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }

const margenTone = (pct) => {
  if (pct === null || pct === undefined) return 'text-[var(--text-muted)]'
  if (pct >= 40) return 'text-[var(--success)]'
  if (pct >= 25) return 'text-[var(--warning)]'
  return 'text-[var(--danger)]'
}

function Variacion({ pct, nuevo, className = '' }) {
  if (nuevo) return <span className={`text-xs font-semibold text-[var(--success)] ${className}`}>nuevo</span>
  if (pct === null || pct === undefined) return <span className={`text-[var(--text-muted)] ${className}`}>—</span>
  const tone = pct > 0 ? 'text-[var(--success)]' : pct < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
  return <span className={`tabular-nums font-semibold ${tone} ${className}`}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
}

function exportarCSV(nombreArchivo, columnas, filas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [columnas.map(c => esc(c.label)).join(','), ...filas.map(f => columnas.map(c => esc(c.get(f))).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

export default function TabCategorias() {
  const { desde, hasta, etiquetaCorta } = usePeriodo()
  // path = selección acumulada [{ dim, clave, nombre }]
  const [path, setPath] = useState([])
  const [orden, setOrden] = useState({ col: 'ventas', dir: 'desc' })
  const [busqueda, setBusqueda] = useState('')
  const [verPerdidos, setVerPerdidos] = useState(false)

  const nivel = NIVELES[Math.min(path.length, NIVELES.length - 1)]
  const esHoja = path.length >= NIVELES.length - 1
  const filtros = useMemo(() => Object.fromEntries(path.map(p => [p.dim, p.clave])), [path])
  const params = { desde, hasta, ...filtros }
  const qKey = [desde, hasta, JSON.stringify(filtros)]

  const { data: dRes, isLoading } = useQuery(
    ['ventas-desglose', nivel.dim, ...qKey],
    () => endpoints.ventas.desglose({ ...params, dim: nivel.dim, limit: 500 }),
    { keepPreviousData: true }
  )
  const { data: sRes } = useQuery(
    ['ventas-desglose-serie', nivel.dim, ...qKey],
    () => endpoints.ventas.desgloseSerie({ ...params, dim: nivel.dim, top: 6 }),
    { keepPreviousData: true }
  )
  const { data: cRes } = useQuery(
    ['ventas-desglose-clientes', ...qKey],
    () => endpoints.ventas.desglose({ ...params, dim: 'cliente', limit: 10 }),
    { keepPreviousData: true }
  )
  const { data: vRes } = useQuery(
    ['ventas-desglose-vendedores', ...qKey],
    () => endpoints.ventas.desglose({ ...params, dim: 'vendedor', limit: 10 }),
    { keepPreviousData: true }
  )

  const d = dRes?.data || {}
  const items = d.items || []
  const serie = sRes?.data
  const clientes = cRes?.data
  const vendedores = vRes?.data

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const f = q ? items.filter(i => `${i.nombre} ${i.clave}`.toLowerCase().includes(q)) : items
    const { col, dir } = orden
    const val = (i) => (col === 'nombre' ? i.nombre : i[col] ?? -Infinity)
    return [...f].sort((a, b) => {
      const va = val(a), vb = val(b)
      const c = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return dir === 'asc' ? c : -c
    })
  }, [items, busqueda, orden])

  // Resumen de la selección actual
  const margenSel = useMemo(() => {
    // margen % ponderado por las ventas con costo de cada fila (aprox. a partir de margen Q)
    const conMargen = items.filter(i => i.margen !== null)
    const v = conMargen.reduce((s, i) => s + i.ventas, 0)
    const m = conMargen.reduce((s, i) => s + i.margen, 0)
    return v > 0 ? (m / v) * 100 : null
  }, [items])

  const comparativo = useMemo(() => items.slice(0, 12).map(i => ({
    nombre: i.nombre.length > 28 ? i.nombre.slice(0, 27) + '…' : i.nombre,
    actual: i.ventas,
    anterior: i.ventas_prev,
  })), [items])

  const drill = (it) => {
    if (esHoja) return
    setPath([...path, { dim: nivel.dim, clave: it.clave, nombre: it.nombre }])
    setBusqueda('')
    setVerPerdidos(false)
  }
  const irA = (n) => { setPath(path.slice(0, n)); setBusqueda(''); setVerPerdidos(false) }
  const sortBy = (col) => setOrden(o => ({ col, dir: o.col === col && o.dir === 'desc' ? 'asc' : 'desc' }))

  const titulo = path.length ? path[path.length - 1].nombre : 'Todas las categorías'

  const Th = ({ col, children, align = 'right' }) => (
    <th className={`text-${align} font-semibold pb-2 px-1 cursor-pointer select-none whitespace-nowrap hover:text-[var(--text-primary)]`} onClick={() => sortBy(col)}>
      <span className="inline-flex items-center gap-0.5">
        {children}
        {orden.col === col ? (orden.dir === 'desc' ? ' ↓' : ' ↑') : <ChevronUpDownIcon className="w-3 h-3 opacity-40" />}
      </span>
    </th>
  )

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 flex-wrap text-sm">
        <button onClick={() => irA(0)} className={`px-2 py-1 rounded hover:bg-[var(--bg-secondary)] ${path.length === 0 ? 'font-semibold' : 'text-[var(--text-muted)]'}`}>
          Todas las categorías
        </button>
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <button onClick={() => irA(i + 1)} className={`px-2 py-1 rounded hover:bg-[var(--bg-secondary)] ${i === path.length - 1 ? 'font-semibold' : 'text-[var(--text-muted)]'}`}>
              <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mr-1">{NIVELES[i].singular}</span>
              {p.nombre}
            </button>
          </span>
        ))}
      </div>

      {/* KPIs de la selección */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniKpi label={`Ventas · ${titulo}`} value={fmtM(d.total)} sub={<>vs {fmtM(d.total_prev)} año ant.</>} />
        <MiniKpi label="Variación" value={<Variacion pct={d.variacion_pct} className="text-xl" />} sub={d.total_prev ? `${d.total - d.total_prev >= 0 ? '+' : ''}${fmtM(d.total - d.total_prev)}` : ''} />
        <MiniKpi label="Margen bruto" value={<span className={margenTone(margenSel)}>{margenSel === null ? '—' : `${margenSel.toFixed(1)}%`}</span>} sub="sobre ventas con costo" />
        <MiniKpi label={nivel.plural} value={fmtInt(d.n_items)} sub={`${fmtInt(d.n_items_prev)} en período anterior`} />
        <MiniKpi
          label="Venta perdida"
          value={<span className={d.venta_perdida > 0 ? 'text-[var(--danger)]' : ''}>{fmtM(d.venta_perdida)}</span>}
          sub={`${(d.perdidos || []).length} ${nivel.plural.toLowerCase()} sin venta este período`}
        />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="section-header">
            <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Evolución mensual por {nivel.singular.toLowerCase()}</h2>
          </div>
          <div className="p-5 pt-0">
            {!serie?.serie?.length ? (
              <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serie.serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis dataKey="periodo" tickFormatter={fmtPeriod} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={60} />
                  <Tooltip formatter={(v) => fmtQ(v)} labelFormatter={fmtPeriod} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v.length > 30 ? v.slice(0, 29) + '…' : v)} />
                  {serie.series.map((s, i) => (
                    <Bar key={s} dataKey={s} stackId="a" fill={s === 'Otros' ? OTROS_COLOR : COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <Squares2X2Icon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">{etiquetaCorta || 'Período'} vs año anterior (top 12)</h2>
          </div>
          <div className="p-5 pt-0">
            {comparativo.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparativo} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis type="category" dataKey="nombre" width={150} tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval={0} />
                  <Tooltip formatter={(v) => fmtQ(v)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="actual" name="Período actual" fill="#001639" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="anterior" name="Período anterior" fill={OTROS_COLOR} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Puente de variación */}
      {d.puente && d.total_prev > 0 && (
        <div className="card">
          <div className="section-header">
            <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">¿De dónde viene la variación? · {titulo}</h2>
          </div>
          <div className="p-5 pt-0">
            <Puente puente={d.puente} />
            <p className="text-[11px] text-[var(--text-muted)] mt-2">
              <strong>Precio</strong> y <strong>volumen</strong> comparan el mismo artículo en ambos períodos (precio = cambio de precio promedio × unidades de hoy).
              <strong> Art. nuevos</strong> son artículos que no se vendieron en el período anterior y <strong>art. perdidos</strong> los que dejaron de venderse
              (en producto a la medida, un código nuevo suele reemplazar a uno viejo).
            </p>
          </div>
        </div>
      )}

      {/* Tabla principal */}
      <div className="card">
        <div className="section-header flex-wrap gap-2">
          <Squares2X2Icon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">
            {nivel.plural} {path.length ? `de ${titulo}` : ''} ({fmtInt(filas.length)})
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="input py-1 pl-7 text-xs w-40" />
            </div>
            <button
              className="btn-secondary flex items-center gap-1 text-xs py-1"
              onClick={() => exportarCSV(`ventas_${nivel.dim}_${desde}_${hasta}.csv`, [
                { label: nivel.singular, get: f => f.nombre },
                ...(nivel.dim === 'articulo' ? [{ label: 'Código', get: f => f.clave }] : []),
                { label: 'Ventas', get: f => f.ventas.toFixed(2) },
                { label: 'Ventas período anterior', get: f => f.ventas_prev.toFixed(2) },
                { label: 'Variación %', get: f => f.variacion_pct },
                { label: 'Participación %', get: f => f.participacion },
                { label: 'Efecto precio', get: f => f.efecto_precio.toFixed(2) },
                { label: 'Efecto volumen', get: f => f.efecto_volumen.toFixed(2) },
                { label: 'Efecto artículos nuevos', get: f => f.efecto_nuevos.toFixed(2) },
                { label: 'Efecto artículos perdidos', get: f => f.efecto_perdidos.toFixed(2) },
                { label: 'Unidades', get: f => f.unidades },
                { label: 'Precio promedio', get: f => f.precio_promedio?.toFixed(2) },
                { label: 'Clientes', get: f => f.clientes },
                { label: 'SKUs', get: f => f.skus },
                { label: 'Margen %', get: f => f.margen_pct },
                { label: 'Margen % año ant.', get: f => f.margen_pct_prev },
                { label: '% ventas sin costo', get: f => f.pct_sin_costo },
              ], filas)}
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>
        <div className="p-5 pt-0 overflow-x-auto">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Cargando…</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <Th col="nombre" align="left">{nivel.singular}</Th>
                  <Th col="ventas">Ventas</Th>
                  <Th col="ventas_prev">Año ant.</Th>
                  <Th col="variacion_pct">Var.</Th>
                  <Th col="participacion">Share</Th>
                  <Th col="efecto_precio">Ef. precio</Th>
                  <Th col="efecto_volumen">Ef. volumen</Th>
                  <Th col="unidades">Unidades</Th>
                  {nivel.dim === 'articulo' && <Th col="precio_promedio">Precio prom.</Th>}
                  <Th col="clientes">Clientes</Th>
                  {nivel.dim !== 'articulo' && <Th col="skus">SKUs</Th>}
                  <Th col="margen_pct">Margen%</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filas.map((it) => (
                  <tr
                    key={it.clave}
                    onClick={() => drill(it)}
                    className={`text-sm hover:bg-[var(--bg-secondary)] ${esHoja ? '' : 'cursor-pointer'}`}
                  >
                    <td className="py-2 pr-2 max-w-[22rem]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate" title={it.nombre}>{it.nombre}</span>
                        {!esHoja && <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />}
                      </div>
                      {nivel.dim === 'articulo' && <p className="text-[10px] text-[var(--text-muted)]">{it.clave}</p>}
                    </td>
                    <td className="py-2 px-1 text-right tabular-nums font-semibold">{fmtM(it.ventas)}</td>
                    <td className="py-2 px-1 text-right tabular-nums text-[var(--text-muted)]">{it.ventas_prev ? fmtM(it.ventas_prev) : '—'}</td>
                    <td className="py-2 px-1 text-right"><Variacion pct={it.variacion_pct} nuevo={it.nuevo} /></td>
                    <td className="py-2 px-1 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 rounded bg-[var(--bg-tertiary)] overflow-hidden hidden sm:block">
                          <div className="h-full bg-[#001639]" style={{ width: `${Math.min(it.participacion, 100)}%` }} />
                        </div>
                        <span className="tabular-nums text-xs w-10">{it.participacion}%</span>
                      </div>
                    </td>
                    <td className={`py-2 px-1 text-right tabular-nums text-xs ${it.efecto_precio < 0 ? 'text-[var(--danger)]' : ''}`}>{Math.abs(it.efecto_precio) >= 1 ? fmtM(it.efecto_precio) : '—'}</td>
                    <td className={`py-2 px-1 text-right tabular-nums text-xs ${it.efecto_volumen < 0 ? 'text-[var(--danger)]' : ''}`}>{Math.abs(it.efecto_volumen) >= 1 ? fmtM(it.efecto_volumen) : '—'}</td>
                    <td className="py-2 px-1 text-right tabular-nums">{fmtInt(it.unidades)}</td>
                    {nivel.dim === 'articulo' && <td className="py-2 px-1 text-right tabular-nums">{it.precio_promedio ? fmtQ(it.precio_promedio) : '—'}</td>}
                    <td className="py-2 px-1 text-right tabular-nums">
                      {fmtInt(it.clientes)}
                      {it.clientes_prev > 0 && it.clientes !== it.clientes_prev && (
                        <span className="text-[10px] text-[var(--text-muted)] ml-1">({it.clientes > it.clientes_prev ? '+' : ''}{it.clientes - it.clientes_prev})</span>
                      )}
                    </td>
                    {nivel.dim !== 'articulo' && <td className="py-2 px-1 text-right tabular-nums">{fmtInt(it.skus)}</td>}
                    <td className={`py-2 px-1 text-right tabular-nums font-semibold ${margenTone(it.margen_pct)}`}>
                      {it.margen_pct === null ? '—' : `${it.margen_pct.toFixed(1)}%`}
                      {it.margen_pct !== null && it.margen_pct_prev !== null && (
                        <p className="text-[10px] font-normal text-[var(--text-muted)]">
                          {(it.margen_pct - it.margen_pct_prev) >= 0 ? '+' : ''}{(it.margen_pct - it.margen_pct_prev).toFixed(1)} pts vs ant.
                        </p>
                      )}
                      {it.pct_sin_costo >= 1 && (
                        <p className="text-[10px] font-normal text-[var(--text-muted)] whitespace-nowrap" title="El margen % se calcula solo con las líneas que traen costo en el ERP">
                          {it.pct_sin_costo.toFixed(1)}% sin costo
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!esHoja && filas.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-3">Haz clic en una fila para ver sus {NIVELES[path.length + 1].plural.toLowerCase()}.</p>
          )}
        </div>
      </div>

      {/* Perdidos */}
      {(d.perdidos || []).length > 0 && (
        <div className="card">
          <button className="section-header w-full text-left" onClick={() => setVerPerdidos(v => !v)}>
            <ArrowTrendingDownIcon className="w-5 h-5 text-[var(--danger)]" />
            <h2 className="font-semibold">
              {nivel.plural} que dejaron de venderse ({d.perdidos.length}{d.perdidos.length === 25 ? '+' : ''}) · {fmtM(d.venta_perdida)} en el período anterior
            </h2>
            <ChevronRightIcon className={`w-4 h-4 ml-auto transition-transform ${verPerdidos ? 'rotate-90' : ''}`} />
          </button>
          {verPerdidos && (
            <div className="p-5 pt-0 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)] uppercase">
                    <th className="text-left font-semibold pb-2">{nivel.singular}</th>
                    <th className="text-right font-semibold pb-2">Ventas año ant.</th>
                    <th className="text-right font-semibold pb-2">Unidades año ant.</th>
                    <th className="text-right font-semibold pb-2">Clientes año ant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {d.perdidos.map(p => (
                    <tr key={p.clave} className="text-sm">
                      <td className="py-2 pr-2">
                        <span className="font-medium">{p.nombre}</span>
                        {nivel.dim === 'articulo' && <span className="text-[10px] text-[var(--text-muted)] ml-1">{p.clave}</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--danger)] font-semibold">{fmtM(p.ventas_prev)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(p.unidades_prev)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(p.clientes_prev)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quién explica la selección */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCruzado
          icon={UserGroupIcon}
          titulo={`Top clientes · ${titulo}`}
          data={clientes}
        />
        <RankingCruzado
          icon={UsersIcon}
          titulo={`Vendedores · ${titulo}`}
          data={vendedores}
        />
      </div>
    </div>
  )
}

function MiniKpi({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[var(--text-muted)] truncate" title={typeof label === 'string' ? label : undefined}>{label}</p>
      <p className="text-xl font-semibold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

function RankingCruzado({ icon: Icon, titulo, data }) {
  const items = data?.items || []
  return (
    <div className="card">
      <div className="section-header">
        <Icon className="w-5 h-5 text-[var(--text-muted)]" />
        <h2 className="font-semibold truncate">{titulo}</h2>
      </div>
      <div className="p-5 pt-0 overflow-x-auto">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left font-semibold pb-2">Nombre</th>
                <th className="text-right font-semibold pb-2">Ventas</th>
                <th className="text-right font-semibold pb-2">Var.</th>
                <th className="text-right font-semibold pb-2">Share</th>
                <th className="text-right font-semibold pb-2">Margen%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {items.map(i => (
                <tr key={i.clave} className="text-sm">
                  <td className="py-1.5 pr-2 max-w-[14rem] truncate" title={i.nombre}>{i.nombre}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">{fmtM(i.ventas)}</td>
                  <td className="py-1.5 text-right"><Variacion pct={i.variacion_pct} nuevo={i.nuevo} /></td>
                  <td className="py-1.5 text-right tabular-nums text-xs">{i.participacion}%</td>
                  <td className={`py-1.5 text-right tabular-nums ${margenTone(i.margen_pct)}`}>{i.margen_pct === null ? '—' : `${i.margen_pct.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.n_items > items.length && (
          <p className="text-[11px] text-[var(--text-muted)] mt-2">Top {items.length} de {fmtInt(data.n_items)}</p>
        )}
      </div>
    </div>
  )
}

// Puente de la variación: período anterior → efectos → período actual.
// Precio y volumen comparan el MISMO artículo en ambos períodos; "nuevos" son
// artículos que no se vendían antes y "perdidos" los que dejaron de venderse.
function Puente({ puente }) {
  const data = useMemo(() => {
    if (!puente) return []
    const pasos = [
      { nombre: 'Período anterior', valor: puente.anterior, total: true },
      { nombre: 'Precio', valor: puente.precio },
      { nombre: 'Volumen', valor: puente.volumen },
      { nombre: 'Art. nuevos', valor: puente.nuevos },
      { nombre: 'Art. perdidos', valor: puente.perdidos },
      ...(Math.abs(puente.otros) >= 1 ? [{ nombre: 'Otros', valor: puente.otros }] : []),
      { nombre: 'Período actual', valor: puente.actual, total: true },
    ]
    let acum = 0
    return pasos.map(p => {
      if (p.total) { acum = p.valor; return { ...p, base: 0, barra: p.valor, color: '#001639' } }
      const ini = acum
      acum += p.valor
      return { ...p, base: Math.min(ini, acum), barra: Math.abs(p.valor), color: p.valor >= 0 ? '#10b981' : '#ef4444' }
    })
  }, [puente])

  if (!data.length) return null
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} stroke="var(--text-muted)" interval={0} />
        <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={60} />
        <ReferenceLine y={0} stroke="var(--border-default)" />
        <Tooltip
          cursor={{ fill: 'var(--bg-secondary)' }}
          contentStyle={tooltipStyle}
          formatter={(v, k, item) => (k === 'barra' ? [`${item.payload.total ? '' : item.payload.valor >= 0 ? '+' : '−'}${fmtQ(Math.abs(item.payload.valor))}`, item.payload.nombre] : [null, null])}
          labelFormatter={() => ''}
        />
        <Bar dataKey="base" stackId="p" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="barra" stackId="p" radius={[3, 3, 0, 0]} label={{ position: 'top', fontSize: 10, formatter: (v) => fmtM(v) }}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
