import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { endpoints } from '../../services/cfoApi'
import { usePeriodo } from '../../context/PeriodoContext'
import { ChartBarIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'

// Margen por categoría con drill-down Categoría → Subcategoría → Sublínea → Artículo
// (misma jerarquía que Ventas › Categorías). Compara contra el mismo período del
// año anterior y cuantifica cuánto margen se dejó de ganar por la caída de puntos.

const NIVELES = [
  { dim: 'categoria',    singular: 'Categoría',    plural: 'Categorías' },
  { dim: 'subcategoria', singular: 'Subcategoría', plural: 'Subcategorías' },
  { dim: 'sublinea',     singular: 'Sublínea',     plural: 'Sublíneas' },
  { dim: 'articulo',     singular: 'Artículo',     plural: 'Artículos' },
]

const fmtQ = (n) => `Q ${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
const fmtPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}%`)

const semaforo = (it) => {
  if (it.margen_pct === null) return null
  const d = it.margen_pct_prev === null ? 0 : it.margen_pct - it.margen_pct_prev
  if (it.margen_pct < 20 || d <= -5) return 'rojo'
  if (it.margen_pct < 30 || d <= -2) return 'ambar'
  return 'verde'
}

export default function MargenCategorias() {
  const { desde, hasta } = usePeriodo()
  const [path, setPath] = useState([])
  const [orden, setOrden] = useState({ col: 'margen', dir: 'desc' })

  const nivel = NIVELES[Math.min(path.length, NIVELES.length - 1)]
  const esHoja = path.length >= NIVELES.length - 1
  const filtros = useMemo(() => Object.fromEntries(path.map(p => [p.dim, p.clave])), [path])

  const { data, isLoading } = useQuery(
    ['margen-categorias', nivel.dim, desde, hasta, JSON.stringify(filtros)],
    () => endpoints.ventas.desglose({ desde, hasta, ...filtros, dim: nivel.dim, limit: 500 }),
    { keepPreviousData: true }
  )

  const items = useMemo(() => {
    const raw = data?.data?.items || []
    const margenTotal = raw.reduce((s, i) => s + (i.margen || 0), 0)
    return raw.map(i => {
      const delta = i.margen_pct !== null && i.margen_pct_prev !== null ? i.margen_pct - i.margen_pct_prev : null
      return {
        ...i,
        delta,
        // Q que se habrían ganado con el margen % del año anterior sobre las ventas de hoy
        dejado_de_ganar: delta !== null && delta < 0 ? -delta / 100 * i.ventas : 0,
        aporte: margenTotal > 0 && i.margen !== null ? (i.margen / margenTotal) * 100 : null,
        semaforo: semaforo(i),
      }
    })
  }, [data])

  const filas = useMemo(() => {
    const { col, dir } = orden
    const v = (i) => (col === 'nombre' ? i.nombre : i[col] ?? -Infinity)
    return [...items].sort((a, b) => {
      const c = typeof v(a) === 'string' ? v(a).localeCompare(v(b)) : v(a) - v(b)
      return dir === 'asc' ? c : -c
    })
  }, [items, orden])

  const totalDejado = items.reduce((s, i) => s + i.dejado_de_ganar, 0)
  const rojos = items.filter(i => i.semaforo === 'rojo').length
  const grafica = items.filter(i => i.margen_pct !== null).slice(0, 12).map(i => ({
    nombre: i.nombre.length > 24 ? i.nombre.slice(0, 23) + '…' : i.nombre,
    actual: i.margen_pct,
    anterior: i.margen_pct_prev,
  }))

  const sortBy = (col) => setOrden(o => ({ col, dir: o.col === col && o.dir === 'desc' ? 'asc' : 'desc' }))
  const Th = ({ col, children, align = 'right' }) => (
    <th className={`text-${align} font-semibold pb-2 px-1 cursor-pointer select-none whitespace-nowrap hover:text-[var(--text-primary)]`} onClick={() => sortBy(col)}>
      {children}{orden.col === col ? (orden.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap text-sm">
        <button onClick={() => setPath([])} className={`px-2 py-1 rounded hover:bg-[var(--bg-secondary)] ${path.length === 0 ? 'font-semibold' : 'text-[var(--text-muted)]'}`}>
          Todas las categorías
        </button>
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <button onClick={() => setPath(path.slice(0, i + 1))} className={`px-2 py-1 rounded hover:bg-[var(--bg-secondary)] ${i === path.length - 1 ? 'font-semibold' : 'text-[var(--text-muted)]'}`}>
              <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mr-1">{NIVELES[i].singular}</span>{p.nombre}
            </button>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-[var(--border-color)]">
            <h2 className="font-semibold flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-[var(--accent-primary)]" />
              Margen por {nivel.singular.toLowerCase()}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {rojos} {rojos === 1 ? nivel.singular.toLowerCase() : nivel.plural.toLowerCase()} en rojo
              {totalDejado > 0 && <> · <span className="text-red-400">{fmtQ(totalDejado)}</span> dejados de ganar vs el margen del año anterior</>}
            </p>
          </div>
          <div className="overflow-x-auto p-4 pt-2">
            {isLoading ? (
              <p className="py-6 text-[var(--text-muted)]">Cargando…</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)] uppercase">
                    <Th col="nombre" align="left">{nivel.singular}</Th>
                    <Th col="ventas">Ventas</Th>
                    <Th col="margen">Margen Q</Th>
                    <Th col="aporte">Aporte</Th>
                    <Th col="margen_pct">Margen %</Th>
                    <Th col="margen_pct_prev">Año ant.</Th>
                    <Th col="delta">Δ pts</Th>
                    <Th col="dejado_de_ganar">Dejado de ganar</Th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filas.map(it => (
                    <tr
                      key={it.clave}
                      onClick={() => !esHoja && setPath([...path, { dim: nivel.dim, clave: it.clave, nombre: it.nombre }])}
                      className={`text-sm hover:bg-[var(--bg-secondary)] ${esHoja ? '' : 'cursor-pointer'}`}
                    >
                      <td className="py-2 pr-2 max-w-[18rem]">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium" title={it.nombre}>{it.nombre}</span>
                          {!esHoja && <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />}
                        </div>
                        {it.pct_sin_costo >= 1 && (
                          <p className="text-[10px] text-[var(--text-muted)]" title="El margen % se calcula solo con las líneas que traen costo en el ERP">{it.pct_sin_costo.toFixed(1)}% de ventas sin costo</p>
                        )}
                      </td>
                      <td className="py-2 px-1 text-right tabular-nums">{fmtQ(it.ventas)}</td>
                      <td className="py-2 px-1 text-right tabular-nums">{it.margen === null ? '—' : fmtQ(it.margen)}</td>
                      <td className="py-2 px-1 text-right tabular-nums text-xs">{fmtPct(it.aporte)}</td>
                      <td className="py-2 px-1 text-right tabular-nums font-semibold">{fmtPct(it.margen_pct)}</td>
                      <td className="py-2 px-1 text-right tabular-nums text-[var(--text-muted)]">{fmtPct(it.margen_pct_prev)}</td>
                      <td className="py-2 px-1 text-right tabular-nums">
                        {it.delta === null ? '—' : (
                          <span className={it.delta < 0 ? 'text-red-400' : 'text-emerald-400'}>{it.delta > 0 ? '+' : ''}{it.delta.toFixed(1)}</span>
                        )}
                      </td>
                      <td className="py-2 px-1 text-right tabular-nums">{it.dejado_de_ganar > 0 ? <span className="text-red-400">{fmtQ(it.dejado_de_ganar)}</span> : '-'}</td>
                      <td className="py-2 pl-1 text-center">
                        {it.semaforo && (
                          <span className={`inline-block w-3 h-3 rounded-full ${it.semaforo === 'rojo' ? 'bg-red-500' : it.semaforo === 'ambar' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold mb-4">Margen % vs año anterior (top 12 por ventas)</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafica} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip formatter={(v) => fmtPct(v)} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[0, 4, 4, 0]} />
                <Bar dataKey="anterior" fill="#94a3b8" name="Año anterior" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
