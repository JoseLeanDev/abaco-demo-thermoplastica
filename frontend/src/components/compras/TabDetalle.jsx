import { useEffect, useState } from 'react'
import { useQuery } from 'react-query'
import { MagnifyingGlassIcon, ReceiptPercentIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { TIPO, fmtInt, fmtPrecio, fmtQ, td, th } from './comun'

const PAGINA = 200

// Columnas del CSV de líneas (también lo usa el botón "Exportar líneas" del encabezado)
export const COLUMNAS_DETALLE = [
  { label: 'Fecha', get: f => String(f.fecha_emision).slice(0, 10) },
  { label: 'Documento', get: f => `${f.tipo_doc} ${f.fact_num}` },
  { label: 'Código proveedor', get: f => f.codigo_proveedor },
  { label: 'Proveedor', get: f => f.proveedor },
  { label: 'Código artículo', get: f => f.codigo_articulo },
  { label: 'Artículo', get: f => f.articulo },
  { label: 'Categoría', get: f => f.categoria },
  { label: 'Subcategoría', get: f => f.subcategoria },
  { label: 'Sublínea', get: f => f.sublinea },
  { label: 'Tipo de compra', get: f => f.tipo_label },
  { label: 'Unidades', get: f => f.unidades },
  { label: 'Precio unitario', get: f => f.precio_unitario?.toFixed(4) ?? '' },
  { label: 'Total sin IVA', get: f => f.total_sin_iva.toFixed(2) },
  { label: 'IVA', get: f => f.iva.toFixed(2) },
  { label: 'Total con IVA', get: f => f.total_con_iva.toFixed(2) },
  { label: 'Sucursal', get: f => f.sucursal },
]

export default function TabDetalle({ filtros, clave }) {
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [limite, setLimite] = useState(PAGINA)
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 300)
    return () => clearTimeout(t)
  }, [texto])
  useEffect(() => setLimite(PAGINA), [clave, busqueda])

  const { data, isFetching } = useQuery(
    ['compras-detalle', clave, busqueda, limite],
    () => endpoints.compras.detalle({ ...filtros, busqueda, limit: limite }),
    { keepPreviousData: true }
  )
  const d = data?.data
  const filas = d?.filas || []

  return (
    <div className="space-y-4">
      <div className="relative">
        <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar por proveedor, artículo, código o número de factura…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setTexto('')}
          className="input w-full pl-12 pr-10"
        />
        {texto && (
          <button onClick={() => setTexto('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Borrar búsqueda">
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] flex-wrap gap-2">
          <span className="text-sm text-[var(--text-muted)] flex items-center gap-2">
            <ReceiptPercentIcon className="w-5 h-5" />
            {isFetching && !d ? 'Cargando…' : `${fmtInt(filas.length)} de ${fmtInt(d?.total_filas)} líneas · ${fmtInt(d?.facturas)} facturas`}
          </span>
          <span className="text-sm font-semibold">Total sin IVA: {fmtQ(d?.suma_sin_iva_filtrada)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <th className={`${th} text-left`}>Fecha</th>
                <th className={`${th} text-left`}>Documento</th>
                <th className={`${th} text-left`}>Proveedor</th>
                <th className={`${th} text-left`}>Artículo</th>
                <th className={`${th} text-left`}>Categoría</th>
                <th className={`${th} text-right`}>Unid.</th>
                <th className={`${th} text-right`}>Precio unit.</th>
                <th className={`${th} text-right`}>Sin IVA</th>
                <th className={`${th} text-right`}>IVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    {isFetching ? 'Cargando…' : 'Sin líneas que coincidan con el filtro.'}
                  </td>
                </tr>
              )}
              {filas.map(f => (
                <tr key={f.id} className="hover:bg-[var(--bg-secondary)]">
                  <td className={`${td} text-[var(--text-secondary)] tabular-nums`}>{String(f.fecha_emision).slice(0, 10)}</td>
                  <td className={td}>
                    <p className="font-medium">{f.tipo_doc} {f.fact_num}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.sucursal}</p>
                  </td>
                  <td className={`${td} max-w-[200px]`}>
                    <p className="font-medium truncate" title={f.proveedor}>{f.proveedor}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.codigo_proveedor}</p>
                  </td>
                  <td className={`${td} max-w-[240px]`}>
                    <p className="truncate" title={f.articulo}>{f.articulo || f.codigo_articulo}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.codigo_articulo}</p>
                  </td>
                  <td className={`${td} max-w-[200px]`}>
                    <p className="text-[var(--text-secondary)] truncate">{f.categoria} › {f.subcategoria}</p>
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: TIPO[f.tipo]?.color }} />
                      {TIPO[f.tipo]?.corto}
                    </p>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(f.unidades)}</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{fmtPrecio(f.precio_unitario)}</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(f.total_sin_iva)}</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-muted)]`}>{fmtQ(f.iva)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d && filas.length < d.total_filas && (
          <div className="p-3 border-t border-[var(--border-default)] text-center">
            <button onClick={() => setLimite(l => l + PAGINA)} disabled={isFetching} className="btn-secondary text-sm disabled:opacity-60">
              {isFetching ? 'Cargando…' : `Cargar ${fmtInt(Math.min(PAGINA, d.total_filas - filas.length))} más`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
