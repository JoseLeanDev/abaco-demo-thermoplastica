import { useMemo, useState } from 'react'
import { ArrowDownTrayIcon, MagnifyingGlassIcon, TagIcon } from '@heroicons/react/24/outline'
import { Cargando, Delta, Mini, Seccion, Th, exportarCSV, fmtInt, fmtM, fmtPrecio, ordenar, td } from './comun'

const VISTAS = [['todos', 'Todos'], ['subieron', 'Subieron'], ['bajaron', 'Bajaron']]

export default function TabPrecios({ precios: d }) {
  const [vista, setVista] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState({ col: 'impacto_abs', dir: 'desc' })

  const items = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = (d?.items || [])
      .map(i => ({ ...i, impacto_abs: Math.abs(i.impacto) }))
      .filter(i => vista === 'todos' || (vista === 'subieron' ? i.variacion_precio_pct > 0.5 : i.variacion_precio_pct < -0.5))
      .filter(i => !q || i.nombre?.toLowerCase().includes(q) || String(i.clave).toLowerCase().includes(q))
    return ordenar(base, orden)
  }, [d, vista, busqueda, orden])

  if (!d) return <Cargando alto="h-96" />

  const cobertura = d.gasto_inventario > 0 ? Math.round(d.base_comparable / d.gasto_inventario * 100) : 0
  const exportar = () => exportarCSV('variacion_precios_compras.csv', [
    { label: 'Código', get: i => i.clave },
    { label: 'Artículo', get: i => i.nombre },
    { label: 'Categoría', get: i => i.extra },
    { label: 'Último proveedor', get: i => i.proveedor_ultimo },
    { label: 'Precio año anterior', get: i => i.precio_promedio_prev?.toFixed(4) },
    { label: 'Precio período', get: i => i.precio_promedio?.toFixed(4) },
    { label: 'Variación %', get: i => i.variacion_precio_pct },
    { label: 'Último precio', get: i => i.precio_ultimo?.toFixed(4) },
    { label: 'Unidades período', get: i => i.unidades },
    { label: 'Impacto Q', get: i => i.impacto.toFixed(2) },
  ], items)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini titulo="Variación de precios" leyenda="inflacion_compras" valor={<Delta v={d.inflacion_pct} invertir />} sub="promedio ponderado por lo comprado" />
        <Mini titulo="Sobrecosto" leyenda="sobrecosto_precio" valor={<span className="text-[var(--danger)]">{fmtM(d.sobrecosto)}</span>} sub={`${fmtInt(d.n_subieron)} artículos subieron de precio`} />
        <Mini titulo="Ahorro" leyenda="sobrecosto_precio" valor={<span className="text-[var(--success)]">{fmtM(-d.ahorro)}</span>} sub={`${fmtInt(d.n_bajaron)} artículos bajaron de precio`} />
        <Mini titulo="Cobertura" leyenda="cobertura_precios" valor={`${cobertura}%`} sub={`${fmtInt(d.n_comparables)} artículos comprados en ambos períodos`} />
      </div>

      <Seccion
        icon={TagIcon}
        titulo="Cambio de precio por artículo"
        leyenda="inflacion_compras"
        subtitulo="Materiales e insumos comprados en ambos períodos, ordenados por impacto en Q"
        sinPadding
        extra={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-[var(--border-default)] overflow-hidden text-xs">
              {VISTAS.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setVista(id)}
                  className={`px-3 py-1.5 font-medium ${vista === id ? 'bg-[#001639] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setBusqueda('')}
                placeholder="Artículo o código…"
                className="input py-1.5 pl-8 text-sm w-44"
              />
            </div>
            <button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1">
              <ArrowDownTrayIcon className="w-4 h-4" /> CSV
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
              <tr>
                <Th col="nombre" orden={orden} setOrden={setOrden} align="left">Artículo</Th>
                <Th col="precio_promedio_prev" orden={orden} setOrden={setOrden} leyenda="precio_unitario_compra">Precio año ant.</Th>
                <Th col="precio_promedio" orden={orden} setOrden={setOrden}>Precio período</Th>
                <Th col="variacion_precio_pct" orden={orden} setOrden={setOrden}>Variación</Th>
                <Th col="precio_ultimo" orden={orden} setOrden={setOrden}>Último precio</Th>
                <Th col="unidades" orden={orden} setOrden={setOrden}>Unidades</Th>
                <Th col="impacto_abs" orden={orden} setOrden={setOrden} leyenda="sobrecosto_precio">Impacto</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin artículos comparables en el filtro.</td></tr>
              )}
              {items.map(i => (
                <tr key={i.clave} className="hover:bg-[var(--bg-secondary)]">
                  <td className={`${td} max-w-[320px]`}>
                    <p className="font-medium truncate" title={i.nombre}>{i.nombre}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{i.clave} · {i.extra}{i.proveedor_ultimo ? ` · ${i.proveedor_ultimo}` : ''}</p>
                  </td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{fmtPrecio(i.precio_promedio_prev)}</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtPrecio(i.precio_promedio)}</td>
                  <td className={`${td} text-right`}><Delta v={i.variacion_precio_pct} invertir /></td>
                  <td className={`${td} text-right tabular-nums`}>
                    {fmtPrecio(i.precio_ultimo)}
                    {i.precio_min !== null && i.precio_max > i.precio_min * 1.01 && (
                      <span className="block text-[10px] text-[var(--text-muted)]">rango {fmtPrecio(i.precio_min)}–{fmtPrecio(i.precio_max)}</span>
                    )}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(Math.round(i.unidades))}</td>
                  <td className={`${td} text-right tabular-nums font-semibold ${i.impacto > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                    {i.impacto > 0 ? '+' : '−'}{fmtM(Math.abs(i.impacto))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
      <p className="text-xs text-[var(--text-muted)]">
        Precio = compras sin IVA ÷ unidades de cada período. Los servicios, fletes y gastos no se comparan porque no tienen un precio unitario estable.
      </p>
    </div>
  )
}
