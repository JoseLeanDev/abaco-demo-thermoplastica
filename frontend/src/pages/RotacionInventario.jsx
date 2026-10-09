import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ChevronRightIcon,
  ClockIcon,
  CubeIcon,
  InformationCircleIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  ScaleIcon,
  Squares2X2Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList, Legend } from 'recharts'
import { endpoints } from '../services/cfoApi'
import { usePeriodo } from '../context/PeriodoContext'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import FiltroProducto, { FILTRO_VACIO, NIVELES_PRODUCTO } from '../components/ventas/FiltroProducto'
import { fmtM, fmtQ, tooltipStyle } from '../components/analisis/formato'
import { Leyenda } from '../components/common/leyendas'

/**
 * Rotación de inventarios por Categoría › Subcategoría › Sublínea › Artículo
 * (página secundaria de Salud financiera).
 *
 *   Rotación = costo de ventas anualizado ÷ inventario promedio
 *   Días de inventario = 365 ÷ rotación
 *
 * La materia prima no se vende: a nivel artículo (y en grupos que solo tienen
 * materia prima) su salida es lo comprado en el período, como aproximación del
 * consumo. Ver /api/analisis/rotacion-inventario.
 */

const NIVELES = [
  { dim: 'categoria',    singular: 'Categoría',    plural: 'Categorías' },
  { dim: 'subcategoria', singular: 'Subcategoría', plural: 'Subcategorías' },
  { dim: 'sublinea',     singular: 'Sublínea',     plural: 'Sublíneas' },
  { dim: 'articulo',     singular: 'Artículo',     plural: 'Artículos' },
]
const CLASES = { producto: 'Producto terminado', materia_prima: 'Materia prima', sin_movimiento: 'Sin movimiento' }
const TIPOS = [['', 'Todo'], ['producto', 'Producto terminado'], ['materia_prima', 'Materia prima'], ['sin_movimiento', 'Sin movimiento']]
const TRAMOS = [
  { id: 'd30',        nombre: '≤ 1 mes',     color: '#059669' },
  { id: 'd60',        nombre: '1–2 meses',   color: '#22c55e' },
  { id: 'd90',        nombre: '2–3 meses',   color: '#84cc16' },
  { id: 'd180',       nombre: '3–6 meses',   color: '#F59E0B' },
  { id: 'd365',       nombre: '6–12 meses',  color: '#f97316' },
  { id: 'mas_365',    nombre: '> 1 año',     color: '#DC2626' },
  { id: 'sin_salida', nombre: 'Sin salida',  color: '#94a3b8' },
]

const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT')
const fmtDias = (d) => (d === null || d === undefined ? '—' : d >= 730 ? `${(d / 365).toFixed(1)} años` : `${fmtInt(d)} días`)
const fmtRot = (r) => (r === null || r === undefined ? '—' : r === 0 ? '0×' : r < 0.1 ? '<0.1×' : `${r.toFixed(1)}×`)
const fmtFecha = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const fmtMes = (s) => { const [y, m] = s.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es-GT', { month: 'short', year: '2-digit' }) }

// Color por días de inventario: verde rota rápido, rojo se queda
const tonoDias = (d) => (d === null || d === undefined ? 'text-[var(--text-muted)]' : d <= 60 ? 'text-[var(--success)]' : d <= 120 ? 'text-[#65a30d]' : d <= 240 ? 'text-[var(--warning)]' : 'text-[var(--danger)]')

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

// % del inventario vs % del costo de ventas (dos barras finas)
function Peso({ inv, cogs, flujo }) {
  return (
    <div className="space-y-0.5 w-28" title={`${inv}% del inventario · ${cogs}% del ${flujo}`}>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 rounded-sm bg-[#001639]" style={{ width: `${Math.min(100, inv)}%`, minWidth: inv > 0 ? 2 : 0 }} />
        <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{inv}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 rounded-sm bg-[#10b981]" style={{ width: `${Math.min(100, cogs)}%`, minWidth: cogs > 0 ? 2 : 0 }} />
        <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{cogs}%</span>
      </div>
    </div>
  )
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

export default function RotacionInventario() {
  const { params: periodo } = usePeriodo()
  const [filtro, setFiltro] = useState(FILTRO_VACIO)
  const path = NIVELES_PRODUCTO.filter(n => filtro[n.dim]).map(n => ({ dim: n.dim, clave: filtro[n.dim] }))
  const [tipo, setTipo] = useState('')
  const [orden, setOrden] = useState({ col: 'inventario', dir: 'desc' })
  const [busqueda, setBusqueda] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  const idx = NIVELES_PRODUCTO.findIndex(n => !filtro[n.dim])
  const nivel = NIVELES[idx === -1 ? NIVELES.length - 1 : idx]
  const siguiente = NIVELES[NIVELES.indexOf(nivel) + 1]
  const esHoja = nivel.dim === 'articulo'
  const filtros = Object.fromEntries(path.map(p => [p.dim, p.clave]))
  const titulo = path.length ? path[path.length - 1].clave : null

  const { data, isLoading, isPreviousData, isError } = useQuery(
    ['rotacion-inventario', periodo, nivel.dim, JSON.stringify(filtros), q, tipo],
    () => endpoints.analisis.rotacionInventario({ ...periodo, ...filtros, dim: nivel.dim, q: q || undefined, tipo: tipo || undefined }),
    { keepPreviousData: true, staleTime: 5 * 60 * 1000 }
  )
  const d = (data?.data?.dim === nivel.dim && data.data) || null
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
  const maxInv = Math.max(1, ...(d?.items || []).map(i => i.inventario))

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
  const flujo = t?.base_rotacion === 'consumo' ? 'consumo' : 'costo de ventas'
  const base = d?.base_inventario
  const tipoProd = d?.por_tipo?.find(x => x.clase === 'producto')
  const tipoMP = d?.por_tipo?.find(x => x.clase === 'materia_prima')
  // Grupo más pesado en inventario que rota más lento que el promedio (para el resumen)
  const lento = !esHoja && t && filas
    .filter(f => f.pct_inventario >= 5 && f.dias && t.dias && f.dias > t.dias)
    .sort((a, b) => b.inventario - a.inventario)[0]

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
          <h1 className="text-2xl font-semibold">Rotación de inventarios</h1>
          <p className="text-sm text-[var(--text-muted)]">Cuántas veces al año se renueva el inventario, por categoría, subcategoría y sublínea</p>
          <PeriodoActivo nota="costo de ventas del período, anualizado" className="mt-1" />
        </div>
      </div>

      {/* Base del inventario promedio */}
      {base && (base.usa_inventario_hoy || base.fotos < 30) && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 flex gap-2.5 text-xs text-[var(--text-secondary)]">
          <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--text-muted)]" />
          <p>
            {base.usa_inventario_hoy
              ? <>No hay fotos del inventario dentro de este período, así que se usa el <strong>inventario de hoy</strong> como inventario promedio.</>
              : <>Inventario promedio de <strong>{base.fotos} foto{base.fotos === 1 ? '' : 's'}</strong> del inventario ({base.fotos === 1 ? fmtFecha(base.primera_foto) : `${fmtFecha(base.primera_foto)} – ${fmtFecha(base.ultima_foto)}`}).</>}
            {' '}El ERP no guarda el inventario de días pasados; desde el 9 oct 2026 la plataforma guarda una foto diaria, y el promedio del período se va completando solo.
          </p>
        </div>
      )}

      {/* Filtros */}
      <FiltroProducto value={filtro} onChange={setFiltro} fuente="inventario" />
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setBusqueda('') }}
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
        <div className="flex rounded-lg border border-[var(--border-default)] overflow-x-auto text-xs shrink-0 self-start lg:self-auto max-w-full">
          {TIPOS.map(([id, label]) => (
            <button key={id} onClick={() => setTipo(id)} className={`px-3 py-2 whitespace-nowrap ${tipo === id ? 'bg-[#001639] text-white' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>{label}</button>
          ))}
        </div>
      </div>
      {q && (
        <p className="text-xs text-[var(--text-muted)] -mt-3">
          {isPreviousData || !t ? 'Buscando…' : <>
            <span className="font-medium text-[var(--text-secondary)]">{fmtInt(t.articulos)}</span> {t.articulos === 1 ? 'artículo con stock coincide' : 'artículos con stock coinciden'} con “{q}”.
          </>}
        </p>
      )}

      {isError && <div className="card p-8 text-center text-sm text-[var(--text-muted)]">No se pudo calcular la rotación. Intenta de nuevo.</div>}

      {/* KPIs */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isPreviousData ? 'opacity-60' : ''}`}>
        {cargando || !t ? [0, 1, 2, 3].map(i => (
          <div key={i} className="kpi-card"><span className="block h-3 w-24 rounded bg-[var(--bg-tertiary)] animate-pulse" /><span className="block h-7 w-28 mt-3 rounded bg-[var(--bg-tertiary)] animate-pulse" /></div>
        )) : (
          <>
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Rotación de inventarios <Leyenda k="rotacion_inventario" /></span>
              <p className={`kpi-value ${tonoDias(t.dias)}`}>{fmtRot(t.rotacion)} <span className="text-sm font-normal text-[var(--text-muted)]">al año</span></p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.base_rotacion === 'consumo' ? 'consumo de materia prima' : 'costo de ventas'} ÷ inventario promedio</p>
            </div>
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Días de inventario <Leyenda k="dias_inventario_rot" /></span>
              <p className={`kpi-value ${tonoDias(t.dias)}`}>{fmtDias(t.dias)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">365 ÷ rotación</p>
            </div>
            {t.base_rotacion === 'consumo' ? (
              <div className="kpi-card">
                <span className="kpi-label flex items-center gap-1">Consumo estimado del período <Leyenda k="salida_articulo" /></span>
                <p className="kpi-value">{fmtM(t.consumo_mp)}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">materia prima comprada para reponer</p>
              </div>
            ) : (
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Costo de ventas del período <Leyenda k="costo_ventas_rot" /></span>
              <p className="kpi-value">{fmtM(t.cogs)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t.cogs_variacion_pct !== null
                  ? <><span className={`font-semibold ${t.cogs_variacion_pct >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{t.cogs_variacion_pct >= 0 ? '+' : ''}{t.cogs_variacion_pct}%</span> vs año anterior</>
                  : 'sin ventas el año anterior'}
              </p>
            </div>
            )}
            <div className="kpi-card">
              <span className="kpi-label flex items-center gap-1">Inventario promedio <Leyenda k="inventario_promedio" /></span>
              <p className="kpi-value">{fmtM(t.inventario)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{fmtInt(t.articulos)} artículos · {base?.usa_inventario_hoy ? 'inventario de hoy' : `${base?.fotos} foto${base?.fotos === 1 ? '' : 's'}`}</p>
            </div>
          </>
        )}
      </div>

      {/* Resumen en una frase */}
      {!cargando && t && t.inventario > 0 && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex gap-3">
          <LightBulbIcon className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {t.rotacion > 0 ? <>
              El inventario{titulo ? <> de <strong>{titulo}</strong></> : ''} se renueva <strong>{fmtRot(t.rotacion)} al año</strong>: lo que hay en bodega alcanza para <strong>{fmtDias(t.dias)}</strong> al ritmo del período.
            </> : <>El inventario{titulo ? <> de <strong>{titulo}</strong></> : ''} no tuvo salida en el período.</>}
            {!tipo && tipoProd?.rotacion > 0 && tipoMP?.rotacion > 0 && (
              <> El producto terminado rota {fmtRot(tipoProd.rotacion)} ({fmtDias(tipoProd.dias)}) y la materia prima {fmtRot(tipoMP.rotacion)} ({fmtDias(tipoMP.dias)}).</>
            )}
            {lento && (
              <> <strong>{lento.nombre}</strong> tiene el {lento.pct_inventario}% del inventario pero el {lento.pct_cogs}% del {flujo}: rota {fmtRot(lento.rotacion)} ({fmtDias(lento.dias)}).</>
            )}
            {t.sin_salida_valor > 0 && <> {fmtM(t.sin_salida_valor)} están en {fmtInt(t.sin_salida_articulos)} artículos sin ninguna salida en el período.</>}
          </p>
        </div>
      )}

      {/* Por tipo */}
      {!cargando && !tipo && d.por_tipo.length > 1 && (
        <Seccion icon={CubeIcon} titulo="Rotación por tipo de inventario" subtitulo={<>La materia prima se mide con lo que se compra para reponerla <Leyenda k="rotacion_por_tipo" /></>}>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="text-left font-semibold pb-2 pr-2">Tipo <Leyenda k="tipo" /></th>
                  <th className="text-right font-semibold pb-2 px-2">Inventario</th>
                  <th className="text-right font-semibold pb-2 px-2">Salida del período <Leyenda k="salida_articulo" /></th>
                  <th className="text-right font-semibold pb-2 px-2">Rotación</th>
                  <th className="text-right font-semibold pb-2 pl-2">Días</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {d.por_tipo.map(x => (
                  <tr key={x.clase}>
                    <td className="py-2.5 pr-2">
                      <button onClick={() => setTipo(x.clase)} className="font-medium hover:underline text-left">{CLASES[x.clase]}</button>
                      <p className="text-[11px] text-[var(--text-muted)]">{x.clase === 'producto' ? 'costo de ventas' : x.clase === 'materia_prima' ? 'compras del período (consumo estimado)' : 'sin ventas ni compras registradas'}</p>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">
                      {fmtM(x.inventario)} <span className="text-xs text-[var(--text-muted)]">· {t.inventario > 0 ? Math.round(x.inventario / t.inventario * 100) : 0}%</span>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{x.salida > 0 ? fmtM(x.salida) : '—'}</td>
                    <td className={`py-2.5 px-2 text-right tabular-nums font-semibold ${tonoDias(x.dias)}`}>{fmtRot(x.rotacion)}</td>
                    <td className={`py-2.5 pl-2 text-right tabular-nums ${tonoDias(x.dias)}`}>{fmtDias(x.dias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}

      {/* Desglose */}
      <Seccion
        icon={Squares2X2Icon}
        titulo={`Rotación por ${nivel.singular.toLowerCase()}${titulo ? ` · ${titulo}` : ''}`}
        subtitulo={esHoja ? 'Artículos de la selección' : `Haz clic en una fila para ver sus ${siguiente.plural.toLowerCase()}`}
        accion={
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-[#001639]" />% del inventario</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-[#10b981]" />% del {flujo}</span>
            <Leyenda k="inventario_vs_costo" />
          </div>
        }
      >
        {cargando ? (
          <div className="h-48 rounded animate-pulse bg-[var(--bg-secondary)]" />
        ) : filas.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">{q ? `Ningún artículo coincide con “${q}”.` : 'Sin inventario ni salidas en esta selección.'}</p>
        ) : (
          <>
            {/* Celular: lista */}
            <ul className="sm:hidden divide-y divide-[var(--border-default)] -mx-5">
              {filas.map(it => (
                <li key={it.clave}>
                  <button onClick={() => drill(it)} disabled={esHoja} className="w-full text-left px-5 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-sm truncate">{it.nombre}</p>
                      <p className="text-xs text-[var(--text-muted)]">{fmtM(it.inventario)} inventario · {it.pct_inventario}% del inv. · {it.pct_cogs}% del {flujo}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold tabular-nums ${tonoDias(it.dias)}`}>{fmtRot(it.rotacion)}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{fmtDias(it.dias)}</p>
                    </div>
                    {!esHoja && <ChevronRightIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>

            <div className={`hidden sm:block overflow-x-auto -mx-5 px-5 ${isPreviousData ? 'opacity-60' : ''}`}>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)]">
                    <Th col="nombre" align="left">{nivel.singular}</Th>
                    <Th col="inventario" align="left" ayuda="inventario_promedio">Inventario</Th>
                    <Th col="pct_inventario" align="left" ayuda="inventario_vs_costo">Peso</Th>
                    <Th col="cogs" ayuda="costo_ventas_rot">Costo de ventas</Th>
                    <Th col="rotacion" ayuda="rotacion_inventario">Rotación</Th>
                    <Th col="dias" ayuda="dias_inventario_rot">Días</Th>
                    <Th col="sin_salida_valor" ayuda="sin_salida">Sin salida</Th>
                    {!esHoja && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filas.map(it => (
                    <tr key={it.clave} onClick={() => drill(it)} className={`text-sm group ${esHoja ? '' : 'cursor-pointer hover:bg-[var(--bg-secondary)]'}`}>
                      <td className="py-2.5 pr-2 max-w-[18rem]">
                        <span className="font-medium truncate block" title={it.nombre}>{it.nombre}</span>
                        {esHoja
                          ? <span className="text-[10px] text-[var(--text-muted)]">{it.clave} · {CLASES[it.clase]}</span>
                          : it.pct_materia_prima > 0 && <span className="text-[10px] text-[var(--text-muted)]">{it.pct_materia_prima}% materia prima</span>}
                      </td>
                      <td className="py-2.5 px-2 min-w-[10rem]">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold w-16 shrink-0">{fmtM(it.inventario)}</span>
                          <div className="flex-1 h-2 rounded-sm bg-[var(--bg-tertiary)] overflow-hidden"><div className="h-full bg-[#001639]/70" style={{ width: `${it.inventario / maxInv * 100}%` }} /></div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2"><Peso inv={it.pct_inventario} cogs={it.pct_cogs} flujo={flujo} /></td>
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">
                        {it.cogs > 0 ? fmtM(it.cogs) : it.consumo_mp > 0 ? <span className="text-[var(--text-muted)]" title="Materia prima: compras del período como consumo">{fmtM(it.consumo_mp)}*</span> : '—'}
                      </td>
                      <td className={`py-2.5 px-2 text-right tabular-nums font-semibold ${tonoDias(it.dias)}`}>{fmtRot(it.rotacion)}</td>
                      <td className={`py-2.5 px-2 text-right tabular-nums whitespace-nowrap ${tonoDias(it.dias)}`}>{fmtDias(it.dias)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-[var(--text-secondary)]">
                        {it.sin_salida_valor > 0 ? <>{fmtM(it.sin_salida_valor)}{!esHoja && <span className="text-[10px] text-[var(--text-muted)]"> · {fmtInt(it.sin_salida_articulos)}</span>}</> : '—'}
                      </td>
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
              {d.sin_inventario?.cogs > 0 && (
                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                  No se muestran {d.sin_inventario.grupos.length} {nivel.plural.toLowerCase()} sin inventario ({d.sin_inventario.grupos.slice(0, 4).join(', ')}{d.sin_inventario.grupos.length > 4 ? '…' : ''}): servicios o artículos sin stock en el inventario promedio. Su costo de ventas ({fmtM(d.sin_inventario.cogs)}, {d.sin_inventario.pct_cogs}% del total) sí entra en la rotación total.
                </p>
              )}
              {filas.some(f => !f.cogs && f.consumo_mp > 0) && (
                <p className="text-[11px] text-[var(--text-muted)] mt-2">* Solo materia prima: se mide con lo comprado en el período como aproximación del consumo.</p>
              )}
            </div>
          </>
        )}
      </Seccion>

      {!cargando && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Seccion icon={ClockIcon} titulo="¿Para cuánto tiempo alcanza el inventario?" subtitulo={<>Valor del stock según los días de inventario de cada artículo <Leyenda k="distribucion_rotacion" /></>}>
            <Distribucion data={d.distribucion} />
          </Seccion>
          <Seccion icon={ScaleIcon} titulo="Inventario vs costo de ventas" subtitulo={<>Dónde está el dinero en bodega y dónde está la venta <Leyenda k="inventario_vs_costo" /></>}>
            <InventarioVsCosto items={esHoja ? [] : filas} flujo={flujo} />
            {esHoja && <p className="py-8 text-center text-sm text-[var(--text-muted)]">Disponible por categoría, subcategoría y sublínea.</p>}
          </Seccion>
        </div>
      )}

      {!cargando && d.serie.length > 0 && (
        <Seccion icon={ChartBarIcon} titulo="Salida mensual a costo" subtitulo={<>Costo de lo vendido y compras de la selección, últimos 12 meses <Leyenda k="salida_mensual" /></>}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.serie.map(s => ({ ...s, etiqueta: fmtMes(s.mes) }))} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={56} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtQ(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="cogs" name="Costo de ventas" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="compras" name="Compras" fill="#001639" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-[var(--text-muted)] mt-2">Si las compras quedan por encima del costo de ventas mes a mes, el inventario crece y la rotación baja.</p>
        </Seccion>
      )}

      {/* Artículos */}
      {!cargando && !esHoja && d.articulos.length > 0 && (
        <Seccion
          icon={ArrowPathIcon}
          titulo={`Artículos con más inventario${titulo ? ` · ${titulo}` : ''}`}
          subtitulo={`${fmtInt(d.articulos.length)}${d.articulos.length === 100 ? ' (máximo)' : ''} artículos, ordenados por inventario`}
          accion={
            <button
              className="btn-secondary flex items-center gap-1 text-xs py-1"
              onClick={() => exportarCSV(`rotacion_inventario_${d.periodo.desde}_${d.periodo.hasta}.csv`, [
                { label: 'Código', get: a => a.codigo_articulo },
                { label: 'Artículo', get: a => a.articulo },
                { label: 'Categoría', get: a => a.categoria },
                { label: 'Subcategoría', get: a => a.subcategoria },
                { label: 'Sublínea', get: a => a.sublinea },
                { label: 'Tipo', get: a => CLASES[a.clase] },
                { label: 'Stock', get: a => a.stock_actual },
                { label: 'Inventario promedio (costo)', get: a => a.inventario },
                { label: 'Salida del período (costo)', get: a => a.salida },
                { label: 'Rotación anual', get: a => a.rotacion },
                { label: 'Días de inventario', get: a => a.dias },
                { label: 'Última venta', get: a => (a.ultima_venta ? String(a.ultima_venta).slice(0, 10) : '') },
                { label: 'Última compra', get: a => (a.ultima_compra ? String(a.ultima_compra).slice(0, 10) : '') },
              ], d.articulos)}
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Excel
            </button>
          }
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="text-left font-semibold pb-2 pr-2">Artículo <Leyenda k="tipo" /></th>
                  <th className="text-left font-semibold pb-2 px-2 hidden md:table-cell">Categoría › Subcategoría › Sublínea</th>
                  <th className="text-right font-semibold pb-2 px-2">Inventario</th>
                  <th className="text-right font-semibold pb-2 px-2 hidden sm:table-cell">Salida <Leyenda k="salida_articulo" /></th>
                  <th className="text-right font-semibold pb-2 px-2">Rotación</th>
                  <th className="text-right font-semibold pb-2 pl-2">Días</th>
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
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmtM(a.inventario)}</td>
                    <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell text-[var(--text-secondary)]">{a.salida > 0 ? fmtM(a.salida) : '—'}</td>
                    <td className={`py-2 px-2 text-right tabular-nums font-semibold ${tonoDias(a.dias)}`}>{fmtRot(a.rotacion)}</td>
                    <td className={`py-2 pl-2 text-right tabular-nums whitespace-nowrap ${tonoDias(a.dias)}`}>{a.dias === null ? 'sin salida' : fmtDias(a.dias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Rotación = costo de ventas del período × (365 ÷ días del período) ÷ inventario promedio a costo. Días de inventario = 365 ÷ rotación.
      </p>
    </div>
  )
}

function Distribucion({ data }) {
  const filas = TRAMOS.map(t => ({ ...t, ...(data.find(x => x.tramo === t.id) || { valor: 0, articulos: 0 }) }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={filas} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis dataKey="nombre" tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval={0} />
        <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={56} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, k, item) => [`${fmtQ(v)} · ${fmtInt(item.payload.articulos)} artículos`, 'Inventario']} />
        <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
          {filas.map(f => <Cell key={f.id} fill={f.color} />)}
          <LabelList dataKey="valor" position="top" formatter={fmtM} style={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function InventarioVsCosto({ items, flujo }) {
  const top = [...items].sort((a, b) => b.inventario - a.inventario).slice(0, 8)
    .map(i => ({ nombre: i.nombre.length > 18 ? `${i.nombre.slice(0, 17)}…` : i.nombre, completo: i.nombre, inv: i.pct_inventario, cogs: i.pct_cogs }))
  if (!top.length) return null
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, top.length * 34 + 40)}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={120} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l, p) => p?.[0]?.payload?.completo || l} formatter={(v, n) => [`${v}%`, n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="inv" name="% del inventario" fill="#001639" barSize={10} radius={[0, 3, 3, 0]} />
        <Bar dataKey="cogs" name={`% del ${flujo}`} fill="#10b981" barSize={10} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
