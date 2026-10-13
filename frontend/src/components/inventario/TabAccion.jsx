import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownTrayIcon, ArrowTrendingDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Seccion, Th, exportarCSV, fmtFecha, fmtInt, fmtM, ordenar, td } from '../compras/comun'
import { ESTADO, agrupar, excesoDe, fmtDias, fmtNum } from './datos'
import { BarraPct, colorDias } from './TabResumen'

// Exceso (capital a liberar) y quiebres (ventas en riesgo).
export default function TabAccion({ filas, tot, dias, objetivo }) {
  const [ordenEx, setOrdenEx] = useState({ col: 'exceso', dir: 'desc' })
  const [ordenQ, setOrdenQ] = useState({ col: 'salida_mes', dir: 'desc' })

  const exceso = useMemo(() => ordenar(
    filas.map(f => ({ ...f, exceso: excesoDe(f, dias, objetivo) })).filter(f => f.exceso > 0),
    ordenEx
  ), [filas, dias, objetivo, ordenEx])
  const porCategoria = useMemo(() => agrupar(filas, 'categoria', dias, objetivo)
    .filter(g => g.exceso > 0).sort((a, b) => b.exceso - a.exceso).slice(0, 8), [filas, dias, objetivo])
  const maxCat = Math.max(1, ...porCategoria.map(g => g.exceso))
  const excesoSinSalida = exceso.filter(f => f.dias_cobertura === null).reduce((s, f) => s + f.exceso, 0)

  const quiebres = useMemo(() => ordenar(
    filas.filter(f => f.quiebre).map(f => ({ ...f, salida_mes: f.salida / dias * 30 })),
    ordenQ
  ), [filas, dias, ordenQ])

  const exportarExceso = () => exportarCSV(`inventario_exceso_${objetivo}d.csv`, [
    { label: 'Código', get: f => f.codigo },
    { label: 'Artículo', get: f => f.descripcion },
    { label: 'Categoría', get: f => f.categoria },
    { label: 'Subcategoría', get: f => f.subcategoria },
    { label: 'Proveedor', get: f => f.proveedor || '' },
    { label: 'Estado', get: f => ESTADO[f.estado]?.label },
    { label: 'Valor en stock', get: f => f.valor.toFixed(2) },
    { label: 'Días de cobertura', get: f => f.dias_cobertura ?? 'sin salida' },
    { label: `Exceso sobre ${objetivo} días`, get: f => f.exceso.toFixed(2) },
    { label: 'Última venta', get: f => f.ultima_venta || '' },
    { label: 'Última compra', get: f => f.ultima_compra || '' },
  ], exceso)
  const exportarQuiebres = () => exportarCSV('inventario_quiebres.csv', [
    { label: 'Código', get: f => f.codigo },
    { label: 'Artículo', get: f => f.descripcion },
    { label: 'Categoría', get: f => f.categoria },
    { label: 'Subcategoría', get: f => f.subcategoria },
    { label: 'Proveedor', get: f => f.proveedor || '' },
    { label: 'Salida mensual (Q)', get: f => f.salida_mes.toFixed(2) },
    { label: 'Meses con demanda (últ. 6)', get: f => f.meses_demanda_6m },
    { label: 'Última venta', get: f => f.ultima_venta || '' },
    { label: 'Última compra', get: f => f.ultima_compra || '' },
  ], quiebres)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="kpi-card">
          <span className="kpi-label">Capital a liberar</span>
          <p className="kpi-value tabular-nums">{fmtM(tot.exceso)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Stock por encima de {objetivo} días de cobertura en {fmtInt(tot.skus_exceso)} SKUs. De eso, {fmtM(excesoSinSalida)} no tuvo ninguna salida en el período.
          </p>
        </div>
        <div className="lg:col-span-2 card p-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Exceso por categoría</p>
          <div className="space-y-1.5">
            {porCategoria.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin exceso en el filtro.</p>}
            {porCategoria.map(g => (
              <div key={g.clave} className="flex items-center gap-3 text-xs">
                <span className="w-40 truncate text-[var(--text-secondary)]" title={g.nombre}>{g.nombre}</span>
                <div className="flex-1"><BarraPct pct={g.exceso / maxCat * 100} color="#f59e0b" /></div>
                <span className="w-16 text-right tabular-nums font-semibold">{fmtM(g.exceso)}</span>
                <span className="w-12 text-right tabular-nums text-[var(--text-muted)]">{g.pct_exceso}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Seccion
        icon={ArrowTrendingDownIcon}
        titulo={`Exceso de inventario sobre ${objetivo} días`}
        leyenda="inv_exceso"
        subtitulo={`${fmtInt(exceso.length)} artículos · cambia el objetivo arriba a la derecha`}
        sinPadding
        extra={<button onClick={exportarExceso} className="btn-secondary py-1.5 text-xs flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>}
      >
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)] sticky top-0 z-10">
              <tr>
                <Th col="descripcion" orden={ordenEx} setOrden={setOrdenEx} align="left">Artículo</Th>
                <Th col="estado" orden={ordenEx} setOrden={setOrdenEx} align="left">Estado</Th>
                <Th col="valor" orden={ordenEx} setOrden={setOrdenEx}>Valor</Th>
                <Th col="dias_cobertura" orden={ordenEx} setOrden={setOrdenEx}>Cobertura</Th>
                <Th col="exceso" orden={ordenEx} setOrden={setOrdenEx}>Exceso</Th>
                <Th col="dias_sin_mov" orden={ordenEx} setOrden={setOrdenEx} leyenda="inv_dias_sin_mov">Sin mov.</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {exceso.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Nada por encima del objetivo.</td></tr>}
              {exceso.slice(0, 200).map(f => (
                <tr key={f.codigo} className="hover:bg-[var(--bg-secondary)]">
                  <td className={`${td} max-w-[320px]`}>
                    <p className="font-medium truncate" title={f.descripcion}>{f.descripcion}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{f.codigo} · {f.subcategoria}{f.proveedor ? ` · ${f.proveedor}` : ''}</p>
                  </td>
                  <td className={td}><EstadoBadge estado={f.estado} /></td>
                  <td className={`${td} text-right tabular-nums`}>{fmtM(f.valor)}</td>
                  <td className={`${td} text-right tabular-nums font-medium ${colorDias(f.dias_cobertura)}`}>{f.dias_cobertura === null ? 'sin salida' : fmtDias(f.dias_cobertura)}</td>
                  <td className={`${td} text-right tabular-nums font-bold text-amber-600`}>{fmtM(f.exceso)}</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{fmtDias(f.dias_sin_mov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {exceso.length > 200 && <p className="px-5 py-3 text-xs text-[var(--text-muted)]">Mostrando 200 de {fmtInt(exceso.length)}; el CSV trae todos.</p>}
        </div>
      </Seccion>

      <Seccion
        icon={ExclamationTriangleIcon}
        titulo="Quiebres de stock"
        leyenda="inv_quiebre"
        subtitulo={<>Artículos con demanda recurrente que hoy están en cero y sin tránsito. Para pedir cantidades, ver <Link to="/compras" className="text-[var(--accent-blue)] hover:underline">Compras › Reposición</Link>.</>}
        sinPadding
        extra={quiebres.length > 0 && <button onClick={exportarQuiebres} className="btn-secondary py-1.5 text-xs flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>}
      >
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)] sticky top-0 z-10">
              <tr>
                <Th col="descripcion" orden={ordenQ} setOrden={setOrdenQ} align="left">Artículo</Th>
                <Th col="abc" orden={ordenQ} setOrden={setOrdenQ} align="left">ABC</Th>
                <Th col="salida_mes" orden={ordenQ} setOrden={setOrdenQ}>Salida/mes</Th>
                <Th col="meses_demanda_6m" orden={ordenQ} setOrden={setOrdenQ}>Meses con demanda</Th>
                <Th col="ultima_venta" orden={ordenQ} setOrden={setOrdenQ}>Última venta</Th>
                <Th col="ultima_compra" orden={ordenQ} setOrden={setOrdenQ}>Última compra</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {quiebres.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin quiebres en el filtro.</td></tr>}
              {quiebres.map(f => (
                <tr key={f.codigo} className="hover:bg-[var(--bg-secondary)]">
                  <td className={`${td} max-w-[320px]`}>
                    <p className="font-medium truncate" title={f.descripcion}>{f.descripcion}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{f.codigo} · {f.subcategoria}{f.proveedor ? ` · ${f.proveedor}` : ''}</p>
                  </td>
                  <td className={`${td} font-semibold`}>{f.abc === 'N' ? '—' : f.abc}</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtM(f.salida_mes)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtNum(Math.min(f.meses_demanda_6m, 6))} de 6</td>
                  <td className={`${td} text-right text-[var(--text-secondary)]`}>{fmtFecha(f.ultima_venta)}</td>
                  <td className={`${td} text-right text-[var(--text-secondary)]`}>{fmtFecha(f.ultima_compra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  )
}

export function EstadoBadge({ estado }) {
  const e = ESTADO[estado]
  if (!e) return null
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ring-1 ${e.cls}`}>{e.label}</span>
}
