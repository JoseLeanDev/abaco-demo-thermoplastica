import { useMemo, useState } from 'react'
import { ListBulletIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Seccion, Th, fmtFecha, fmtInt, ordenar, td } from '../compras/comun'
import { fmtNum, normalizar } from './datos'

// Inventario en unidades, para los roles que ven existencias pero no montos en Q
// (Inventario, Gerente y Asistente de Ventas, Ejecutivo). El backend ya quita los montos.
export const COLUMNAS_EXISTENCIAS = [
  { label: 'Código', get: f => f.codigo },
  { label: 'Artículo', get: f => f.descripcion },
  { label: 'Categoría', get: f => f.categoria },
  { label: 'Subcategoría', get: f => f.subcategoria },
  { label: 'Sublínea', get: f => f.sublinea },
  { label: 'Stock', get: f => f.stock },
  { label: 'En tránsito', get: f => f.transito },
  { label: 'Unidades vendidas', get: f => f.unidades_vendidas },
  { label: 'Unidades compradas', get: f => f.unidades_compradas },
  { label: 'Última venta', get: f => f.ultima_venta || '' },
  { label: 'Última compra', get: f => f.ultima_compra || '' },
]

const PAGINA = 100

export default function Existencias({ filas }) {
  const [busqueda, setBusqueda] = useState('')
  const [soloConStock, setSoloConStock] = useState(true)
  const [orden, setOrden] = useState({ col: 'stock', dir: 'desc' })
  const [mostrar, setMostrar] = useState(PAGINA)

  const lista = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean)
    const rs = filas.filter(f =>
      (!soloConStock || f.stock > 0) &&
      (!palabras.length || palabras.every(p => normalizar(`${f.codigo} ${f.descripcion} ${f.sublinea}`).includes(p)))
    )
    return ordenar(rs, orden)
  }, [filas, busqueda, soloConStock, orden])

  return (
    <Seccion
      icon={ListBulletIcon}
      titulo="Existencias por artículo"
      subtitulo={`${fmtInt(lista.length)} artículos · cantidades en la unidad del artículo`}
      sinPadding
      extra={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] whitespace-nowrap">
            <input type="checkbox" checked={soloConStock} onChange={e => setSoloConStock(e.target.checked)} className="w-3.5 h-3.5 rounded" />
            Solo con stock
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setMostrar(PAGINA) }}
              placeholder="Buscar código o artículo…"
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[var(--border-default)] w-56"
            />
          </div>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <Th col="descripcion" orden={orden} setOrden={setOrden} align="left">Artículo</Th>
              <Th col="categoria" orden={orden} setOrden={setOrden} align="left">Categoría</Th>
              <Th col="stock" orden={orden} setOrden={setOrden}>Stock</Th>
              <Th col="transito" orden={orden} setOrden={setOrden}>En tránsito</Th>
              <Th col="unidades_vendidas" orden={orden} setOrden={setOrden}>Vendidas (período)</Th>
              <Th col="ultima_venta" orden={orden} setOrden={setOrden}>Última venta</Th>
              <Th col="ultima_compra" orden={orden} setOrden={setOrden}>Última compra</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {lista.slice(0, mostrar).map(f => (
              <tr key={f.codigo} className="hover:bg-[var(--bg-secondary)]">
                <td className={`${td} max-w-[28rem]`}>
                  <p className="font-medium truncate" title={f.descripcion}>{f.descripcion}</p>
                  <p className="text-xs text-[var(--text-muted)]">{f.codigo}</p>
                </td>
                <td className={td}>
                  <p>{f.categoria}</p>
                  <p className="text-xs text-[var(--text-muted)]">{f.subcategoria}</p>
                </td>
                <td className={`${td} text-right tabular-nums font-semibold`}>{fmtNum(f.stock)}</td>
                <td className={`${td} text-right tabular-nums`}>{f.transito > 0 ? fmtNum(f.transito) : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{f.unidades_vendidas > 0 ? fmtNum(f.unidades_vendidas) : '—'}</td>
                <td className={`${td} text-right`}>{fmtFecha(f.ultima_venta)}</td>
                <td className={`${td} text-right`}>{fmtFecha(f.ultima_compra)}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">Sin artículos</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {lista.length > mostrar && (
        <div className="p-3 text-center">
          <button onClick={() => setMostrar(m => m + PAGINA)} className="text-sm text-[var(--accent-blue)] hover:underline">
            Mostrar {Math.min(PAGINA, lista.length - mostrar)} más de {fmtInt(lista.length - mostrar)}
          </button>
        </div>
      )}
    </Seccion>
  )
}
