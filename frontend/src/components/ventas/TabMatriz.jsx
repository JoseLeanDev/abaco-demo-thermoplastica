import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { TableCellsIcon } from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { usePeriodo } from '../../context/PeriodoContext'
import { Leyenda } from '../common/leyendas'

// Tabla cruzada de ventas entre dos dimensiones (p. ej. categoría × vendedor) como
// mapa de calor. Respeta el filtro de producto de la página.

const DIMS = [
  { id: 'categoria',    label: 'Categoría' },
  { id: 'subcategoria', label: 'Subcategoría' },
  { id: 'vendedor',     label: 'Vendedor' },
  { id: 'cliente',      label: 'Cliente' },
  { id: 'sucursal',     label: 'Sucursal' },
  { id: 'tipo_cliente', label: 'Tipo de cliente' },
]
const MODOS = [
  { id: 'q',       label: 'Ventas Q' },
  { id: 'pct_fila', label: '% de la fila' },
  { id: 'pct_col', label: '% de la columna' },
  { id: 'margen',  label: 'Margen %' },
]

const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return `Q${Math.round(v)}`
}

export default function TabMatriz({ filtroProducto }) {
  const { desde, hasta } = usePeriodo()
  const [filas, setFilas] = useState('categoria')
  const [columnas, setColumnas] = useState('vendedor')
  const [modo, setModo] = useState('q')

  const { data, isLoading, isFetching } = useQuery(
    ['ventas-matriz', desde, hasta, filas, columnas, JSON.stringify(filtroProducto)],
    () => endpoints.ventas.matriz({ desde, hasta, filas, columnas, top_columnas: 10, top_filas: 40, ...filtroProducto }),
    { keepPreviousData: true, enabled: filas !== columnas }
  )
  const m = data?.data

  // Valor mostrado y su intensidad (0-1) para el color de cada celda
  const celda = useMemo(() => {
    if (!m) return () => ({ txt: '', alpha: 0 })
    const maxQ = Math.max(1, ...m.filas.flatMap(f => m.columnas.map(c => f.celdas[c]?.ventas || 0)))
    return (f, c) => {
      const x = f.celdas[c]
      if (!x || !x.ventas) return { txt: '—', alpha: 0 }
      if (modo === 'q') return { txt: fmtM(x.ventas), alpha: x.ventas / maxQ }
      if (modo === 'pct_fila') {
        const p = f.total > 0 ? x.ventas / f.total * 100 : 0
        return { txt: `${p.toFixed(0)}%`, alpha: p / 100 }
      }
      if (modo === 'pct_col') {
        const t = m.totales_columna[c] || 0
        const p = t > 0 ? x.ventas / t * 100 : 0
        return { txt: `${p.toFixed(0)}%`, alpha: p / 100 }
      }
      if (x.margen_pct === null || x.margen_pct === undefined) return { txt: 's/c', alpha: 0 }
      return { txt: `${x.margen_pct.toFixed(0)}%`, alpha: Math.max(0, Math.min(1, x.margen_pct / 60)), margen: x.margen_pct }
    }
  }, [m, modo])

  const color = (alpha, margen) => {
    if (modo === 'margen' && margen !== undefined) {
      // rojo (bajo) → verde (alto)
      return margen < 20 ? `rgba(239,68,68,${0.15 + 0.5 * (1 - alpha)})` : `rgba(16,185,129,${0.1 + 0.6 * alpha})`
    }
    return `rgba(0,22,57,${0.06 + 0.8 * alpha})`
  }

  return (
    <div className="card">
      <div className="section-header flex-wrap gap-2">
        <TableCellsIcon className="w-5 h-5 text-[var(--text-muted)]" />
        <h2 className="font-semibold">Matriz de ventas</h2>
        <Leyenda k="matriz" />
        <div className="ml-auto flex items-center gap-2 flex-wrap text-xs">
          <label className="flex items-center gap-1 text-[var(--text-muted)]">Filas
            <select className="input py-1 text-xs w-auto" value={filas} onChange={(e) => setFilas(e.target.value)}>
              {DIMS.map(d => <option key={d.id} value={d.id} disabled={d.id === columnas}>{d.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-[var(--text-muted)]">Columnas
            <select className="input py-1 text-xs w-auto" value={columnas} onChange={(e) => setColumnas(e.target.value)}>
              {DIMS.filter(d => d.id !== 'cliente').map(d => <option key={d.id} value={d.id} disabled={d.id === filas}>{d.label}</option>)}
            </select>
          </label>
          <div className="flex rounded-md border border-[var(--border-default)] overflow-hidden">
            {MODOS.map(x => (
              <button
                key={x.id}
                onClick={() => setModo(x.id)}
                className={`px-2 py-1 ${modo === x.id ? 'bg-[#001639] text-white' : 'hover:bg-[var(--bg-secondary)]'}`}
              >{x.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-5 pt-0 overflow-x-auto">
        {isLoading || !m ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">Cargando…</p>
        ) : m.filas.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
        ) : (
          <table className={`w-full text-xs ${isFetching ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-[var(--text-muted)]">
                <th className="text-left font-semibold pb-2 pr-2 sticky left-0 bg-[var(--bg-primary)]">
                  {DIMS.find(d => d.id === filas)?.label} \ {DIMS.find(d => d.id === columnas)?.label}
                </th>
                {m.columnas.map(c => (
                  <th key={c} className="font-semibold pb-2 px-1 text-center align-bottom max-w-[7rem]" title={c}>
                    <span className="line-clamp-2">{c}</span>
                  </th>
                ))}
                <th className="font-semibold pb-2 px-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {m.filas.map(f => (
                <tr key={f.nombre}>
                  <td className="py-0.5 pr-2 max-w-[16rem] truncate sticky left-0 bg-[var(--bg-primary)] font-medium" title={f.nombre}>{f.nombre}</td>
                  {m.columnas.map(c => {
                    const v = celda(f, c)
                    return (
                      <td key={c} className="p-0.5">
                        <div
                          className="rounded px-1.5 py-1 text-center tabular-nums"
                          style={{ background: v.alpha || v.margen !== undefined ? color(v.alpha, v.margen) : 'transparent', color: modo !== 'margen' && v.alpha > 0.45 ? 'white' : undefined }}
                          title={`${f.nombre} × ${c}: ${f.celdas[c] ? fmtM(f.celdas[c].ventas) : 'sin ventas'}${f.celdas[c]?.margen_pct != null ? ` · margen ${f.celdas[c].margen_pct}%` : ''}`}
                        >
                          {v.txt}
                        </div>
                      </td>
                    )
                  })}
                  <td className="py-0.5 px-1 text-right tabular-nums font-semibold">{fmtM(f.total)}</td>
                </tr>
              ))}
              <tr className="border-t border-[var(--border-default)]">
                <td className="pt-2 pr-2 font-semibold sticky left-0 bg-[var(--bg-primary)]">Total</td>
                {m.columnas.map(c => (
                  <td key={c} className="pt-2 px-1 text-center tabular-nums font-semibold">{fmtM(m.totales_columna[c])}</td>
                ))}
                <td className="pt-2 px-1 text-right tabular-nums font-semibold">{fmtM(m.total)}</td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-[var(--text-muted)] mt-3">
          Hasta 40 filas y 10 columnas; el resto se agrupa en “Otros”. Margen % solo con líneas que traen costo (s/c = sin costo).
        </p>
      </div>
    </div>
  )
}
