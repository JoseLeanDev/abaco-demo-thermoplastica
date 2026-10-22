import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  BoltIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CubeIcon,
  ListBulletIcon,
  Squares2X2Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { usePeriodo } from '../context/PeriodoContext'
import { endpoints } from '../services/cfoApi'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'
import FiltroProducto, { FILTRO_VACIO, NIVELES_PRODUCTO } from '../components/ventas/FiltroProducto'
import { Kpi, exportarExcel, fmtFecha, fmtInt, fmtM } from '../components/compras/comun'
import { ABCS, CLASES, OBJETIVOS, filtrar, hidratar, opcionesProducto, resumir } from '../components/inventario/datos'
import TabResumen from '../components/inventario/TabResumen'
import TabAbc from '../components/inventario/TabAbc'
import TabAccion from '../components/inventario/TabAccion'
import TabProveedores from '../components/inventario/TabProveedores'
import TabDetalle, { COLUMNAS_DETALLE } from '../components/inventario/TabDetalle'

const PESTANAS = [
  { id: 'resumen',     label: 'Resumen',           icon: ChartBarIcon },
  { id: 'abc',         label: 'Análisis ABC',      icon: Squares2X2Icon },
  { id: 'accion',      label: 'Exceso y quiebres', icon: BoltIcon },
  { id: 'proveedores', label: 'Proveedores',       icon: BuildingOfficeIcon },
  { id: 'detalle',     label: 'Detalle',           icon: ListBulletIcon },
]

export default function Inventario() {
  const { params: periodo } = usePeriodo()
  const [tab, setTab] = useState('resumen')
  const [producto, setProducto] = useState(FILTRO_VACIO)
  const [clase, setClase] = useState('')
  const [abc, setAbc] = useState('')
  const [proveedor, setProveedor] = useState(null) // { codigo, nombre }
  const [objetivo, setObjetivo] = useState(90)
  // Filtro rápido de la pestaña Detalle (los KPIs lo fijan al hacer clic)
  const [vista, setVista] = useState({ rapido: 'todos', tramo: '' })

  const { data, isLoading, isPreviousData } = useQuery(
    ['inventario-analitica', periodo.desde, periodo.hasta],
    () => endpoints.inventario.analitica(periodo),
    { keepPreviousData: true, staleTime: 5 * 60 * 1000 }
  )
  const d = data?.data
  const todas = useMemo(() => hidratar(d), [d])
  const dias = d?.periodo?.dias || 365
  const filas = useMemo(
    () => filtrar(todas, { producto, clase, abc, proveedor }),
    [todas, producto, clase, abc, proveedor]
  )
  const tot = useMemo(() => resumir(filas, dias, objetivo), [filas, dias, objetivo])
  const opciones = useMemo(() => opcionesProducto(todas), [todas])
  const cargando = isLoading || isPreviousData
  const hayFiltros = !!(clase || abc || proveedor || NIVELES_PRODUCTO.some(n => producto[n.dim]))

  const limpiar = () => { setProducto(FILTRO_VACIO); setClase(''); setAbc(''); setProveedor(null) }
  const irDetalle = (v) => { setVista({ rapido: 'todos', tramo: '', ...v }); setTab('detalle') }
  const exportar = () => exportarExcel(`inventario_${d?.fecha_corte || 'hoy'}.xlsx`, COLUMNAS_DETALLE(dias, objetivo), filas)

  const ctx = { filas, todas, tot, dias, objetivo, setObjetivo, producto, setProducto, setClase, setAbc, setProveedor, irDetalle, vista, setVista, setTab, periodo: d?.periodo }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="w-10 h-10 shrink-0 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-[#001639] flex items-center justify-center">
              <CubeIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">Inventario</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {cargando && !d ? 'Cargando…' : `${fmtInt(tot.skus)} artículos con stock · ${fmtInt(d?.catalogo)} en catálogo · foto del ${fmtFecha(d?.fecha_corte)}`}
              </p>
              <PeriodoActivo nota="stock a hoy; salida comercial, cobertura y ABC del período; consumo de producción pendiente" className="mt-1" />
            </div>
          </div>
        </div>
        <button onClick={exportar} disabled={!filas.length} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Filtros: aplican a todo lo de abajo */}
      <div className="space-y-3">
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <Chips
            titulo="Tipo" leyenda="inv_tipo_articulo"
            opciones={[{ id: '', corto: 'Todos' }, ...CLASES]}
            valor={clase} onChange={setClase}
          />
          <Chips
            titulo="Clase ABC" leyenda="inv_abc"
            opciones={[{ id: '', corto: 'Todas' }, ...ABCS.map(a => ({ ...a, corto: a.label }))]}
            valor={abc} onChange={setAbc}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <FiltroProducto value={producto} onChange={setProducto} opciones={opciones} />
          {proveedor && (
            <span className="flex items-center gap-1 rounded-lg border border-[#001639] bg-[#001639] text-white px-2.5 py-1.5 text-sm">
              <span className="text-[10px] uppercase tracking-wide text-white/70">Proveedor</span>
              <span className="font-medium truncate max-w-[16rem]">{proveedor.nombre}</span>
              <button onClick={() => setProveedor(null)} className="ml-1 text-white/70 hover:text-white" aria-label="Quitar proveedor">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
          {hayFiltros && (
            <button onClick={limpiar} className="text-xs text-[var(--accent-blue)] hover:underline">
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {cargando && !d ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="kpi-card">
              <span className="block h-3 w-24 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              <span className="block h-7 w-20 mt-2 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              <span className="block h-3 w-32 mt-2 rounded bg-[var(--bg-tertiary)] animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi
            titulo="Valor en stock" leyenda="valor_stock"
            valor={fmtM(tot.valor)}
            sub={<>{fmtInt(tot.skus)} SKUs{tot.transito > 0 && <> · +{fmtM(tot.transito)} en tránsito</>}</>}
          />
          <Kpi
            titulo="Días de inventario" leyenda="inv_dias"
            valor={tot.dias_inventario !== null ? fmtInt(tot.dias_inventario) : '—'}
            sub={tot.rotacion ? `Rota ${tot.rotacion}× al año${tot.base === 'consumo' ? ' · por consumo' : ''}` : 'Sin salida comercial medida'}
          />
          <Kpi
            titulo="Capital quieto" leyenda="inv_quieto"
            valor={fmtM(tot.quieto)}
            onClick={() => irDetalle({ rapido: 'quieto' })}
            sub={<><span className={tot.pct_quieto >= 40 ? 'text-[var(--warning)] font-medium' : ''}>{tot.pct_quieto}%</span> del stock · {fmtM(tot.inmovilizado)} inmovilizado</>}
          />
          <Kpi
            titulo={`Exceso sobre ${objetivo} días`} leyenda="inv_exceso"
            valor={tot.skus_evaluables > 0 ? fmtM(tot.exceso) : 'N/D'}
            onClick={() => setTab('accion')}
            sub={tot.skus_evaluables > 0 ? `${tot.pct_exceso}% del stock · ${fmtInt(tot.skus_exceso)} SKUs` : 'Consumo de producción pendiente'}
          />
          <Kpi
            titulo="Quiebres de stock" leyenda="inv_quiebre"
            valor={<span className={tot.quiebres > 0 ? 'text-[var(--danger)]' : ''}>{fmtInt(tot.quiebres)}</span>}
            onClick={() => setTab('accion')}
            sub={tot.quiebres > 0 ? `Movían ${fmtM(tot.salida_quiebres / dias * 30)}/mes y están en cero` : 'Sin artículos recurrentes en cero'}
          />
        </div>
      )}

      {tot.por_validar > 0 && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 dark:bg-slate-900/30 p-4 text-sm text-[var(--text-secondary)]">
          <strong>{fmtM(tot.por_validar)} · Consumo por validar.</strong>{' '}
          Las vistas disponibles no muestran sus salidas a producción. Este stock sigue dentro del inventario,
          pero no se considera activo, lento, inmovilizado ni exceso por falta de venta o recompra.
          <button className="ml-2 underline" onClick={() => irDetalle({ rapido: 'estado_por_validar' })}>Ver artículos</button>
        </div>
      )}

      {/* Pestañas */}
      <div className="flex items-center gap-1 border-b border-[var(--border-default)] overflow-x-auto overflow-y-hidden">
        {PESTANAS.map(t => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activo ? 'border-[#001639] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--text-muted)] whitespace-nowrap pl-4">
          Cobertura objetivo <Leyenda k="inv_objetivo" />
          <select value={objetivo} onChange={(e) => setObjetivo(+e.target.value)} className="input py-1 text-xs w-24">
            {OBJETIVOS.map(o => <option key={o} value={o}>{o} días</option>)}
          </select>
        </label>
      </div>

      {cargando && !d ? (
        <div className="card h-96 animate-pulse bg-[var(--bg-secondary)]" />
      ) : (
        <>
          {tab === 'resumen'     && <TabResumen {...ctx} />}
          {tab === 'abc'         && <TabAbc {...ctx} />}
          {tab === 'accion'      && <TabAccion {...ctx} />}
          {tab === 'proveedores' && <TabProveedores {...ctx} />}
          {tab === 'detalle'     && <TabDetalle {...ctx} />}
        </>
      )}

      <p className="text-xs text-[var(--text-muted)] italic">
        Fuente: foto diaria del inventario del ERP (<code>vst_Articulos</code>) valuada a costo promedio, más ventas y compras del período.
        El proveedor de cada artículo es al que más se le compró en los últimos 24 meses (el ERP no lo trae en el inventario).
        Para la historia de rotación y el envejecimiento ver{' '}
        <Link to="/analisis/rotacion-inventario" className="text-[var(--accent-blue)] hover:underline not-italic">Rotación de inventarios</Link> y{' '}
        <Link to="/analisis/capital-inmovilizado" className="text-[var(--accent-blue)] hover:underline not-italic">Capital inmovilizado</Link>.
      </p>
    </div>
  )
}

function Chips({ titulo, leyenda, opciones, valor, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] mr-1">
        {titulo} {leyenda && <Leyenda k={leyenda} />}
      </span>
      {opciones.map(o => {
        const activo = valor === o.id
        return (
          <button
            key={o.id || 'todos'}
            onClick={() => onChange(o.id)}
            title={o.desc}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activo
                ? 'border-[#001639] bg-[#001639] text-white'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
            }`}
          >
            {o.color && <span className="w-2 h-2 rounded-full" style={{ background: activo ? '#fff' : o.color }} />}
            {o.corto}
          </button>
        )
      })}
    </div>
  )
}
