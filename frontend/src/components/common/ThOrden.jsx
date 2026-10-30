// Encabezado de tabla que ordena al hacer clic: texto empieza A→Z, números de mayor a menor;
// un segundo clic invierte el orden.
export default function ThOrden({ k, orden, setOrden, texto = false, align = 'left', className = '', children }) {
  const activo = orden.k === k
  const alClic = () => setOrden(o => o.k === k
    ? { k, dir: o.dir === 'asc' ? 'desc' : 'asc' }
    : { k, dir: texto ? 'asc' : 'desc' })
  return (
    <th
      onClick={alClic}
      title="Ordenar"
      className={`px-4 py-3 text-${align} text-xs font-semibold uppercase cursor-pointer select-none hover:text-[var(--text-secondary)] ${activo ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} ${className}`}
    >
      {children}
      <span className={`ml-1 ${activo ? '' : 'opacity-30'}`}>{activo ? (orden.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  )
}
