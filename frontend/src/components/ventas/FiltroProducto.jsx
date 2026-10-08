import { useQuery } from 'react-query'
import { ChevronRightIcon, CubeIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { usePeriodo } from '../../context/PeriodoContext'

// Filtro de producto de la página de Ventas: Categoría › Subcategoría › Sublínea.
// Aplica a todas las pestañas; el drill-down de Categorías solo lo va rellenando.
// value = { categoria, subcategoria, sublinea } ('' = todas).
export const NIVELES_PRODUCTO = [
  { dim: 'categoria',    singular: 'Categoría',    plural: 'Categorías',    todas: 'Todas las categorías' },
  { dim: 'subcategoria', singular: 'Subcategoría', plural: 'Subcategorías', todas: 'Todas las subcategorías' },
  { dim: 'sublinea',     singular: 'Sublínea',     plural: 'Sublíneas',     todas: 'Todas las sublíneas' },
]

export const FILTRO_VACIO = { categoria: '', subcategoria: '', sublinea: '' }

// Al cambiar un nivel se limpian los de abajo
export function cambiarNivel(value, dim, clave) {
  const out = { ...value }
  let limpiar = false
  for (const n of NIVELES_PRODUCTO) {
    if (limpiar) out[n.dim] = ''
    if (n.dim === dim) { out[dim] = clave; limpiar = true }
  }
  return out
}

function SelectorNivel({ nivel, value, filtrosArriba, onChange }) {
  const { desde, hasta } = usePeriodo()
  const { data } = useQuery(
    ['filtro-prod', nivel.dim, desde, hasta, JSON.stringify(filtrosArriba)],
    () => endpoints.ventas.desglose({ desde, hasta, ...filtrosArriba, dim: nivel.dim, limit: 300 }),
    { staleTime: 5 * 60 * 1000 }
  )
  const opciones = data?.data?.items || []
  const activo = !!value

  return (
    <label
      className={`relative flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
        activo
          ? 'border-[#001639] bg-[#001639] text-white'
          : 'border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
      }`}
      title={`Filtrar por ${nivel.singular.toLowerCase()}`}
    >
      <span className={`text-[10px] uppercase tracking-wide ${activo ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{nivel.singular}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none cursor-pointer max-w-[14rem] truncate font-medium appearance-none pr-4"
        aria-label={nivel.singular}
      >
        <option value="" className="text-black">{nivel.todas}</option>
        {opciones.map(o => (
          <option key={o.clave} value={o.clave} className="text-black">{o.nombre}</option>
        ))}
      </select>
      <span className={`pointer-events-none absolute right-2 text-[10px] ${activo ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>▾</span>
    </label>
  )
}

export default function FiltroProducto({ value, onChange }) {
  // Solo se muestra el siguiente nivel cuando el anterior está elegido
  const visibles = []
  for (const n of NIVELES_PRODUCTO) {
    visibles.push(n)
    if (!value[n.dim]) break
  }
  const activo = NIVELES_PRODUCTO.some(n => value[n.dim])

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] mr-1">
        <CubeIcon className="w-4 h-4" /> Producto
      </span>
      {visibles.map((n, i) => {
        const arriba = Object.fromEntries(NIVELES_PRODUCTO.slice(0, i).map(x => [x.dim, value[x.dim]]))
        return (
          <span key={n.dim} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            <SelectorNivel
              nivel={n}
              value={value[n.dim]}
              filtrosArriba={arriba}
              onChange={(v) => onChange(cambiarNivel(value, n.dim, v))}
            />
          </span>
        )
      })}
      {activo && (
        <button
          onClick={() => onChange(FILTRO_VACIO)}
          className="ml-1 flex items-center gap-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <XMarkIcon className="w-3.5 h-3.5" /> Quitar filtro
        </button>
      )}
    </div>
  )
}
