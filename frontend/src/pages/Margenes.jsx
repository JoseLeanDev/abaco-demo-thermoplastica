import { useState } from 'react'
import PageInsights from '../components/agents/PageInsights'
import {
  ChartBarIcon,
  UsersIcon,
  BuildingStorefrontIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { useMargenes, useMargenVendedores, useMargenClientes } from '../hooks/useCfoData'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import FiltroProducto, { FILTRO_VACIO } from '../components/ventas/FiltroProducto'
import MargenCategorias from '../components/margenes/MargenCategorias'
import TabProductos from '../components/margenes/TabProductos'
import TabRanking from '../components/margenes/TabRanking'
import { Leyenda } from '../components/common/leyendas'
import { Cargando } from '../components/compras/comun'

const formatGTQ = (value) => 'Q ' + Math.round(value || 0).toLocaleString('es-GT')
const formatNum = (value, decimals = 1) => (value === null || value === undefined ? '—' : Number(value).toFixed(decimals))

const TABS = [
  { id: 'productos',  label: 'Por Producto',  icon: TagIcon },
  { id: 'vendedores', label: 'Por Vendedor',  icon: UsersIcon },
  { id: 'clientes',   label: 'Por Cliente',   icon: BuildingStorefrontIcon },
  { id: 'categorias', label: 'Por Categoría', icon: ChartBarIcon },
]

export default function Margenes() {
  // Filtro de producto (Categoría › Subcategoría › Sublínea), común a todas las pestañas
  const [producto, setProducto] = useState(FILTRO_VACIO)
  const prodParams = Object.fromEntries(Object.entries(producto).filter(([, v]) => v))
  const [activeTab, setActiveTab] = useState('productos')
  const [semaforo, setSemaforo] = useState('')

  const { data, isLoading, error } = useMargenes(prodParams)
  const { data: vendedoresData, isLoading: vLoading } = useMargenVendedores(prodParams)
  const { data: clientesData, isLoading: cLoading } = useMargenClientes(prodParams)

  const resumen = data?.data?.resumen
  const cpp = data?.data?.metodologia
  const productos = data?.data?.productos || []
  const delta = resumen && resumen.margen_global_pct !== null && resumen.margen_global_pct_prev !== null ? resumen.margen_global_pct - resumen.margen_global_pct_prev : null

  const verAjuste = () => { setActiveTab('productos'); setSemaforo('rojo') }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ChartBarIcon className="w-6 h-6 text-[var(--accent-primary)]" />
          Márgenes
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Precio contra costo real: productos, vendedores, clientes y categorías
        </p>
        <PeriodoActivo nota="margen vs mismo período del año anterior" className="mt-1" />
      </div>

      {/* Filtro de producto: aplica a KPIs y a todas las pestañas */}
      <FiltroProducto value={producto} onChange={setProducto} />
      {cpp && <p className="text-xs text-[var(--text-muted)]">Margen sobre materia prima · compras hasta {cpp.corte_cpp} · ventas hasta {cpp.hasta_efectivo}. Las ventas sin CPP no entran al margen. <Leyenda k="margen_mp" /></p>}

      {error && <div className="card p-6 text-red-500">Error cargando datos: {error.message}</div>}

      {/* KPIs */}
      {isLoading && !resumen ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Cargando key={i} alto="h-28" />)}</div>
      ) : resumen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">{cpp ? 'Margen sobre materia prima' : 'Margen bruto'} <Leyenda k={cpp ? 'margen_mp' : 'margen_bruto'} /></p>
            <p className="text-2xl font-bold text-emerald-600">{resumen.total_margen_bruto_q === null ? 'N/D' : formatGTQ(resumen.total_margen_bruto_q)}</p>
            <p className="text-xs text-[var(--text-muted)]">{resumen.margen_global_pct === null ? 'N/D' : `${formatNum(resumen.margen_global_pct)}% sobre ventas con costo`}</p>
            {resumen.pct_ventas_sin_costo >= 1 && (
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                {formatNum(resumen.pct_ventas_sin_costo)}% de ventas sin costo, excluidas del % <Leyenda k="pct_sin_costo" />
              </p>
            )}
          </div>
          <div className="card p-5">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">Margen % vs año anterior <Leyenda k="vs_anio_anterior" /></p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{resumen.margen_global_pct === null ? 'N/D' : `${formatNum(resumen.margen_global_pct)}%`}</p>
              {delta !== null && (
                <p className={`text-sm font-semibold ${delta < -1 ? 'text-red-500' : delta > 1 ? 'text-emerald-600' : 'text-[var(--text-secondary)]'}`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)} pts
                </p>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">{resumen.margen_global_pct_prev === null ? 'Sin ventas el año anterior' : `${formatNum(resumen.margen_global_pct_prev)}% en el mismo período del año anterior`}</p>
          </div>
          <div className="card p-5 card-hover cursor-pointer" role="button" tabIndex={0} onClick={verAjuste} onKeyDown={(e) => e.key === 'Enter' && verAjuste()}>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">Necesitan ajuste de precio <Leyenda k="necesitan_ajuste" /></p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-red-500">{resumen.productos_rojo}</p>
              <p className="text-sm text-amber-600">+ {resumen.productos_ambar} en ámbar</p>
            </div>
            <p className="text-xs text-[var(--text-muted)]">De {resumen.total_productos.toLocaleString('es-GT')} productos · clic para verlos</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">Total ventas <Leyenda k="ventas" /></p>
            <p className="text-2xl font-bold text-[var(--accent-primary)]">{formatGTQ(resumen.total_ventas_q)}</p>
            <p className="text-xs text-[var(--text-muted)]">Período seleccionado</p>
          </div>
        </div>
      )}

      {/* Insights del analista diario (vertical margenes) */}
      <PageInsights vertical="margenes" maxInsights={4} />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-color)] overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'productos' && (
        isLoading && !data ? <Cargando alto="h-96" /> : <TabProductos productos={productos} semaforo={semaforo} setSemaforo={setSemaforo} />
      )}
      {activeTab === 'vendedores' && (
        <TabRanking icon={UsersIcon} titulo="Margen por vendedor" singular="vendedor" items={vendedoresData?.data || []} isLoading={vLoading && !vendedoresData} />
      )}
      {activeTab === 'clientes' && (
        <TabRanking icon={BuildingStorefrontIcon} titulo="Margen por cliente" singular="cliente" nota="de mayor venta" items={clientesData?.data || []} isLoading={cLoading && !clientesData} />
      )}
      {activeTab === 'categorias' && <MargenCategorias filtro={producto} onFiltro={setProducto} />}
    </div>
  )
}
