import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { endpoints } from '../../services/cfoApi'
import { usePeriodo } from '../../context/PeriodoContext'
import { NIVELES_PRODUCTO } from './FiltroProducto'
import {
  ArrowDownTrayIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, LabelList,
} from 'recharts'

// -------------------------------------------------------------------
// Ventas por categoría. Responde, en orden:
//   1. ¿Cuánto se vendió y cómo va vs el año anterior?  (frase de resumen)
//   2. ¿Qué se vende?                                    (tabla, clic = bajar de nivel)
//   3. ¿Por qué cambió?                                  (puente de variación)
//   4. ¿Quién lo compra y quién lo vende?                (rankings)
// El nivel que se muestra depende del filtro de producto de la página:
// sin filtro → categorías; con categoría → sus subcategorías; ... → artículos.
// -------------------------------------------------------------------

const NIVELES = [...NIVELES_PRODUCTO, { dim: 'articulo', singular: 'Artículo', plural: 'Artículos' }]

const COLORS = ['#001639', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#a855f7', '#64748b', '#0ea5e9']
const OTROS_COLOR = '#cbd5e1'

const fmtQ = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtM = (n) => {
  const v = Number(n) || 0
  const s = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a >= 1e6) return `${s}Q${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${s}Q${Math.round(a / 1e3)}k`
  return `${s}Q${Math.round(a)}`
}
const fmtSigno = (n) => `${n >= 0 ? '+' : ''}${fmtM(n)}`
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

// Encabezado con explicación al pasar el mouse
function Ayuda({ texto }) {
  return (
    <span className="inline-flex align-middle ml-0.5 cursor-help" title={texto}>
      <InformationCircleIcon className="w-3.5 h-3.5 opacity-60" />
    </span>
  )
}

function Seccion({ icon: Icon, titulo, subtitulo, children, accion }) {
  return (
    <div className="card">
      <div className="section-header flex-wrap gap-2">
        <Icon className="w-5 h-5 text-[var(--text-muted)]" />
        <div className="min-w-0">
          <h2 className="font-semibold">{titulo}</h2>
          {subtitulo && <p className="text-xs text-[var(--text-muted)] font-normal">{subtitulo}</p>}
        </div>
        {accion && <div className="ml-auto">{accion}</div>}
      </div>
      <div className="p-5 pt-0">{children}</div>
    </div>
  )
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

// Frase que resume la selección: cuánto, vs año anterior, por qué y qué destaca
function fraseResumen({ titulo, d, nivel }) {
  if (!d.total && !d.total_prev) return null
  const p = d.puente || {}
  const sentencias = [
    <span key="s1">
      <strong>{titulo}</strong> vendió <strong>{fmtM(d.total)}</strong> en el período
      {d.total_prev > 0 && <>, <Variacion pct={d.variacion_pct} /> vs {fmtM(d.total_prev)} del mismo período del año anterior</>}.
    </span>,
  ]

  if (d.total_prev > 0) {
    const efectos = [
      { txt: 'cambios de precio', v: p.precio },
      { txt: 'la cantidad vendida', v: p.volumen },
      { txt: 'productos nuevos', v: p.nuevos },
      { txt: 'productos que ya no se venden', v: p.perdidos },
    ].filter(e => Math.abs(e.v || 0) >= 1)
    const sube = efectos.filter(e => e.v > 0).sort((a, b) => b.v - a.v)
    const baja = efectos.filter(e => e.v < 0).sort((a, b) => a.v - b.v)
    const lista = (arr) => arr.slice(0, 2).map(e => `${e.txt} (${fmtSigno(e.v)})`).join(' y ')
    if (sube.length || baja.length) {
      sentencias.push(
        <span key="s2">
          {' '}{sube.length > 0 && <>Sumaron {lista(sube)}</>}
          {sube.length > 0 && baja.length > 0 && '; '}
          {baja.length > 0 && <>{sube.length ? 'restaron' : 'Restaron'} {lista(baja)}</>}.
        </span>
      )
    }
  }

  const conBase = (d.items || []).filter(i => i.ventas_prev > 0 && i.ventas > 0)
  const mejor = [...conBase].sort((a, b) => b.variacion - a.variacion)[0]
  const peor = [...conBase].sort((a, b) => a.variacion - b.variacion)[0]
  if (mejor && mejor.variacion > 0 && conBase.length > 1) {
    const art = nivel.dim === 'articulo' ? 'El' : 'La'
    sentencias.push(
      <span key="s3">
        {' '}{art} {nivel.singular.toLowerCase()} que más creció fue <strong>{mejor.nombre}</strong> ({fmtSigno(mejor.variacion)})
        {peor && peor.variacion < 0 && <> y {art.toLowerCase()} que más cayó, <strong>{peor.nombre}</strong> ({fmtSigno(peor.variacion)})</>}.
      </span>
    )
  }
  return sentencias
}

export default function TabCategorias({ filtro, onFiltro }) {
  const { desde, hasta } = usePeriodo()
  const [orden, setOrden] = useState({ col: 'ventas', dir: 'desc' })
  const [busqueda, setBusqueda] = useState('')
  const [masColumnas, setMasColumnas] = useState(false)
  const [verPerdidos, setVerPerdidos] = useState(false)

  // Nivel a mostrar = primer nivel del filtro que está vacío
  const idx = NIVELES_PRODUCTO.findIndex(n => !filtro[n.dim])
  const nivel = NIVELES[idx === -1 ? NIVELES.length - 1 : idx]
  const siguiente = NIVELES[NIVELES.indexOf(nivel) + 1]
  const esHoja = nivel.dim === 'articulo'
  const filtros = useMemo(() => Object.fromEntries(Object.entries(filtro).filter(([, v]) => v)), [filtro])
  const seleccion = NIVELES_PRODUCTO.filter(n => filtro[n.dim]).map(n => filtro[n.dim])
  const titulo = seleccion.length ? seleccion[seleccion.length - 1] : 'La empresa'
  const params = { desde, hasta, ...filtros }
  const qKey = [desde, hasta, JSON.stringify(filtros)]

  const { data: dRes, isLoading } = useQuery(
    ['ventas-desglose', nivel.dim, ...qKey],
    () => endpoints.ventas.desglose({ ...params, dim: nivel.dim, limit: 500 }),
    { staleTime: 60 * 1000 }
  )
  const { data: sRes, isLoading: sLoading } = useQuery(
    ['ventas-desglose-serie', nivel.dim, ...qKey],
    () => endpoints.ventas.desgloseSerie({ ...params, dim: nivel.dim, top: 6 }),
    { staleTime: 60 * 1000 }
  )
  const { data: cRes, isLoading: cLoading } = useQuery(
    ['ventas-desglose-clientes', ...qKey],
    () => endpoints.ventas.desglose({ ...params, dim: 'cliente', limit: 10 }),
    { staleTime: 60 * 1000 }
  )
  const { data: vRes, isLoading: vLoading } = useQuery(
    ['ventas-desglose-vendedores', ...qKey],
    () => endpoints.ventas.desglose({ ...params, dim: 'vendedor', limit: 10 }),
    { staleTime: 60 * 1000 }
  )

  // Solo datos del nivel actual: con datos de otro nivel, un clic metería como
  // filtro un valor que no corresponde (p. ej. una subcategoría como sublínea).
  const d = (dRes?.data?.dim === nivel.dim && dRes.data) || {}
  const serie = sRes?.data

  const filas = useMemo(() => {
    const items = d.items || []
    const q = busqueda.trim().toLowerCase()
    const f = q ? items.filter(i => `${i.nombre} ${i.clave}`.toLowerCase().includes(q)) : items
    const { col, dir } = orden
    const val = (i) => (col === 'nombre' ? i.nombre : i[col] ?? -Infinity)
    return [...f].sort((a, b) => {
      const va = val(a), vb = val(b)
      const c = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return dir === 'asc' ? c : -c
    })
  }, [d, busqueda, orden])

  const maxVentas = Math.max(1, ...(d.items || []).map(i => Math.max(i.ventas, i.ventas_prev)))

  const drill = (it) => {
    if (esHoja || isLoading || d.dim !== nivel.dim) return
    onFiltro({ ...filtro, [nivel.dim]: it.clave })
    setBusqueda('')
    setVerPerdidos(false)
  }
  const sortBy = (col) => setOrden(o => ({ col, dir: o.col === col && o.dir === 'desc' ? 'asc' : 'desc' }))

  const Th = ({ col, children, align = 'right', ayuda }) => (
    <th className={`text-${align} font-semibold pb-2 px-2 cursor-pointer select-none whitespace-nowrap hover:text-[var(--text-primary)]`} onClick={() => sortBy(col)}>
      {children}{ayuda && <Ayuda texto={ayuda} />}{orden.col === col ? (orden.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  if (isLoading || !d.dim) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-lg animate-pulse bg-[var(--bg-tertiary)]" />
        <div className="card h-72 animate-pulse bg-[var(--bg-secondary)]" />
      </div>
    )
  }

  const frase = fraseResumen({ titulo, d, nivel })

  return (
    <div className="space-y-6">
      {/* 1. Resumen en una frase */}
      {frase && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex gap-3">
          <LightBulbIcon className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{frase}</p>
        </div>
      )}

      {/* 2. ¿Qué se vende? */}
      <Seccion
        icon={Squares2X2Icon}
        titulo={`¿Qué se vende? · ${nivel.plural}${seleccion.length ? ` de ${titulo}` : ''}`}
        subtitulo={esHoja
          ? `${fmtInt(filas.length)} artículos con venta en el período`
          : `Haz clic en una fila para ver sus ${siguiente.plural.toLowerCase()}`}
        accion={
          <div className="flex items-center gap-2 flex-wrap">
            {(d.items || []).length > 8 && (
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="input py-1 pl-7 text-xs w-36" />
              </div>
            )}
            <button className="btn-secondary text-xs py-1 hidden sm:inline-flex" onClick={() => setMasColumnas(v => !v)}>
              {masColumnas ? 'Menos columnas' : 'Más columnas'}
            </button>
            <button
              className="btn-secondary flex items-center gap-1 text-xs py-1"
              title="Descargar la tabla en CSV (abre en Excel)"
              onClick={() => exportarCSV(`ventas_${nivel.dim}_${desde}_${hasta}.csv`, [
                { label: nivel.singular, get: f => f.nombre },
                ...(esHoja ? [{ label: 'Código', get: f => f.clave }] : []),
                { label: 'Ventas', get: f => f.ventas.toFixed(2) },
                { label: 'Ventas año anterior', get: f => f.ventas_prev.toFixed(2) },
                { label: 'Variación %', get: f => f.variacion_pct },
                { label: '% del total', get: f => f.participacion },
                { label: 'Margen %', get: f => f.margen_pct },
                { label: 'Margen % año anterior', get: f => f.margen_pct_prev },
                { label: 'Clientes', get: f => f.clientes },
                { label: 'Unidades', get: f => f.unidades },
                { label: 'Precio promedio', get: f => f.precio_promedio?.toFixed(2) },
                { label: 'Variación por precio', get: f => f.efecto_precio.toFixed(2) },
                { label: 'Variación por cantidad', get: f => f.efecto_volumen.toFixed(2) },
                { label: 'Productos nuevos', get: f => f.efecto_nuevos.toFixed(2) },
                { label: 'Productos que ya no se venden', get: f => f.efecto_perdidos.toFixed(2) },
                { label: '% ventas sin costo', get: f => f.pct_sin_costo },
              ], filas)}
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        }
      >
        {/* Celular: lista compacta */}
        <ul className="sm:hidden divide-y divide-[var(--border-default)] -mx-5">
          {filas.map(it => (
            <li key={it.clave}>
              <button
                onClick={() => drill(it)}
                disabled={esHoja}
                className="w-full text-left px-5 py-3 flex items-center gap-3 active:bg-[var(--bg-secondary)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{it.nombre}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {it.participacion}% del total · margen <span className={margenTone(it.margen_pct)}>{it.margen_pct === null ? '—' : `${it.margen_pct.toFixed(1)}%`}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{fmtM(it.ventas)}</p>
                  <Variacion pct={it.variacion_pct} nuevo={it.nuevo} className="text-xs" />
                </div>
                {!esHoja && <ChevronRightIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden sm:block overflow-x-auto -mx-5 px-5">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)]">
                <Th col="nombre" align="left">{nivel.singular}</Th>
                <Th col="ventas" align="left" ayuda="Barra oscura: este período. Barra gris: mismo período del año anterior.">Ventas vs año anterior</Th>
                <Th col="variacion_pct">Cambio</Th>
                <Th col="participacion" ayuda="Porcentaje de las ventas de la selección">% del total</Th>
                <Th col="margen_pct" ayuda="Margen bruto %, solo con ventas que traen costo en el ERP">Margen</Th>
                <Th col="clientes">Clientes</Th>
                {masColumnas && <>
                  <Th col="unidades">Unidades</Th>
                  {esHoja && <Th col="precio_promedio">Precio prom.</Th>}
                  <Th col="efecto_precio" ayuda="Cuánto cambiaron las ventas por subir o bajar el precio de los mismos productos">Por precio</Th>
                  <Th col="efecto_volumen" ayuda="Cuánto cambiaron las ventas por vender más o menos unidades de los mismos productos">Por cantidad</Th>
                  {!esHoja && <Th col="skus" ayuda="Productos distintos vendidos">Productos</Th>}
                </>}
                {!esHoja && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.map((it) => (
                <tr
                  key={it.clave}
                  onClick={() => drill(it)}
                  className={`text-sm group ${esHoja ? '' : 'cursor-pointer hover:bg-[var(--bg-secondary)]'}`}
                >
                  <td className="py-2.5 pr-2 max-w-[18rem]">
                    <span className="font-medium truncate block" title={it.nombre}>{it.nombre}</span>
                    {esHoja && <span className="text-[10px] text-[var(--text-muted)]">{it.clave}</span>}
                  </td>
                  <td className="py-2.5 px-2 min-w-[12rem]">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-semibold w-16 shrink-0">{fmtM(it.ventas)}</span>
                      <div className="flex-1 space-y-0.5" title={`Este período ${fmtQ(it.ventas)} · Año anterior ${fmtQ(it.ventas_prev)}`}>
                        <div className="h-2 rounded-sm bg-[#001639]" style={{ width: `${(it.ventas / maxVentas) * 100}%` }} />
                        <div className="h-1.5 rounded-sm bg-[var(--border-default)]" style={{ width: `${(it.ventas_prev / maxVentas) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <Variacion pct={it.variacion_pct} nuevo={it.nuevo} />
                    {!it.nuevo && it.ventas_prev > 0 && (
                      <p className="text-[10px] text-[var(--text-muted)] tabular-nums">{fmtSigno(it.variacion)}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-[var(--text-secondary)]">{it.participacion}%</td>
                  <td className={`py-2.5 px-2 text-right tabular-nums font-semibold whitespace-nowrap ${margenTone(it.margen_pct)}`}>
                    {it.margen_pct === null ? '—' : `${it.margen_pct.toFixed(1)}%`}
                    {it.margen_pct !== null && it.margen_pct_prev !== null && Math.abs(it.margen_pct - it.margen_pct_prev) >= 0.1 && (
                      <p className="text-[10px] font-normal text-[var(--text-muted)]">
                        {it.margen_pct - it.margen_pct_prev >= 0 ? '+' : ''}{(it.margen_pct - it.margen_pct_prev).toFixed(1)} pts
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{fmtInt(it.clientes)}</td>
                  {masColumnas && <>
                    <td className="py-2.5 px-2 text-right tabular-nums">{fmtInt(it.unidades)}</td>
                    {esHoja && <td className="py-2.5 px-2 text-right tabular-nums">{it.precio_promedio ? fmtQ(it.precio_promedio) : '—'}</td>}
                    <td className={`py-2.5 px-2 text-right tabular-nums text-xs ${it.efecto_precio < 0 ? 'text-[var(--danger)]' : ''}`}>{Math.abs(it.efecto_precio) >= 1 ? fmtSigno(it.efecto_precio) : '—'}</td>
                    <td className={`py-2.5 px-2 text-right tabular-nums text-xs ${it.efecto_volumen < 0 ? 'text-[var(--danger)]' : ''}`}>{Math.abs(it.efecto_volumen) >= 1 ? fmtSigno(it.efecto_volumen) : '—'}</td>
                    {!esHoja && <td className="py-2.5 px-2 text-right tabular-nums">{fmtInt(it.skus)}</td>}
                  </>}
                  {!esHoja && (
                    <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:underline">
                        Ver {siguiente.plural.toLowerCase()} <ChevronRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin ventas en el período.</p>}
        </div>
      </Seccion>

      {/* 3. ¿Por qué cambió? */}
      {d.puente && d.total_prev > 0 && (
        <Seccion
          icon={ChartBarIcon}
          titulo="¿Por qué cambiaron las ventas vs el año anterior?"
          subtitulo="De las ventas del año anterior (izquierda) a las de este período (derecha): qué sumó y qué restó"
        >
          <Puente puente={d.puente} />
          <ul className="text-xs text-[var(--text-muted)] mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1">
            <li><strong className="text-[var(--text-secondary)]">Precio:</strong> los mismos productos se vendieron más caros o más baratos.</li>
            <li><strong className="text-[var(--text-secondary)]">Cantidad:</strong> de los mismos productos se vendieron más o menos unidades.</li>
            <li><strong className="text-[var(--text-secondary)]">Productos nuevos:</strong> códigos que no se vendieron el año anterior.</li>
            <li><strong className="text-[var(--text-secondary)]">Ya no se venden:</strong> códigos del año anterior sin venta este período. En producto a la medida, muchas veces un código nuevo reemplaza a uno viejo.</li>
          </ul>
        </Seccion>
      )}

      {/* 4. ¿Quién? */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCruzado icon={UserGroupIcon} titulo="¿Quién lo compra?" subtitulo={`Principales clientes · ${titulo}`} data={cRes?.data} loading={cLoading} />
        <RankingCruzado icon={UsersIcon} titulo="¿Quién lo vende?" subtitulo={`Vendedores · ${titulo}`} data={vRes?.data} loading={vLoading} />
      </div>

      {/* 5. Evolución mensual */}
      <Seccion icon={ChartBarIcon} titulo="Evolución mensual" subtitulo={`Ventas por mes de las principales ${nivel.plural.toLowerCase()}`}>
        {!serie?.serie?.length ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">{sLoading ? 'Cargando…' : 'Sin datos.'}</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
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
      </Seccion>

      {/* 6. Lo que se dejó de vender */}
      {(d.perdidos || []).length > 0 && (
        <div className="card">
          <button className="section-header w-full text-left" onClick={() => setVerPerdidos(v => !v)}>
            <ArrowTrendingDownIcon className="w-5 h-5 text-[var(--danger)]" />
            <div>
              <h2 className="font-semibold">{nivel.plural} que ya no se venden</h2>
              <p className="text-xs text-[var(--text-muted)] font-normal">
                {d.perdidos.length}{d.perdidos.length === 25 ? '+' : ''} con venta el año anterior y ninguna este período · {fmtM(d.venta_perdida)} el año anterior
              </p>
            </div>
            <span className="ml-auto text-xs text-[var(--text-muted)]">{verPerdidos ? 'Ocultar' : 'Ver lista'}</span>
          </button>
          {verPerdidos && (
            <div className="p-5 pt-0 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)]">
                    <th className="text-left font-semibold pb-2">{nivel.singular}</th>
                    <th className="text-right font-semibold pb-2">Ventas año anterior</th>
                    <th className="text-right font-semibold pb-2">Unidades año anterior</th>
                    <th className="text-right font-semibold pb-2">Clientes año anterior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {d.perdidos.map(p => (
                    <tr key={p.clave} className="text-sm">
                      <td className="py-2 pr-2">
                        <span className="font-medium">{p.nombre}</span>
                        {esHoja && <span className="text-[10px] text-[var(--text-muted)] ml-1">{p.clave}</span>}
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
    </div>
  )
}

// Puente de la variación: año anterior → efectos → período actual.
// El eje no arranca en 0 para que los cambios se vean (son chicos vs el total).
function Puente({ puente }) {
  const datos = useMemo(() => {
    const pasos = [
      { nombre: 'Año anterior', valor: puente.anterior, total: true },
      { nombre: 'Precio', valor: puente.precio },
      { nombre: 'Cantidad', valor: puente.volumen },
      { nombre: 'Productos nuevos', valor: puente.nuevos },
      { nombre: 'Ya no se venden', valor: puente.perdidos },
      ...(Math.abs(puente.otros) >= 1 ? [{ nombre: 'Otros', valor: puente.otros }] : []),
      { nombre: 'Este período', valor: puente.actual, total: true },
    ]
    let acum = 0
    const out = pasos.map(p => {
      if (p.total) { acum = p.valor; return { ...p, desde: 0, hasta: p.valor } }
      const ini = acum
      acum += p.valor
      return { ...p, desde: Math.min(ini, acum), hasta: Math.max(ini, acum) }
    })
    // Piso del eje: un poco debajo del punto más bajo del recorrido
    const lo = Math.min(...out.map(o => (o.total ? o.valor : o.desde)))
    const hi = Math.max(...out.map(o => o.hasta))
    const piso = Math.max(0, lo - (hi - lo) * 0.3)
    return out.map(o => {
      const base = o.total ? piso : o.desde
      return {
        ...o,
        piso,
        base,
        barra: o.hasta - base,
        color: o.total ? '#001639' : o.valor >= 0 ? '#10b981' : '#ef4444',
        etiqueta: o.total ? fmtM(o.valor) : fmtSigno(o.valor),
      }
    })
  }, [puente])

  const piso = datos[0]?.piso || 0

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={datos} margin={{ top: 24, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} stroke="var(--text-muted)" interval={0} />
        <YAxis domain={[piso, 'auto']} tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={64} allowDataOverflow />
        <Tooltip
          cursor={{ fill: 'var(--bg-secondary)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload
            return (
              <div style={tooltipStyle} className="px-3 py-2">
                <p className="font-semibold">{p.nombre}</p>
                <p className="tabular-nums">{p.total ? fmtQ(p.valor) : `${p.valor >= 0 ? '+' : '−'}${fmtQ(Math.abs(p.valor))}`}</p>
              </div>
            )
          }}
        />
        <Bar dataKey="base" stackId="p" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="barra" stackId="p" radius={[3, 3, 0, 0]}>
          {datos.map((d, i) => <Cell key={i} fill={d.color} />)}
          <LabelList dataKey="etiqueta" position="top" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-secondary)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function RankingCruzado({ icon: Icon, titulo, subtitulo, data, loading }) {
  const items = data?.items || []
  return (
    <Seccion icon={Icon} titulo={titulo} subtitulo={subtitulo}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">{loading ? 'Cargando…' : 'Sin datos.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[var(--text-muted)]">
                <th className="text-left font-semibold pb-2">Nombre</th>
                <th className="text-right font-semibold pb-2">Ventas</th>
                <th className="text-right font-semibold pb-2">Cambio</th>
                <th className="text-right font-semibold pb-2">% del total</th>
                <th className="text-right font-semibold pb-2">Margen</th>
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
          {data?.n_items > items.length && (
            <p className="text-[11px] text-[var(--text-muted)] mt-2">Top {items.length} de {fmtInt(data.n_items)}</p>
          )}
        </div>
      )}
    </Seccion>
  )
}
