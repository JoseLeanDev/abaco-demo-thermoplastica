import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Seccion, Th, fmtInt, fmtQ, ordenar, td, Cargando } from '../compras/comun'
import { Semaforo } from './TabProductos'

const fmtPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}%`)

// Margen por vendedor o por cliente (respeta el filtro de producto de la página).
// A la derecha, participación en ventas como barras: con 30 clientes un pie no se lee.
export default function TabRanking({ icon, titulo, singular, items, isLoading, nota }) {
  const cpp = items.some(i => i.es_cpp)
  const [orden, setOrden] = useState({ col: 'ventas_12m', dir: 'desc' })
  const [busqueda, setBusqueda] = useState('')

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ordenar(items.filter(i => !q || i.nombre.toLowerCase().includes(q)), orden)
  }, [items, orden, busqueda])

  const total = items.reduce((s, i) => s + i.ventas_12m, 0)
  const top = [...items].sort((a, b) => b.ventas_12m - a.ventas_12m).slice(0, 12)
  const max = Math.max(1, ...top.map(i => i.ventas_12m))
  const rojos = items.filter(i => i.semaforo === 'rojo').length

  if (isLoading) return <Cargando alto="h-96" />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Seccion
          icon={icon}
          titulo={titulo}
          leyenda="semaforo_margen"
          subtitulo={`${fmtInt(items.length)} ${singular}s${nota ? ` ${nota}` : ''} · ${rojos} en rojo`}
          sinPadding
        >
          <div className="px-5 pb-3">
            <div className="relative w-full sm:w-72">
              <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar ${singular}…`}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] pl-8 pr-3 py-1.5 text-sm outline-none focus:border-[var(--text-muted)]"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
                <tr>
                  <Th col="nombre" orden={orden} setOrden={setOrden} align="left">{singular}</Th>
                  <Th col="ventas_12m" orden={orden} setOrden={setOrden}>Ventas</Th>
                  <Th col="margen_pct_actual" orden={orden} setOrden={setOrden} leyenda={cpp ? 'margen_mp' : 'margen_bruto'}>Margen</Th>
                  <Th col="margen_pct_historico" orden={orden} setOrden={setOrden} leyenda="vs_anio_anterior">Año ant.</Th>
                  <Th col="delta_puntos" orden={orden} setOrden={setOrden} leyenda="margen_pts">Δ pts</Th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filas.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin resultados.</td></tr>}
                {filas.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--bg-secondary)]">
                    <td className={`${td} max-w-[320px]`}><p className="font-medium nombre-articulo">{r.nombre}</p></td>
                    <td className={`${td} text-right tabular-nums`}>{fmtQ(r.ventas_12m)}</td>
                    <td className={`${td} text-right tabular-nums font-semibold`}>{fmtPct(r.margen_pct_actual)}</td>
                    <td className={`${td} text-right tabular-nums text-[var(--text-muted)]`}>{fmtPct(r.margen_pct_historico)}</td>
                    <td className={`${td} text-right tabular-nums font-medium`}>
                      <span className={r.delta_puntos < -1 ? 'text-red-500' : r.delta_puntos > 1 ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}>
                        {r.delta_puntos === null ? '—' : `${r.delta_puntos > 0 ? '+' : ''}${Number(r.delta_puntos).toFixed(1)}`}
                      </span>
                    </td>
                    <td className={`${td} text-center`}><Semaforo s={r.semaforo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      </div>

      <div className="card p-5 self-start">
        <h3 className="font-semibold mb-1">Participación en ventas</h3>
        <p className="text-xs text-[var(--text-muted)] mb-4">Top {top.length} {singular}s · % sobre los listados · margen % a la derecha</p>
        <div className="space-y-2.5">
          {top.map(i => (
            <div key={i.id} className="text-xs">
              <div className="flex justify-between gap-2 mb-0.5">
                <span className="nombre-articulo text-[var(--text-secondary)]">{i.nombre}</span>
                <span className="tabular-nums shrink-0 font-semibold">{fmtPct(i.margen_pct_actual)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded bg-[var(--bg-secondary)] overflow-hidden">
                  <div className="h-full rounded bg-[#001639]" style={{ width: `${i.ventas_12m / max * 100}%` }} />
                </div>
                <span className="w-24 text-right tabular-nums text-[var(--text-muted)]">{fmtQ(i.ventas_12m)} · {total > 0 ? Math.round(i.ventas_12m / total * 100) : 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
