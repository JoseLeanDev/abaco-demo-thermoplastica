import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { ArrowDownTrayIcon, BuildingOfficeIcon, MagnifyingGlassIcon, UserMinusIcon } from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { Leyenda } from '../common/leyendas'
import { Cargando, Delta, Mini, Seccion, Th, exportarCSV, fmtFecha, fmtInt, fmtM, fmtQ, ordenar, td, th } from './comun'

export default function TabProveedores({ filtros, clave, r, setProveedor, setTab }) {
  const [orden, setOrden] = useState({ col: 'gasto', dir: 'desc' })
  const [busqueda, setBusqueda] = useState('')
  const [verDejados, setVerDejados] = useState(false)
  const { data, isLoading } = useQuery(
    ['compras-desglose', 'proveedor', clave],
    () => endpoints.compras.desglose({ ...filtros, dim: 'proveedor', limit: 500 }),
    { keepPreviousData: true }
  )
  const d = data?.data
  const items = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = (d?.items || []).filter(i => !q || i.nombre?.toLowerCase().includes(q) || String(i.clave).toLowerCase().includes(q))
    return ordenar(base, orden)
  }, [d, busqueda, orden])

  if (isLoading && !d) return <Cargando alto="h-96" />
  const c = r.concentracion || {}
  const elegir = (i) => { setProveedor({ codigo: i.clave, nombre: i.nombre }); setTab('resumen') }

  const exportar = () => exportarCSV('proveedores_compras.csv', [
    { label: 'Código', get: i => i.clave },
    { label: 'Proveedor', get: i => i.nombre },
    { label: 'Compras sin IVA', get: i => i.gasto.toFixed(2) },
    { label: 'Año anterior', get: i => i.gasto_prev.toFixed(2) },
    { label: 'Variación %', get: i => i.variacion_pct ?? '' },
    { label: '% del total', get: i => i.participacion },
    { label: '% acumulado', get: i => i.acumulado_pct },
    { label: 'Facturas', get: i => i.facturas },
    { label: 'Artículos', get: i => i.articulos },
    { label: 'Días de pago', get: i => i.dias_pago ?? '' },
    { label: 'Saldo por pagar', get: i => i.saldo_por_pagar.toFixed(2) },
    { label: 'Última compra', get: i => String(i.ultima_compra || '').slice(0, 10) },
  ], items)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini titulo="Concentran el 80%" leyenda="concentracion_proveedores" valor={`${c.proveedores_80 ?? '—'} proveedores`} sub={`de ${fmtInt(r.proveedores)} activos`} />
        <Mini titulo="Top 5" leyenda="concentracion_proveedores" valor={`${c.top5_pct ?? 0}%`} sub={c.top1 ? `${c.top1.nombre}: ${c.top1_pct}%` : ''} />
        <Mini titulo="Proveedores nuevos" leyenda="proveedores_nuevos" valor={fmtInt(c.proveedores_nuevos)} sub={`${fmtM(c.gasto_nuevos)} comprado`} />
        <Mini titulo="Ya no se les compró" leyenda="proveedores_dejados" valor={fmtInt(c.proveedores_dejados)} sub={`${fmtM(d?.gasto_dejados)} el año anterior`} />
      </div>

      <Seccion
        icon={BuildingOfficeIcon}
        titulo="Proveedores"
        leyenda="top_proveedores"
        subtitulo="Clic en un proveedor para ver toda la página filtrada por él"
        sinPadding
        extra={
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setBusqueda('')}
                placeholder="Buscar proveedor…"
                className="input py-1.5 pl-8 text-sm w-48"
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
                <Th col="nombre" orden={orden} setOrden={setOrden} align="left">Proveedor</Th>
                <Th col="gasto" orden={orden} setOrden={setOrden}>Compras</Th>
                <Th col="participacion" orden={orden} setOrden={setOrden}>%</Th>
                <th className={`${th} text-right`}>Acum. <Leyenda k="acumulado_pct" /></th>
                <Th col="variacion_pct" orden={orden} setOrden={setOrden}>vs año ant.</Th>
                <Th col="facturas" orden={orden} setOrden={setOrden}>Facturas</Th>
                <Th col="articulos" orden={orden} setOrden={setOrden}>Artículos</Th>
                <Th col="dias_pago" orden={orden} setOrden={setOrden} leyenda="dias_pago_proveedor">Días de pago</Th>
                <Th col="saldo_por_pagar" orden={orden} setOrden={setOrden} leyenda="saldo_proveedor">Por pagar</Th>
                <Th col="ultima_compra" orden={orden} setOrden={setOrden}>Última compra</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {items.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin proveedores en el filtro.</td></tr>
              )}
              {items.map(i => (
                <tr key={i.clave} onClick={() => elegir(i)} className="hover:bg-[var(--bg-secondary)] cursor-pointer">
                  <td className={`${td} max-w-[280px]`}>
                    <p className="font-medium truncate flex items-center gap-1.5">
                      <span className="truncate">{i.nombre}</span>
                      {i.nuevo && <span className="badge-success text-[10px]">Nuevo</span>}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{i.clave}</p>
                  </td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(i.gasto)}</td>
                  <td className={`${td} text-right tabular-nums ${i.participacion >= 25 ? 'text-[var(--warning)] font-semibold' : ''}`}>{i.participacion}%</td>
                  <td className={`${td} text-right tabular-nums text-[var(--text-muted)]`}>{i.acumulado_pct}%</td>
                  <td className={`${td} text-right`}>{i.nuevo ? <span className="text-xs text-[var(--text-muted)]">nuevo</span> : <Delta v={i.variacion_pct} />}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(i.facturas)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(i.articulos)}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {i.dias_pago === null ? '—' : `${i.dias_pago} d`}
                    {i.dias_credito ? <span className="block text-[10px] text-[var(--text-muted)]">crédito {i.dias_credito} d</span> : null}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{i.saldo_por_pagar > 0 ? fmtQ(i.saldo_por_pagar) : '—'}</td>
                  <td className={`${td} text-right text-[var(--text-secondary)]`}>{fmtFecha(i.ultima_compra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {(d?.dejados || []).length > 0 && (
        <Seccion
          icon={UserMinusIcon}
          titulo="Proveedores a los que ya no se les compró"
          leyenda="proveedores_dejados"
          subtitulo={`Se les compró en el mismo período del año anterior y en este no · ${fmtM(d.gasto_dejados)}`}
          extra={
            <button onClick={() => setVerDejados(v => !v)} className="text-xs text-[var(--accent-blue)] hover:underline">
              {verDejados ? 'Ocultar' : `Ver ${d.dejados.length}`}
            </button>
          }
          sinPadding={verDejados}
        >
          {verDejados && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
                  <tr>
                    <th className={`${th} text-left`}>Proveedor</th>
                    <th className={`${th} text-right`}>Compras año anterior</th>
                    <th className={`${th} text-right`}>Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {d.dejados.map(i => (
                    <tr key={i.clave}>
                      <td className={td}><span className="font-medium">{i.nombre}</span> <span className="text-xs text-[var(--text-muted)]">{i.clave}</span></td>
                      <td className={`${td} text-right tabular-nums`}>{fmtQ(i.gasto_prev)}</td>
                      <td className={`${td} text-right text-[var(--text-secondary)]`}>{fmtFecha(i.ultima_compra)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Seccion>
      )}
    </div>
  )
}
