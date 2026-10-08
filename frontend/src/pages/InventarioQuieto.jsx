import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CubeIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList } from 'recharts'
import { endpoints } from '../services/cfoApi'
import FiltroProducto, { FILTRO_VACIO, NIVELES_PRODUCTO } from '../components/ventas/FiltroProducto'
import { fmtM, fmtQ, tooltipStyle } from '../components/analisis/formato'
import { Leyenda } from '../components/analisis/leyendasInventario'

/**
 * Capital inmovilizado en inventario por Categoría › Subcategoría › Sublínea › Artículo
 * (página secundaria de Salud financiera). Es la foto del stock al corte, no
 * depende del filtro de período.
 *
 * Estados (vista analitica.v_inventario_salud):
 *  - Inmovilizado: producto sin ventas en 180 días, materia prima sin compras en
 *    un año, o artículo sin ningún movimiento registrado.
 *  - Lento: se mueve, pero el stock alcanza para más de 180 días al ritmo actual.
 *  - Activo: el resto.
 */

const NIVELES = [
  { dim: 'categoria',    singular: 'Categoría',    plural: 'Categorías' },
  { dim: 'subcategoria', singular: 'Subcategoría', plural: 'Subcategorías' },
  { dim: 'sublinea',     singular: 'Sublínea',     plural: 'Sublíneas' },
  { dim: 'articulo',     singular: 'Artículo',     plural: 'Artículos' },
]
const ESTADOS = {
  activo:       { nombre: 'Activo',       color: '#059669', ayuda: 'Se vende o se consume a buen ritmo' },
  lento:        { nombre: 'Lento',        color: '#F59E0B', ayuda: 'Se mueve, pero el stock alcanza para más de 180 días' },
  inmovilizado: { nombre: 'Inmovilizado', color: '#DC2626', ayuda: 'Producto sin ventas en 180 días, materia prima sin compras en un año o sin ningún movimiento' },
}
const CLASES = { materia_prima: 'Materia prima', producto: 'Producto', sin_movimiento: 'Sin movimiento' }
const TRAMOS = [
  { id: '0_90',         nombre: '≤ 3 meses',   color: '#059669' },
  { id: '91_180',       nombre: '3–6 meses',   color: '#84cc16' },
  { id: '181_365',      nombre: '6–12 meses',  color: '#F59E0B' },
  { id: '366_730',      nombre: '1–2 años',    color: '#f97316' },
  { id: 'mas_730',      nombre: '> 2 años',    color: '#DC2626' },
  { id: 'sin_registro', nombre: 'Sin registro', color: '#94a3b8' },
]

const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT')
const fmtDias = (d) => (d === null || d === undefined ? '—' : d >= 730 ? `${(d / 365).toFixed(1)} años` : `${fmtInt(d)} días`)
const fmtFecha = (d) => (d ? String(d).slice(0, 10) : '—')

function Seccion({ icon: Icon, titulo, subtitulo, accion, children }) {
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

// Barra apilada activo / lento / inmovilizado
function BarraEstado({ r, max }) {
  const w = (v) => `${(v / max) * 100}%`
  return (
    <div className="flex h-2.5 rounded-sm overflow-hidden bg-[var(--bg-tertiary)]" style={{ width: w(r.total) }} title={`Activo ${fmtQ(r.activo)} · Lento ${fmtQ(r.lento)} · Inmovilizado ${fmtQ(r.inmovilizado)}`}>
      <div style={{ width: `${(r.inmovilizado / r.total) * 100}%`, background: ESTADOS.inmovilizado.color }} />
      <div style={{ width: `${(r.lento / r.total) * 100}%`, background: ESTADOS.lento.color }} />
      <div style={{ width: `${(r.activo / r.total) * 100}%`, background: ESTADOS.activo.color }} />
    </div>
  )
}

function Estado({ estado }) {
  const e = ESTADOS[estado]
  if (!e) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap" title={e.ayuda}>
      <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />{e.nombre}
    </span>
  )
}

function ultimoMovimiento(a) {
  if (a.clase === 'producto') return a.dias_sin_mov !== null ? `Venta hace ${fmtDias(a.dias_sin_mov)}` : 'Sin ventas'
  if (a.clase === 'materia_prima') return a.dias_sin_mov !== null ? `Compra hace ${fmtDias(a.dias_sin_mov)}` : 'Sin compras'
  return 'Sin movimiento registrado'
}

function exportarCSV(nombre, columnas, filas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [columnas.map(c => esc(c.label)).join(','), ...filas.map(f => columnas.map(c => esc(c.get(f))).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export default function InventarioQuieto() {
  // Filtro Categoría › Subcategoría › Sublínea; hacer clic en una fila lo va rellenando
  const [filtro, setFiltro] = useState(FILTRO_VACIO)
  const path = NIVELES_PRODUCTO.filter(n => filtro[n.dim]).map(n => ({ dim: n.dim, clave: filtro[n.dim] }))
  const [estadoLista, setEstadoLista] = useState('')
  const [orden, setOrden] = useState({ col: 'quieto', dir: 'desc' })
  // Búsqueda por código o nombre de artículo (se aplica a toda la página)
  const [busqueda, setBusqueda] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  // Nivel a mostrar = primer nivel vacío del filtro
  const idx = NIVELES_PRODUCTO.findIndex(n => !filtro[n.dim])
  const nivel = NIVELES[idx === -1 ? NIVELES.length - 1 : idx]
  const siguiente = NIVELES[NIVELES.indexOf(nivel) + 1]
  const esHoja = nivel.dim === 'articulo'
  const filtros = Object.fromEntries(path.map(p => [p.dim, p.clave]))
  const titulo = path.length ? path[path.length - 1].clave : 'Todo el inventario'

  const { data, isLoading, isPreviousData } = useQuery(
    ['inventario-quieto', nivel.dim, JSON.stringify(filtros), estadoLista, q],
    () => endpoints.analisis.inventarioQuieto({ ...filtros, dim: nivel.dim, estado: estadoLista || undefined, q: q || undefined }),
    { keepPreviousData: true, staleTime: 5 * 60 * 1000 }
  )
  // Solo datos del nivel actual (evita clics sobre filas de otro nivel). Cada
  // profundidad tiene su propia dimensión, así que basta comparar dim.
  const d = (data?.data?.dim === nivel.dim && data.data) || null
  const buscando = isPreviousData // datos de la búsqueda anterior mientras llega la nueva
  const cargando = isLoading || !d

  const filas = useMemo(() => {
    const items = d?.items || []
    const { col, dir } = orden
    const v = (i) => (col === 'nombre' ? i.nombre : i[col] ?? -Infinity)
    return [...items].sort((a, b) => {
      const c = typeof v(a) === 'string' ? v(a).localeCompare(v(b)) : v(a) - v(b)
      return dir === 'asc' ? c : -c
    })
  }, [d, orden])
  const maxTotal = Math.max(1, ...(d?.items || []).map(i => i.total))

  const drill = (it) => {
    if (esHoja || cargando) return
    setFiltro({ ...filtro, [nivel.dim]: it.clave })
  }
  const sortBy = (col) => setOrden(o => ({ col, dir: o.col === col && o.dir === 'desc' ? 'asc' : 'desc' }))
  const Th = ({ col, children, align = 'right', ayuda }) => (
    <th className={`text-${align} font-semibold pb-2 px-2 cursor-pointer select-none whitespace-nowrap hover:text-[var(--text-primary)]`} onClick={() => sortBy(col)}>
      {children}
      {ayuda && <Leyenda k={ayuda} className="ml-1" />}
      {orden.col === col ? (orden.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  const t = d?.totales

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <Link to="/analisis" className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors shrink-0" title="Volver a Salud financiera">
          <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
        </Link>
        <div>
          <p className="text-xs text-[var(--text-muted)]">
            <Link to="/analisis" className="hover:underline">Salud financiera</Link> ›
          </p>
          <h1 className="text-2xl font-semibold">Capital inmovilizado en inventario</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Dónde está el dinero quieto, por categoría, subcategoría y sublínea
            {d?.fecha_corte && <> · stock al {fmtFecha(d.fecha_corte)} <Leyenda k="corte" /></>}
          </p>
        </div>
      </div>

      {/* Filtro de producto (opciones = lo que tiene stock hoy) */}
      <FiltroProducto value={filtro} onChange={setFiltro} fuente="inventario" />

      {/* Búsqueda de artículo */}
      <div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onKeyDown={(e) => { if (e.key === 'Escape') setBusqueda('') }}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar artículo por nombre o código…"
            className="input w-full pl-12 pr-10"
            aria-label="Buscar artículo por nombre o código"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-tertiary)]" aria-label="Limpiar búsqueda">
              <XMarkIcon className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
        {q && (
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            {buscando || !t ? 'Buscando…' : <>
              <span className="font-medium text-[var(--text-secondary)]">{fmtInt(t.articulos)}</span> {t.articulos === 1 ? 'artículo con stock coincide' : 'artículos con stock coinciden'} con “{q}”
              {t.articulos > 0 && <> · {fmtM(t.total)} a costo, {fmtM(t.quieto)} quieto</>}.
              {t.articulos > 0 && ' Toda la página muestra solo esos artículos.'}
            </>}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cargando || !t ? [0, 1, 2, 3].map(i => (
          <div key={i} className="kpi-card"><span className="block h-3 w-24 rounded bg-[var(--bg-tertiary)] animate-pulse" /><span className="block h-7 w-28 mt-3 rounded bg-[var(--bg-tertiary)] animate-pulse" /></div>
        )) : (
          <>
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Inventario a costo <Leyenda k="inventario" /></span>
              <p className="kpi-value">{fmtM(t.total)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{fmtInt(t.articulos)} artículos con stock</p>
            </div>
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Inmovilizado <Leyenda k="inmovilizado" /></span>
              <p className="kpi-value" style={{ color: ESTADOS.inmovilizado.color }}>{fmtM(t.inmovilizado)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.pct_inmovilizado}% del inventario</p>
            </div>
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Lento (más de 6 meses de stock) <Leyenda k="lento" /></span>
              <p className="kpi-value" style={{ color: ESTADOS.lento.color }}>{fmtM(t.lento)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.total > 0 ? ((t.lento / t.total) * 100).toFixed(1) : 0}% del inventario</p>
            </div>
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Cobertura <Leyenda k="cobertura" /></span>
              <p className="kpi-value">{fmtDias(t.dias_cobertura)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{fmtInt(t.articulos_quietos)} de {fmtInt(t.articulos)} artículos quietos</p>
            </div>
          </>
        )}
      </div>

      {/* Resumen en una frase */}
      {!cargando && t && t.total > 0 && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex gap-3">
          <LightBulbIcon className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            De los <strong>{fmtM(t.total)}</strong> en inventario{path.length ? <> de <strong>{titulo}</strong></> : ''},{' '}
            <strong>{fmtM(t.quieto)} ({t.pct_quieto}%)</strong> están quietos <Leyenda k="quieto" />: {fmtM(t.inmovilizado)} inmovilizados y {fmtM(t.lento)} de rotación lenta.
            {!esHoja && filas[0] && filas[0].quieto > 0 && (
              <> La {nivel.singular.toLowerCase()} con más capital quieto es <strong>{filas[0].nombre}</strong> ({fmtM(filas[0].quieto)}, {filas[0].participacion_quieto}% del total quieto)
              {filas[0].dias_cobertura ? <>, con stock para {fmtDias(filas[0].dias_cobertura)}</> : ''}.</>
            )}
          </p>
        </div>
      )}

      {/* ¿Dónde está el capital quieto? */}
      <Seccion
        icon={Squares2X2Icon}
        titulo={`¿Dónde está el capital quieto? · ${nivel.plural}${path.length ? ` de ${titulo}` : ''}`}
        subtitulo={esHoja ? 'Artículos con stock de la selección' : `Haz clic en una fila para ver sus ${siguiente.plural.toLowerCase()}`}
        accion={
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            {['inmovilizado', 'lento', 'activo'].map(e => (
              <span key={e} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ESTADOS[e].color }} />{ESTADOS[e].nombre}
                <Leyenda k={e} />
              </span>
            ))}
          </div>
        }
      >
        {cargando ? (
          <div className="h-48 rounded animate-pulse bg-[var(--bg-secondary)]" />
        ) : (
          <>
            {/* Celular: lista */}
            <ul className="sm:hidden divide-y divide-[var(--border-default)] -mx-5">
              {filas.map(it => (
                <li key={it.clave}>
                  <button onClick={() => drill(it)} disabled={esHoja} className="w-full text-left px-5 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-sm truncate">{it.nombre}</p>
                      <BarraEstado r={it} max={maxTotal} />
                      <p className="text-xs text-[var(--text-muted)]">{it.pct_quieto}% quieto · {fmtM(it.total)} total</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0" style={{ color: ESTADOS.inmovilizado.color }}>{fmtM(it.quieto)}</p>
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
                    <Th col="total" align="left" ayuda="inventario">Inventario</Th>
                    {!esHoja && <>
                      <Th col="inmovilizado" ayuda="inmovilizado">Inmovilizado</Th>
                      <Th col="lento" ayuda="lento">Lento</Th>
                      <Th col="pct_quieto" ayuda="quieto">% quieto</Th>
                    </>}
                    <Th col="dias_cobertura" ayuda="cobertura">Cobertura</Th>
                    {esHoja ? <>
                      <Th col="dias_sin_mov" ayuda="antiguedad">Último movimiento</Th>
                      <Th col="estado" align="left">Estado</Th>
                    </> : <Th col="articulos_quietos" ayuda="articulos">Artículos</Th>}
                    {!esHoja && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filas.map(it => (
                    <tr key={it.clave} onClick={() => drill(it)} className={`text-sm group ${esHoja ? '' : 'cursor-pointer hover:bg-[var(--bg-secondary)]'}`}>
                      <td className="py-2.5 pr-2 max-w-[18rem]">
                        <span className="font-medium truncate block" title={it.nombre}>{it.nombre}</span>
                        {esHoja && <span className="text-[10px] text-[var(--text-muted)]">{it.clave} · {CLASES[it.clase]}</span>}
                      </td>
                      <td className="py-2.5 px-2 min-w-[11rem]">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold w-16 shrink-0">{fmtM(it.total)}</span>
                          <div className="flex-1"><BarraEstado r={it} max={maxTotal} /></div>
                        </div>
                      </td>
                      {!esHoja && <>
                        <td className="py-2.5 px-2 text-right tabular-nums" style={{ color: it.inmovilizado ? ESTADOS.inmovilizado.color : undefined }}>{it.inmovilizado ? fmtM(it.inmovilizado) : '—'}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums" style={{ color: it.lento ? '#b45309' : undefined }}>{it.lento ? fmtM(it.lento) : '—'}</td>
                        <td className={`py-2.5 px-2 text-right tabular-nums font-semibold ${it.pct_quieto >= 80 ? 'text-[var(--danger)]' : it.pct_quieto >= 50 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>{it.pct_quieto}%</td>
                      </>}
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">{fmtDias(it.dias_cobertura)}</td>
                      {esHoja ? <>
                        <td className="py-2.5 px-2 text-right text-xs text-[var(--text-muted)] whitespace-nowrap">{ultimoMovimiento(it)}</td>
                        <td className="py-2.5 px-2"><Estado estado={it.estado} /></td>
                      </> : (
                        <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">{fmtInt(it.articulos_quietos)} <span className="text-[var(--text-muted)]">/ {fmtInt(it.articulos)}</span></td>
                      )}
                      {!esHoja && (
                        <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:underline">
                            <span className="hidden xl:inline">Ver {siguiente.plural.toLowerCase()}</span> <ChevronRightIcon className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Seccion>

      {/* Antigüedad + tipo */}
      {!cargando && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Seccion icon={ClockIcon} titulo="¿Hace cuánto no se mueve?" subtitulo={<>Valor del stock según su última venta (producto) o compra (materia prima) <Leyenda k="antiguedad" /></>}>
            <Antiguedad data={d.antiguedad} />
          </Seccion>
          <Seccion icon={CubeIcon} titulo="¿Qué tipo de inventario es?" subtitulo={<>Producto que se vende, materia prima que se compra, o sin movimiento registrado <Leyenda k="tipo" /></>}>
            <PorClase data={d.por_clase_estado} />
          </Seccion>
        </div>
      )}

      {/* Artículos (en el nivel de artículo la tabla de arriba ya los muestra) */}
      {!cargando && !esHoja && (
        <Seccion
          icon={CubeIcon}
          titulo={`Artículos ${estadoLista ? ESTADOS[estadoLista].nombre.toLowerCase() + 's' : q ? 'que coinciden' : 'quietos'} de mayor valor${path.length ? ` · ${titulo}` : ''}`}
          subtitulo={`${fmtInt(d.articulos.length)}${d.articulos.length === 100 ? ' (máximo)' : ''} artículos, ordenados por valor`}
          accion={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-md border border-[var(--border-default)] overflow-hidden text-xs">
                {[['', q ? 'Todos' : 'Quietos'], ['inmovilizado', 'Inmovilizados'], ['lento', 'Lentos'], ['activo', 'Activos']].map(([id, label]) => (
                  <button key={id} onClick={() => setEstadoLista(id)} className={`px-2 py-1 ${estadoLista === id ? 'bg-[#001639] text-white' : 'hover:bg-[var(--bg-secondary)]'}`}>{label}</button>
                ))}
              </div>
              <button
                className="btn-secondary flex items-center gap-1 text-xs py-1"
                onClick={() => exportarCSV(`inventario_quieto_${fmtFecha(d.fecha_corte)}.csv`, [
                  { label: 'Código', get: a => a.codigo_articulo },
                  { label: 'Artículo', get: a => a.articulo },
                  { label: 'Categoría', get: a => a.categoria },
                  { label: 'Subcategoría', get: a => a.subcategoria },
                  { label: 'Sublínea', get: a => a.sublinea },
                  { label: 'Tipo', get: a => CLASES[a.clase] },
                  { label: 'Estado', get: a => ESTADOS[a.estado]?.nombre },
                  { label: 'Stock', get: a => a.stock_actual },
                  { label: 'Valor a costo', get: a => a.valor },
                  { label: 'Cobertura (días)', get: a => a.dias_cobertura },
                  { label: 'Días sin movimiento', get: a => a.dias_sin_mov },
                  { label: 'Última venta', get: a => fmtFecha(a.ultima_venta) },
                  { label: 'Última compra', get: a => fmtFecha(a.ultima_compra) },
                ], d.articulos)}
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Excel
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="text-left font-semibold pb-2 pr-2">Artículo <Leyenda k="tipo" /></th>
                  <th className="text-left font-semibold pb-2 px-2 hidden md:table-cell">Categoría › Subcategoría › Sublínea <Leyenda k="categoria" /></th>
                  <th className="text-left font-semibold pb-2 px-2">Estado</th>
                  <th className="text-right font-semibold pb-2 px-2">Valor</th>
                  <th className="text-right font-semibold pb-2 px-2 hidden sm:table-cell">Cobertura <Leyenda k="cobertura" /></th>
                  <th className="text-right font-semibold pb-2 pl-2">Último movimiento <Leyenda k="antiguedad" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {d.articulos.map(a => (
                  <tr key={a.codigo_articulo}>
                    <td className="py-2 pr-2 max-w-[16rem]">
                      <p className="truncate" title={a.articulo}>{a.articulo}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{a.codigo_articulo} · {CLASES[a.clase]}</p>
                    </td>
                    <td className="py-2 px-2 text-xs text-[var(--text-secondary)] hidden md:table-cell max-w-[16rem] truncate" title={`${a.categoria} › ${a.subcategoria} › ${a.sublinea}`}>
                      {a.categoria} › {a.subcategoria} › {a.sublinea}
                    </td>
                    <td className="py-2 px-2"><Estado estado={a.estado} /></td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmtQ(a.valor)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-xs hidden sm:table-cell whitespace-nowrap">{fmtDias(a.dias_cobertura)}</td>
                    <td className="py-2 pl-2 text-right text-xs text-[var(--text-muted)] whitespace-nowrap">{ultimoMovimiento(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.articulos.length === 0 && <p className="py-8 text-center text-sm text-[var(--text-muted)]">{q ? `Ningún artículo coincide con “${q}” en este estado.` : 'No hay artículos en este estado.'}</p>}
          </div>
        </Seccion>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Inmovilizado: producto sin ventas en 180 días, materia prima sin compras en un año o artículo sin ningún movimiento registrado.
        Lento: se mueve, pero el stock alcanza para más de 180 días al ritmo de los últimos 6 meses (producto) o 12 meses (materia prima).
        Es la foto del inventario al corte; no depende del filtro de período.
      </p>
    </div>
  )
}

function Antiguedad({ data }) {
  const filas = TRAMOS.map(t => ({ ...t, ...(data.find(x => x.tramo === t.id) || { valor: 0, articulos: 0 }) }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={filas} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} stroke="var(--text-muted)" interval={0} />
        <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={56} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, k, item) => [`${fmtQ(v)} · ${fmtInt(item.payload.articulos)} artículos`, 'Valor']} />
        <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
          {filas.map(f => <Cell key={f.id} fill={f.color} />)}
          <LabelList dataKey="valor" position="top" formatter={fmtM} style={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function PorClase({ data }) {
  const filas = Object.entries(CLASES).map(([id, nombre]) => {
    const f = { clase: nombre }
    for (const e of Object.keys(ESTADOS)) f[e] = data.filter(x => x.clase === id && x.estado === e).reduce((s, x) => s + x.valor, 0)
    f.total = f.activo + f.lento + f.inmovilizado
    return f
  }).filter(f => f.total > 0)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={filas} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
        <YAxis type="category" dataKey="clase" tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={105} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, k) => [fmtQ(v), ESTADOS[k]?.nombre]} />
        {['inmovilizado', 'lento', 'activo'].map(e => <Bar key={e} dataKey={e} stackId="c" fill={ESTADOS[e].color} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}
