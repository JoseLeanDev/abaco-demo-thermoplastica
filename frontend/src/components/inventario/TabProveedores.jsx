import { useMemo, useState } from 'react'
import { ArrowDownTrayIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { Seccion, Th, exportarCSV, fmtInt, fmtM, ordenar, td } from '../compras/comun'
import { agrupar, fmtDias } from './datos'
import { BarraPct, colorDias } from './TabResumen'

// Inventario por proveedor principal: con quién está el capital y qué tan rápido rota.
export default function TabProveedores({ filas, tot, dias, objetivo, setProveedor, setTab }) {
  const [orden, setOrden] = useState({ col: 'valor', dir: 'desc' })
  const items = useMemo(() => ordenar(
    agrupar(filas, 'proveedor_codigo', dias, objetivo, f => f.proveedor || 'Sin compras registradas').filter(g => g.valor > 0 || g.quiebres > 0),
    orden
  ), [filas, dias, objetivo, orden])

  // Concentración: cuántos proveedores suman el 80% del stock
  const conc = useMemo(() => {
    const vs = items.map(i => i.valor).sort((a, b) => b - a)
    let acum = 0, n = 0
    for (const v of vs) { if (acum >= tot.valor * 0.8) break; acum += v; n++ }
    return { n80: n, top5: tot.valor > 0 ? Math.round(vs.slice(0, 5).reduce((s, v) => s + v, 0) / tot.valor * 100) : 0 }
  }, [items, tot.valor])
  const sinProv = items.find(i => !i.clave)

  const exportar = () => exportarCSV('inventario_por_proveedor.csv', [
    { label: 'Proveedor', get: g => g.nombre },
    { label: 'Código', get: g => g.clave },
    { label: 'Valor en stock', get: g => g.valor.toFixed(2) },
    { label: '% del stock', get: g => g.pct },
    { label: 'SKUs con stock', get: g => g.skus },
    { label: 'Días de inventario', get: g => g.dias_inventario ?? '' },
    { label: '% quieto', get: g => g.pct_quieto },
    { label: `Exceso sobre ${objetivo} días`, get: g => g.exceso.toFixed(2) },
    { label: 'Quiebres', get: g => g.quiebres },
  ], items)

  return (
    <Seccion
      icon={BuildingOfficeIcon}
      titulo="Inventario por proveedor"
      leyenda="inv_proveedor"
      subtitulo={`${conc.n80} proveedores concentran el 80% del stock · top 5 = ${conc.top5}%${sinProv ? ` · ${fmtM(sinProv.valor)} en artículos sin compras registradas` : ''}. Clic para filtrar la página.`}
      sinPadding
      extra={<button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
            <tr>
              <Th col="nombre" orden={orden} setOrden={setOrden} align="left">Proveedor</Th>
              <Th col="valor" orden={orden} setOrden={setOrden}>Valor</Th>
              <Th col="skus" orden={orden} setOrden={setOrden}>SKUs</Th>
              <Th col="dias_inventario" orden={orden} setOrden={setOrden} leyenda="inv_dias">Días inv.</Th>
              <Th col="pct_quieto" orden={orden} setOrden={setOrden} leyenda="inv_quieto">% quieto</Th>
              <Th col="exceso" orden={orden} setOrden={setOrden} leyenda="inv_exceso">Exceso</Th>
              <Th col="quiebres" orden={orden} setOrden={setOrden} leyenda="inv_quiebre">Quiebres</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin inventario en el filtro.</td></tr>}
            {items.map(g => (
              <tr
                key={g.clave || 'sin'}
                onClick={() => { setProveedor({ codigo: g.clave || null, nombre: g.nombre }); setTab('resumen') }}
                className="hover:bg-[var(--bg-secondary)] cursor-pointer"
              >
                <td className={`${td} max-w-[300px]`}>
                  <p className={`font-medium truncate ${g.clave ? '' : 'italic text-[var(--text-muted)]'}`} title={g.nombre}>{g.nombre}</p>
                  <div className="mt-1 max-w-[220px]"><BarraPct pct={g.pct} /></div>
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  <p className="font-semibold">{fmtM(g.valor)}</p>
                  <p className="text-xs text-[var(--text-muted)]">{g.pct}%</p>
                </td>
                <td className={`${td} text-right tabular-nums`}>{fmtInt(g.skus)}</td>
                <td className={`${td} text-right tabular-nums font-medium ${colorDias(g.dias_inventario)}`}>{fmtDias(g.dias_inventario)}</td>
                <td className={`${td} text-right tabular-nums ${g.pct_quieto >= 50 ? 'text-[var(--warning)] font-semibold' : ''}`}>{g.valor > 0 ? `${g.pct_quieto}%` : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{g.exceso > 0 ? fmtM(g.exceso) : '—'}</td>
                <td className={`${td} text-right tabular-nums ${g.quiebres > 0 ? 'text-[var(--danger)] font-semibold' : 'text-[var(--text-muted)]'}`}>{g.quiebres || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}
