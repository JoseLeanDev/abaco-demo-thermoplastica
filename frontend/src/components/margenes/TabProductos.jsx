import { useMemo, useState } from 'react'
import { ArrowDownTrayIcon, MagnifyingGlassIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Seccion, Th, exportarCSV, fmtInt, fmtPrecio, fmtQ, ordenar, td } from '../compras/comun'
import DetalleProducto from './DetalleProducto'

const fmtPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}%`)

export const SEMAFOROS = [
  { id: '',      label: 'Todos' },
  { id: 'rojo',  label: 'Rojo',  dot: 'bg-red-500' },
  { id: 'ambar', label: 'Ámbar', dot: 'bg-amber-500' },
  { id: 'verde', label: 'Verde', dot: 'bg-emerald-500' },
]

export function Semaforo({ s }) {
  const c = SEMAFOROS.find(x => x.id === s)
  return c?.dot ? <span className={`inline-block w-3 h-3 rounded-full ${c.dot}`} title={c.label} /> : null
}

const MAX_FILAS = 200

// Todos los productos con ventas en el período (respetan el filtro de producto
// de la página): búsqueda por nombre o código, semáforo y detalle en panel.
export default function TabProductos({ productos, semaforo, setSemaforo }) {
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState({ col: 'ventas', dir: 'desc' })
  const [seleccion, setSeleccion] = useState(null)

  const conteo = useMemo(() => {
    const c = { '': productos.length }
    for (const p of productos) c[p.semaforo] = (c[p.semaforo] || 0) + 1
    return c
  }, [productos])

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const out = productos.filter(p =>
      (!semaforo || p.semaforo === semaforo) &&
      (!q || p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    )
    return ordenar(out, orden)
  }, [productos, semaforo, busqueda, orden])

  const exportar = () => exportarCSV('margen_por_producto.csv', [
    { label: 'Código', get: p => p.sku },
    { label: 'Producto', get: p => p.nombre },
    { label: 'Categoría', get: p => p.categoria },
    { label: 'Subcategoría', get: p => p.subcategoria },
    { label: 'Sublínea', get: p => p.sublinea },
    { label: 'Ventas', get: p => p.ventas },
    { label: 'Unidades', get: p => p.unidades_12m },
    { label: 'Precio unitario', get: p => p.precio_actual },
    { label: 'Costo unitario', get: p => p.costo_actual },
    { label: 'Margen %', get: p => p.margen_pct_actual },
    { label: 'Margen % año anterior', get: p => p.margen_pct_historico ?? '' },
    { label: 'Variación (pts)', get: p => p.delta_puntos ?? '' },
    { label: 'Semáforo', get: p => p.semaforo },
  ], filas)

  return (
    <>
      <Seccion
        icon={TagIcon}
        titulo="Margen por producto"
        leyenda="semaforo_margen"
        subtitulo={`${fmtInt(filas.length)} de ${fmtInt(productos.length)} productos con ventas ≥ Q1,000 en el período · clic en una fila para ver el detalle`}
        sinPadding
        extra={<button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>}
      >
        <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto o código…"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] pl-8 pr-7 py-1.5 text-sm outline-none focus:border-[var(--text-muted)]"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Limpiar búsqueda">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SEMAFOROS.map(s => (
              <button
                key={s.id}
                onClick={() => setSemaforo(s.id)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  semaforo === s.id
                    ? 'border-[#001639] bg-[#001639] text-white'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                }`}
              >
                {s.dot && <span className={`w-2 h-2 rounded-full ${s.dot}`} />}
                {s.label} <span className="opacity-70 tabular-nums">{fmtInt(conteo[s.id] || 0)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)] sticky top-0 z-10">
              <tr>
                <Th col="nombre" orden={orden} setOrden={setOrden} align="left">Producto</Th>
                <Th col="ventas" orden={orden} setOrden={setOrden}>Ventas</Th>
                <Th col="precio_actual" orden={orden} setOrden={setOrden}>Precio</Th>
                <Th col="costo_actual" orden={orden} setOrden={setOrden} leyenda="costo_unitario">Costo</Th>
                <Th col="margen_pct_actual" orden={orden} setOrden={setOrden} leyenda="margen_bruto">Margen</Th>
                <Th col="margen_pct_historico" orden={orden} setOrden={setOrden} leyenda="vs_anio_anterior">Año ant.</Th>
                <Th col="delta_puntos" orden={orden} setOrden={setOrden} leyenda="margen_pts">Δ pts</Th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  {busqueda ? `Ningún producto coincide con "${busqueda}".` : 'Sin productos en el filtro actual.'}
                </td></tr>
              )}
              {filas.slice(0, MAX_FILAS).map(p => (
                <tr key={p.id} onClick={() => setSeleccion(p)} className="hover:bg-[var(--bg-secondary)] cursor-pointer">
                  <td className={`${td} max-w-[360px]`}>
                    <p className="font-medium truncate" title={p.nombre}>{p.nombre}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{p.sku} · {p.subcategoria}</p>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{fmtQ(p.ventas)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtPrecio(p.precio_actual)}</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{fmtPrecio(p.costo_actual)}</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtPct(p.margen_pct_actual)}</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-muted)]`}>{fmtPct(p.margen_pct_historico)}</td>
                  <td className={`${td} text-right tabular-nums font-medium`}>
                    {p.delta_puntos === null ? <span className="text-[var(--text-muted)]">—</span> : (
                      <span className={p.delta_puntos < -1 ? 'text-red-500' : p.delta_puntos > 1 ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}>
                        {p.delta_puntos > 0 ? '+' : ''}{p.delta_puntos.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className={`${td} text-center`}><Semaforo s={p.semaforo} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length > MAX_FILAS && <p className="px-5 py-3 text-xs text-[var(--text-muted)]">Mostrando {MAX_FILAS} de {fmtInt(filas.length)}; usa la búsqueda o los filtros para acotar. El CSV trae todos.</p>}
        </div>
      </Seccion>

      {seleccion && <DetalleProducto producto={seleccion} onClose={() => setSeleccion(null)} />}
    </>
  )
}
