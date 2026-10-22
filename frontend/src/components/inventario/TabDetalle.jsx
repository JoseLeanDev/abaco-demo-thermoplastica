import { useMemo, useState } from 'react'
import { ArrowDownTrayIcon, ListBulletIcon, MagnifyingGlassIcon, TruckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Seccion, Th, exportarExcel, fmtInt, fmtM, fmtQ, ordenar, td } from '../compras/comun'
import { ABC, CLASE, ESTADO, TRAMOS, excesoDe, fmtDias, fmtNum, normalizar } from './datos'
import { colorDias } from './TabResumen'
import { EstadoBadge } from './TabAccion'

export const RAPIDOS = [
  { id: 'todos',               label: 'Todos los artículos',            fn: () => true },
  { id: 'con_stock',           label: 'Con stock',                      fn: f => f.valor > 0 },
  { id: 'sin_stock',           label: 'Sin stock (con movimiento)',     fn: f => f.stock <= 0 },
  { id: 'quiebre',             label: 'Quiebres de stock',              fn: f => f.quiebre },
  { id: 'exceso',              label: 'Con exceso sobre el objetivo',   fn: (f, x) => x > 0 },
  { id: 'quieto',              label: 'Capital quieto (lento + inmovilizado)', fn: f => f.estado === 'lento' || f.estado === 'inmovilizado' },
  { id: 'estado_activo',       label: 'Estado: activo',                 fn: f => f.estado === 'activo' },
  { id: 'estado_lento',        label: 'Estado: lento',                  fn: f => f.estado === 'lento' },
  { id: 'estado_por_validar', label: 'Consumo por validar', fn: f => f.estado === 'por_validar' },
  { id: 'estado_inmovilizado', label: 'Estado: inmovilizado',           fn: f => f.estado === 'inmovilizado' },
  { id: 'transito',            label: 'Con stock en tránsito',          fn: f => f.transito > 0 },
  { id: 'sin_precio',          label: 'Con stock y sin precio de venta', fn: f => f.valor > 0 && f.clase === 'producto' && !(f.precio > 0) },
]

export const COLUMNAS_DETALLE = (dias, objetivo) => [
  { label: 'Código', get: f => f.codigo },
  { label: 'Artículo', get: f => f.descripcion },
  { label: 'Categoría', get: f => f.categoria },
  { label: 'Subcategoría', get: f => f.subcategoria },
  { label: 'Sublínea', get: f => f.sublinea },
  { label: 'Proveedor principal', get: f => f.proveedor || '' },
  { label: 'Tipo', get: f => CLASE[f.clase]?.label },
  { label: 'Estado', get: f => ESTADO[f.estado]?.label },
  { label: 'ABC', get: f => (f.abc === 'N' ? 'Sin salida' : f.abc) },
  { label: 'Stock', get: f => f.stock },
  { label: 'En tránsito', get: f => f.transito },
  { label: 'Costo promedio', get: f => f.costo },
  { label: 'Valor en stock', get: f => f.valor.toFixed(2) },
  { label: 'Salida del período', get: f => f.salida ?? '' },
  { label: 'Salida mensual', get: f => f.salida === null ? '' : (f.salida / dias * 30).toFixed(2) },
  { label: 'Días de cobertura', get: f => f.dias_cobertura ?? '' },
  { label: `Exceso sobre ${objetivo} días`, get: f => excesoDe(f, dias, objetivo)?.toFixed(2) ?? '' },
  { label: 'Quiebre', get: f => (f.quiebre ? 'Sí' : '') },
  { label: 'Precio de venta 1', get: f => f.precio || '' },
  { label: 'Margen de lista %', get: f => f.margen ?? '' },
  { label: 'Ventas del período', get: f => f.ventas },
  { label: 'Compras del período', get: f => f.compras },
  { label: 'Última venta', get: f => f.ultima_venta || '' },
  { label: 'Última compra', get: f => f.ultima_compra || '' },
]

const PAGINA = 100

export default function TabDetalle({ filas, dias, objetivo, vista, setVista }) {
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState({ col: 'valor', dir: 'desc' })
  const [mostrar, setMostrar] = useState(PAGINA)

  const rapido = RAPIDOS.find(r => r.id === vista.rapido) || RAPIDOS[0]
  const tramo = TRAMOS.find(t => t.id === vista.tramo)

  const lista = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean)
    const rs = filas
      .map(f => ({ ...f, exceso: excesoDe(f, dias, objetivo), salida_mes: f.salida / dias * 30 }))
      .filter(f =>
        rapido.fn(f, f.exceso) &&
        (!tramo || f.tramo === tramo.id) &&
        (!palabras.length || palabras.every(p => normalizar(`${f.codigo} ${f.descripcion} ${f.proveedor || ''} ${f.sublinea}`).includes(p)))
      )
    return ordenar(rs, orden)
  }, [filas, dias, objetivo, rapido, tramo, busqueda, orden])
  const suma = lista.reduce((s, f) => s + f.valor, 0)

  const exportar = () => exportarExcel('inventario_detalle.xlsx', COLUMNAS_DETALLE(dias, objetivo), lista)

  return (
    <Seccion
      icon={ListBulletIcon}
      titulo="Detalle por artículo"
      subtitulo={`${fmtInt(lista.length)} artículos · ${fmtM(suma)} en stock`}
      sinPadding
      extra={<button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> Excel</button>}
    >
      <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setMostrar(PAGINA) }}
            onKeyDown={(e) => e.key === 'Escape' && setBusqueda('')}
            placeholder="Código, artículo, proveedor o sublínea…"
            className="input py-1.5 pl-8 text-sm w-72 max-w-full"
          />
        </div>
        <select
          value={rapido.id}
          onChange={(e) => { setVista(v => ({ ...v, rapido: e.target.value })); setMostrar(PAGINA) }}
          className="input py-1.5 text-sm w-auto max-w-full"
        >
          {RAPIDOS.map(r => <option key={r.id} value={r.id}>{r.id === 'exceso' ? `Con exceso sobre ${objetivo} días` : r.label}</option>)}
        </select>
        {tramo && (
          <span className="flex items-center gap-1 rounded-lg border border-[#001639] bg-[#001639] text-white px-2.5 py-1 text-xs">
            Cobertura {tramo.label}
            <button onClick={() => setVista(v => ({ ...v, tramo: '' }))} className="ml-1 text-white/70 hover:text-white" aria-label="Quitar tramo">
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
            <tr>
              <Th col="descripcion" orden={orden} setOrden={setOrden} align="left">Artículo</Th>
              <Th col="subcategoria" orden={orden} setOrden={setOrden} align="left">Subcategoría / sublínea</Th>
              <Th col="estado" orden={orden} setOrden={setOrden} align="left">Estado</Th>
              <Th col="abc" orden={orden} setOrden={setOrden} align="left" leyenda="inv_abc">ABC</Th>
              <Th col="stock" orden={orden} setOrden={setOrden}>Stock</Th>
              <Th col="costo" orden={orden} setOrden={setOrden}>Costo prom.</Th>
              <Th col="valor" orden={orden} setOrden={setOrden}>Valor</Th>
              <Th col="salida_mes" orden={orden} setOrden={setOrden} leyenda="inv_salida">Salida/mes</Th>
              <Th col="dias_cobertura" orden={orden} setOrden={setOrden} leyenda="inv_cobertura">Cobertura</Th>
              <Th col="exceso" orden={orden} setOrden={setOrden} leyenda="inv_exceso">Exceso</Th>
              <Th col="dias_sin_mov" orden={orden} setOrden={setOrden} leyenda="inv_dias_sin_mov">Sin mov.</Th>
              <Th col="margen" orden={orden} setOrden={setOrden} leyenda="margen_teorico">Margen lista</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {lista.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                {busqueda ? `Ningún artículo coincide con "${busqueda}".` : 'Sin artículos en el filtro.'}
              </td></tr>
            )}
            {lista.slice(0, mostrar).map(f => (
              <tr key={f.codigo} className="hover:bg-[var(--bg-secondary)]">
                <td className={`${td} max-w-[280px]`}>
                  <p className="font-medium truncate" title={f.descripcion}>{f.descripcion}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {f.codigo} · {CLASE[f.clase]?.corto}{f.proveedor ? ` · ${f.proveedor}` : ''}
                  </p>
                </td>
                <td className={`${td} max-w-[180px] text-[var(--text-secondary)]`}>
                  <p className="truncate" title={f.subcategoria}>{f.subcategoria}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate" title={f.sublinea}>{f.sublinea}</p>
                </td>
                <td className={td}>
                  <EstadoBadge estado={f.estado} />
                  {f.quiebre && <span className="block mt-0.5 text-[10px] font-semibold text-[var(--danger)] uppercase">Quiebre</span>}
                </td>
                <td className={`${td} font-semibold`}>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: ABC[f.abc]?.color }} />{f.abc === 'N' ? '—' : f.abc}</span>
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  <span className={f.stock > 0 ? '' : 'text-[var(--text-muted)]'}>{fmtNum(f.stock)}</span>
                  {f.transito > 0 && (
                    <p className="text-xs text-[var(--warning)]"><TruckIcon className="w-3 h-3 inline mr-0.5" />{fmtNum(f.transito)}</p>
                  )}
                </td>
                <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{f.costo > 0 ? fmtQ(f.costo) : '—'}</td>
                <td className={`${td} text-right tabular-nums font-semibold`}>{f.valor > 0 ? fmtM(f.valor) : '—'}</td>
                <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{f.salida > 0 ? fmtM(f.salida_mes) : '—'}</td>
                <td className={`${td} text-right tabular-nums font-medium ${colorDias(f.dias_cobertura)}`}>
                  {f.valor > 0 ? (f.dias_cobertura === null ? (f.estado === 'por_validar' ? 'por validar' : 'sin venta medida') : fmtDias(f.dias_cobertura)) : '—'}
                </td>
                <td className={`${td} text-right tabular-nums ${f.exceso > 0 ? 'text-amber-600 font-semibold' : 'text-[var(--text-muted)]'}`}>{f.exceso > 0 ? fmtM(f.exceso) : '—'}</td>
                <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{fmtDias(f.dias_sin_mov)}</td>
                <td className={`${td} text-right tabular-nums ${
                  f.margen === null || !(f.precio > 0) ? 'text-[var(--text-muted)]' : f.margen >= 30 ? 'text-[var(--success)]' : f.margen >= 15 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
                }`}>
                  {f.precio > 0 && f.margen !== null ? `${f.margen.toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lista.length > mostrar && (
        <div className="px-5 py-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Mostrando {fmtInt(mostrar)} de {fmtInt(lista.length)}</span>
          <button onClick={() => setMostrar(m => m + PAGINA * 2)} className="text-[var(--accent-blue)] hover:underline">Mostrar más</button>
        </div>
      )}
    </Seccion>
  )
}
