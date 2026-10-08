import { useQuery } from 'react-query'
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { usePeriodo } from '../../context/PeriodoContext'

// Filtro de producto (Categoría › Subcategoría) para los rankings de Ventas.
// value = { categoria, subcategoria }; los strings vacíos significan "todas".
export default function FiltroProducto({ value, onChange }) {
  const { desde, hasta } = usePeriodo()
  const { data: catRes } = useQuery(
    ['filtro-prod-cat', desde, hasta],
    () => endpoints.ventas.desglose({ desde, hasta, dim: 'categoria', limit: 100 }),
    { keepPreviousData: true, staleTime: 5 * 60 * 1000 }
  )
  const { data: subRes } = useQuery(
    ['filtro-prod-sub', desde, hasta, value.categoria],
    () => endpoints.ventas.desglose({ desde, hasta, dim: 'subcategoria', categoria: value.categoria, limit: 200 }),
    { keepPreviousData: true, staleTime: 5 * 60 * 1000, enabled: !!value.categoria }
  )
  const categorias = catRes?.data?.items || []
  const subcategorias = value.categoria ? (subRes?.data?.items || []) : []
  const activo = value.categoria || value.subcategoria

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="flex items-center gap-1 text-[var(--text-muted)]">
        <FunnelIcon className="w-4 h-4" /> Producto
      </span>
      <select
        className="input py-1 text-xs w-auto"
        value={value.categoria}
        onChange={(e) => onChange({ categoria: e.target.value, subcategoria: '' })}
        aria-label="Categoría"
      >
        <option value="">Todas las categorías</option>
        {categorias.map(c => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
      </select>
      {value.categoria && (
        <select
          className="input py-1 text-xs w-auto"
          value={value.subcategoria}
          onChange={(e) => onChange({ ...value, subcategoria: e.target.value })}
          aria-label="Subcategoría"
        >
          <option value="">Todas las subcategorías</option>
          {subcategorias.map(c => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
        </select>
      )}
      {activo && (
        <button onClick={() => onChange({ categoria: '', subcategoria: '' })} className="flex items-center gap-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <XMarkIcon className="w-3.5 h-3.5" /> Quitar
        </button>
      )}
    </div>
  )
}
