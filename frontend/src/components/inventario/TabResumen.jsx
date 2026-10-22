import { useMemo, useState } from 'react'
import { ArrowDownTrayIcon, ClockIcon, HeartIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { cambiarNivel } from '../ventas/FiltroProducto'
import { Seccion, Th, exportarExcel, fmtInt, fmtM, ordenar, td } from '../compras/comun'
import { ESTADOS, TRAMOS, agrupar, fmtDias, nivelSiguiente } from './datos'

// Barra horizontal con el % del grupo
export function BarraPct({ pct, color = '#001639' }) {
  return (
    <div className="h-1.5 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(pct, 0.5))}%`, background: color }} />
    </div>
  )
}

export const colorDias = (d) =>
  d === null ? 'text-[var(--text-muted)]' : d > 365 ? 'text-[var(--danger)]' : d > 180 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'

export default function TabResumen({ filas, tot, dias, objetivo, producto, setProducto, irDetalle }) {
  const nivel = nivelSiguiente(producto)
  const esArticulo = nivel.dim === 'articulo'
  const [orden, setOrden] = useState({ col: 'valor', dir: 'desc' })

  const grupos = useMemo(() => {
    const g = esArticulo
      ? agrupar(filas, 'codigo', dias, objetivo, f => f.descripcion)
      : agrupar(filas, nivel.dim, dias, objetivo)
    return ordenar(g.filter(x => x.valor > 0 || x.quiebres > 0), orden)
  }, [filas, nivel.dim, esArticulo, dias, objetivo, orden])
  const visibles = esArticulo ? grupos.slice(0, 150) : grupos

  // Salud: valor por estado
  const salud = ESTADOS.filter(e => e.id !== 'sin_stock').map(e => {
    const rs = filas.filter(f => f.estado === e.id)
    return { ...e, valor: rs.reduce((s, f) => s + f.valor, 0), skus: rs.length }
  })
  // Cobertura: valor por tramo
  const tramos = TRAMOS.map(t => {
    const rs = filas.filter(f => f.tramo === t.id)
    return { ...t, valor: rs.reduce((s, f) => s + f.valor, 0), skus: rs.length }
  })
  const maxTramo = Math.max(1, ...tramos.map(t => t.valor))

  const siguiente = esArticulo ? null : nivelSiguiente(cambiarNivel(producto, nivel.dim, 'x'))
  const exportar = () => exportarExcel(`inventario_por_${nivel.dim}.xlsx`, [
    { label: nivel.singular, get: g => g.nombre },
    ...(esArticulo ? [{ label: 'Código', get: g => g.clave }] : []),
    { label: 'Valor en stock', get: g => g.valor.toFixed(2) },
    { label: '% del stock', get: g => g.pct },
    { label: 'SKUs con stock', get: g => g.skus },
    { label: 'Días de inventario', get: g => g.dias_inventario ?? '' },
    { label: 'Rotación anual', get: g => g.rotacion ?? '' },
    { label: 'Consumo por validar (Q)', get: g => g.por_validar.toFixed(2) },
    { label: 'Capital quieto', get: g => g.quieto.toFixed(2) },
    { label: '% quieto', get: g => g.pct_quieto },
    { label: `Exceso sobre ${objetivo} días`, get: g => g.exceso.toFixed(2) },
    { label: 'Quiebres', get: g => g.quiebres },
  ], grupos)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 min-w-0">
        <Seccion
          icon={Squares2X2Icon}
          titulo={`Inventario por ${nivel.singular.toLowerCase()}`}
          leyenda="inv_composicion"
          subtitulo={esArticulo
            ? `Último nivel de la jerarquía${grupos.length > visibles.length ? ` · ${fmtInt(visibles.length)} de ${fmtInt(grupos.length)} (ver todos en Detalle)` : ''}`
            : `Clic en una fila para ver sus ${siguiente.plural.toLowerCase()}`}
          sinPadding
          extra={
            <button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1">
              <ArrowDownTrayIcon className="w-4 h-4" /> Excel
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
                <tr>
                  <Th col="nombre" orden={orden} setOrden={setOrden} align="left">{nivel.singular}</Th>
                  <Th col="valor" orden={orden} setOrden={setOrden}>Valor</Th>
                  <Th col="skus" orden={orden} setOrden={setOrden}>SKUs</Th>
                  <Th col="dias_inventario" orden={orden} setOrden={setOrden} leyenda="inv_dias">Días inv.</Th>
                  <Th col="pct_quieto" orden={orden} setOrden={setOrden} leyenda="inv_quieto">% quieto</Th>
                  <Th col="exceso" orden={orden} setOrden={setOrden} leyenda="inv_exceso">Exceso</Th>
                  <Th col="quiebres" orden={orden} setOrden={setOrden} leyenda="inv_quiebre">Quiebres</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {visibles.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin inventario en el filtro.</td></tr>
                )}
                {visibles.map(g => (
                  <tr
                    key={g.clave}
                    onClick={esArticulo ? undefined : () => setProducto(cambiarNivel(producto, nivel.dim, g.clave))}
                    className={`hover:bg-[var(--bg-secondary)] ${esArticulo ? '' : 'cursor-pointer'}`}
                  >
                    <td className={`${td} max-w-[280px]`}>
                      <p className="font-medium truncate" title={g.nombre}>{g.nombre}</p>
                      {esArticulo
                        ? <p className="text-xs text-[var(--text-muted)]">{g.clave}</p>
                        : <div className="mt-1 w-full max-w-[220px]"><BarraPct pct={g.pct} /></div>}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      <p className="font-semibold">{fmtM(g.valor)}</p>
                      <p className="text-xs text-[var(--text-muted)]">{g.pct}%</p>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{fmtInt(g.skus)}</td>
                    <td className={`${td} text-right tabular-nums font-medium ${colorDias(g.dias_inventario)}`}>
                      {fmtDias(g.dias_inventario)}
                      {g.base === 'consumo' && !esArticulo && <p className="text-[10px] font-normal text-[var(--text-muted)]">por consumo</p>}
                    </td>
                    <td className={`${td} text-right tabular-nums ${g.pct_quieto >= 50 ? 'text-[var(--warning)] font-semibold' : ''}`}>
                      {g.valor > 0 ? `${g.pct_quieto}%` : '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{g.exceso > 0 ? fmtM(g.exceso) : '—'}</td>
                    <td className={`${td} text-right tabular-nums ${g.quiebres > 0 ? 'text-[var(--danger)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                      {g.quiebres > 0 ? fmtInt(g.quiebres) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {!esArticulo && visibles.length > 1 && (
                <tfoot className="border-t-2 border-[var(--border-default)] bg-[var(--bg-secondary)]">
                  <tr className="font-semibold">
                    <td className={td}>Total</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtM(tot.valor)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtInt(tot.skus)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtDias(tot.dias_inventario)}</td>
                    <td className={`${td} text-right tabular-nums`}>{tot.pct_quieto}%</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtM(tot.exceso)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtInt(tot.quiebres)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Seccion>
      </div>

      <div className="space-y-6 min-w-0">
        <Seccion icon={HeartIcon} titulo="Salud del inventario" leyenda="inv_quieto" subtitulo="Valor según su último movimiento">
          <div className="h-3 rounded-full overflow-hidden flex bg-[var(--bg-tertiary)] mb-4">
            {salud.map(e => e.valor > 0 && (
              <div key={e.id} style={{ width: `${e.valor / (tot.valor || 1) * 100}%`, background: e.color }} title={`${e.label}: ${fmtM(e.valor)}`} />
            ))}
          </div>
          <div className="space-y-2">
            {salud.map(e => (
              <button
                key={e.id}
                onClick={() => irDetalle({ rapido: `estado_${e.id}` })}
                className="w-full flex items-center justify-between gap-2 text-sm hover:bg-[var(--bg-secondary)] rounded px-1 py-0.5"
              >
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: e.color }} />
                  {e.label}
                  <span className="text-xs text-[var(--text-muted)]">{fmtInt(e.skus)} SKUs</span>
                </span>
                <span className="tabular-nums font-semibold">
                  {fmtM(e.valor)} <span className="text-xs font-normal text-[var(--text-muted)]">{tot.valor > 0 ? Math.round(e.valor / tot.valor * 100) : 0}%</span>
                </span>
              </button>
            ))}
          </div>
        </Seccion>

        <Seccion icon={ClockIcon} titulo="Cobertura del stock" leyenda="inv_cobertura" subtitulo="Valor según cuántos días alcanza cada artículo">
          <div className="space-y-2">
            {tramos.map(t => (
              <button
                key={t.id}
                onClick={() => irDetalle({ tramo: t.id })}
                className="w-full text-left group"
                title="Ver estos artículos en Detalle"
              >
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{t.label} <span className="text-[var(--text-muted)]">· {fmtInt(t.skus)}</span></span>
                  <span className="tabular-nums font-semibold">{fmtM(t.valor)}</span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.valor / maxTramo * 100}%`, background: t.color }} />
                </div>
              </button>
            ))}
          </div>
        </Seccion>
      </div>
    </div>
  )
}
