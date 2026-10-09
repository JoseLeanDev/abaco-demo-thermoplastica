import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { Leyenda } from '../common/leyendas'

// Piezas compartidas por las pestañas de Compras.

export { fmtQ, fmtM, fmtMes, tooltipStyle } from '../analisis/formato'

export const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT')
export const fmtFecha = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtPrecio = (n) => (n === null || n === undefined ? '—' : `Q${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: n < 10 ? 4 : 2 })}`)

// Colores por tipo de compra (mismo orden que el backend)
export const TIPOS = [
  { id: 'inventario',  label: 'Materiales e insumos',  corto: 'Materiales',  color: '#001639' },
  { id: 'produccion',  label: 'Costos de producción',  corto: 'Producción',  color: '#3b82f6' },
  { id: 'importacion', label: 'Gastos de importación', corto: 'Importación', color: '#06b6d4' },
  { id: 'gasto',       label: 'Gastos de operación',   corto: 'Gastos',      color: '#f59e0b' },
  { id: 'activo',      label: 'Activo fijo',           corto: 'Activo fijo', color: '#8b5cf6' },
]
export const TIPO = Object.fromEntries(TIPOS.map(t => [t.id, t]))

export const th = 'px-3 py-2.5 text-xs font-semibold text-[var(--text-muted)] uppercase whitespace-nowrap'
export const td = 'px-3 py-2 text-sm whitespace-nowrap'

export function Seccion({ icon: Icon, titulo, leyenda, subtitulo, extra, children, sinPadding }) {
  return (
    <div className="card overflow-hidden">
      <div className="section-header flex-wrap gap-2">
        {Icon && <Icon className="w-5 h-5 text-[var(--text-muted)]" />}
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</h2>
          {subtitulo && <p className="text-xs text-[var(--text-muted)] font-normal">{subtitulo}</p>}
        </div>
        {extra && <div className="ml-auto">{extra}</div>}
      </div>
      <div className={sinPadding ? '' : 'p-5 pt-0'}>{children}</div>
    </div>
  )
}

// Variación % vs año anterior. En compras subir NO es bueno ni malo por sí solo,
// así que se muestra neutral salvo que se pida `invertir` (precios: subir = malo).
export function Delta({ v, invertir = false, sufijo = '%', className = '' }) {
  if (v === null || v === undefined) return <span className={`text-[var(--text-muted)] ${className}`}>—</span>
  const tono = !invertir ? 'text-[var(--text-secondary)]'
    : v > 0.5 ? 'text-[var(--danger)]' : v < -0.5 ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'
  return <span className={`tabular-nums font-medium ${tono} ${className}`}>{v > 0 ? '+' : ''}{Number(v).toFixed(1)}{sufijo}</span>
}

export function Kpi({ titulo, leyenda, valor, sub, children, onClick, activo }) {
  const clic = onClick
    ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && onClick() }
    : {}
  return (
    <div
      {...clic}
      className={`kpi-card text-left ${onClick ? 'card-hover cursor-pointer' : ''} ${activo ? 'ring-2 ring-[#001639]' : ''}`}
    >
      <span className="kpi-label flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</span>
      <p className="kpi-value tabular-nums">{valor}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>}
      {children}
    </div>
  )
}

// Encabezado de columna ordenable
// (la ⓘ va fuera del botón: es otro botón y no se pueden anidar)
export function Th({ col, orden, setOrden, children, leyenda, align = 'right', className = '' }) {
  const activo = orden.col === col
  const Icon = activo && orden.dir === 'asc' ? ChevronUpIcon : ChevronDownIcon
  return (
    <th className={`${th} text-${align} ${className}`}>
      {leyenda && align === 'right' && <Leyenda k={leyenda} />}
      <button
        onClick={() => setOrden(activo ? { col, dir: orden.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })}
        className={`inline-flex items-center gap-0.5 uppercase hover:text-[var(--text-primary)] ${activo ? 'text-[var(--text-primary)]' : ''}`}
      >
        {children}
        <Icon className={`w-3 h-3 ${activo ? '' : 'opacity-0'}`} />
      </button>
      {leyenda && align !== 'right' && <Leyenda k={leyenda} />}
    </th>
  )
}

export function ordenar(items, { col, dir }) {
  const s = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const x = a[col], y = b[col]
    if (x === null || x === undefined) return 1
    if (y === null || y === undefined) return -1
    return typeof x === 'string' ? x.localeCompare(y, 'es') * s : (x - y) * s
  })
}

export function exportarCSV(nombre, columnas, filas) {
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

export function Cargando({ alto = 'h-64' }) {
  return <div className={`card ${alto} animate-pulse bg-[var(--bg-secondary)]`} />
}

export function Mini({ titulo, leyenda, valor, sub }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</span>
      <p className="text-xl font-bold tabular-nums mt-1">{valor}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-1 truncate" title={typeof sub === 'string' ? sub : undefined}>{sub}</p>}
    </div>
  )
}
