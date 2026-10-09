import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { ArrowDownTrayIcon, ChartBarIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { cambiarNivel } from '../ventas/FiltroProducto'
import { nivelSiguiente } from './TabResumen'
import { Cargando, Delta, Seccion, Th, exportarCSV, fmtFecha, fmtInt, fmtM, fmtPrecio, fmtQ, ordenar, td, tooltipStyle } from './comun'

export default function TabCategorias({ filtros, clave, producto, setProducto }) {
  const nivel = nivelSiguiente(producto)
  const esArticulo = nivel.dim === 'articulo'
  const [orden, setOrden] = useState({ col: 'gasto', dir: 'desc' })
  const { data, isLoading } = useQuery(
    ['compras-desglose', nivel.dim, clave],
    () => endpoints.compras.desglose({ ...filtros, dim: nivel.dim, limit: 500 }),
    { keepPreviousData: true }
  )
  const d = data?.data
  const items = useMemo(() => ordenar(d?.items || [], orden), [d, orden])

  if (isLoading && !d) return <Cargando alto="h-96" />

  const top = (d?.items || []).slice(0, 10).map(i => ({ ...i, corto: i.nombre?.length > 22 ? i.nombre.slice(0, 21) + '…' : i.nombre }))
  const exportar = () => exportarCSV(`compras_por_${nivel.dim}.csv`, [
    { label: nivel.singular, get: i => i.nombre },
    ...(esArticulo ? [{ label: 'Código', get: i => i.clave }] : []),
    { label: 'Compras sin IVA', get: i => i.gasto.toFixed(2) },
    { label: 'Año anterior', get: i => i.gasto_prev.toFixed(2) },
    { label: 'Variación %', get: i => i.variacion_pct ?? '' },
    { label: '% del total', get: i => i.participacion },
    { label: 'Variación de precio %', get: i => (esArticulo ? i.variacion_precio_pct : i.inflacion_pct) ?? '' },
    { label: 'Proveedores', get: i => i.proveedores },
    { label: esArticulo ? 'Unidades' : 'Artículos', get: i => (esArticulo ? i.unidades : i.articulos) },
    { label: 'Última compra', get: i => String(i.ultima_compra || '').slice(0, 10) },
  ], items)

  return (
    <div className="space-y-6">
      {top.length > 0 && (
        <Seccion icon={ChartBarIcon} titulo={`${nivel.plural}: este período vs año anterior`} leyenda="categorias_compras">
          <ResponsiveContainer width="100%" height={Math.max(220, top.length * 34)}>
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis type="category" dataKey="corto" width={150} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtQ(v), n]} labelFormatter={(_, p) => p?.[0]?.payload?.nombre} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gasto" name="Período actual" fill="#001639" radius={[0, 4, 4, 0]} barSize={11} />
              <Bar dataKey="gasto_prev" name="Año anterior" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={11} />
            </BarChart>
          </ResponsiveContainer>
        </Seccion>
      )}

      <Seccion
        icon={Squares2X2Icon}
        titulo={`Compras por ${nivel.singular.toLowerCase()}`}
        leyenda="categorias_compras"
        subtitulo={esArticulo ? 'Último nivel de la jerarquía' : `Clic en una fila para bajar a sus ${nivelSiguiente(cambiarNivel(producto, nivel.dim, 'x')).plural.toLowerCase()}`}
        sinPadding
        extra={
          <button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1">
            <ArrowDownTrayIcon className="w-4 h-4" /> CSV
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
              <tr>
                <Th col="nombre" orden={orden} setOrden={setOrden} align="left">{nivel.singular}</Th>
                <Th col="gasto" orden={orden} setOrden={setOrden}>Compras</Th>
                <Th col="participacion" orden={orden} setOrden={setOrden}>%</Th>
                <Th col="variacion_pct" orden={orden} setOrden={setOrden}>vs año ant.</Th>
                {esArticulo ? (
                  <>
                    <Th col="unidades" orden={orden} setOrden={setOrden}>Unidades</Th>
                    <Th col="precio_promedio" orden={orden} setOrden={setOrden} leyenda="precio_unitario_compra">Precio prom.</Th>
                    <Th col="variacion_precio_pct" orden={orden} setOrden={setOrden} leyenda="inflacion_compras">Var. precio</Th>
                  </>
                ) : (
                  <>
                    <Th col="inflacion_pct" orden={orden} setOrden={setOrden} leyenda="inflacion_compras">Var. precio</Th>
                    <Th col="articulos" orden={orden} setOrden={setOrden}>Artículos</Th>
                  </>
                )}
                <Th col="proveedores" orden={orden} setOrden={setOrden}>Proveedores</Th>
                <Th col="ultima_compra" orden={orden} setOrden={setOrden}>Última compra</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin compras en el filtro.</td></tr>
              )}
              {items.map(i => (
                <tr
                  key={i.clave}
                  onClick={esArticulo ? undefined : () => setProducto(cambiarNivel(producto, nivel.dim, i.clave))}
                  className={`hover:bg-[var(--bg-secondary)] ${esArticulo ? '' : 'cursor-pointer'}`}
                >
                  <td className={`${td} max-w-[300px]`}>
                    <p className="font-medium truncate flex items-center gap-1.5">
                      <span className="truncate">{i.nombre}</span>
                      {i.nuevo && <span className="badge-success text-[10px]">Nuevo</span>}
                    </p>
                    {esArticulo && <p className="text-xs text-[var(--text-muted)]">{i.clave}{i.extra ? ` · ${i.extra}` : ''}</p>}
                  </td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(i.gasto)}</td>
                  <td className={`${td} text-right tabular-nums`}>{i.participacion}%</td>
                  <td className={`${td} text-right`}>{i.nuevo ? <span className="text-xs text-[var(--text-muted)]">nuevo</span> : <Delta v={i.variacion_pct} />}</td>
                  {esArticulo ? (
                    <>
                      <td className={`${td} text-right tabular-nums`}>{fmtInt(Math.round(i.unidades))}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtPrecio(i.precio_promedio)}</td>
                      <td className={`${td} text-right`}><Delta v={i.variacion_precio_pct} invertir /></td>
                    </>
                  ) : (
                    <>
                      <td className={`${td} text-right`}><Delta v={i.inflacion_pct} invertir /></td>
                      <td className={`${td} text-right tabular-nums`}>{fmtInt(i.articulos)}</td>
                    </>
                  )}
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(i.proveedores)}</td>
                  <td className={`${td} text-right text-[var(--text-secondary)]`}>{fmtFecha(i.ultima_compra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  )
}
