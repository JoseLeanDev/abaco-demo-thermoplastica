import { useState, useMemo } from 'react'
import {
  ChartBarIcon,
  UsersIcon,
  BuildingStorefrontIcon,
  TagIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { 
  useMargenes, 
  useMargenProductoDetalle,
  useMargenVendedores,
  useMargenClientes,
  useMargenLineas,
} from '../hooks/useCfoData'

const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0'
  return 'Q ' + Math.round(value).toLocaleString('es-GT')
}

const formatNum = (value, decimals = 1) => {
  if (!value && value !== 0) return '-'
  return Number(value).toFixed(decimals)
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

// Tabla genérica sorteable
function SortableTable({ columns, data, onRowClick, keyField = 'id' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const va = parseFloat(a[sortKey]) || a[sortKey] || 0
      const vb = parseFloat(b[sortKey]) || b[sortKey] || 0
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va > vb ? -1 : 1)
    })
  }, [data, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                className={`text-left py-3 px-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider ${col.sortable !== false ? 'cursor-pointer hover:text-[var(--text-primary)]' : ''}`}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr
              key={row[keyField] || idx}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)]/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className={`py-3 px-3 ${col.className || ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Margenes() {
  const { data, isLoading, error } = useMargenes()
  const { data: vendedoresData, isLoading: vLoading } = useMargenVendedores()
  const { data: clientesData, isLoading: cLoading } = useMargenClientes()
  const { data: lineasData, isLoading: lLoading } = useMargenLineas()
  
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const { data: detalleData } = useMargenProductoDetalle(productoSeleccionado?.id)
  const [activeTab, setActiveTab] = useState('productos')

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Cargando análisis de márgenes...</div>
  if (error) return <div className="p-6 text-red-400">Error cargando datos: {error.message}</div>
  if (!data?.data) return <div className="p-6 text-[var(--text-muted)]">No hay datos disponibles</div>

  const { resumen, productos } = data.data
  const vendedores = vendedoresData?.data || []
  const clientes = clientesData?.data || []
  const lineas = lineasData?.data || []

  const chartData = detalleData?.data?.historial?.map(h => ({
    fecha: h.fecha.slice(0, 7),
    precio: h.precio_promedio_realizado,
    costo: h.costo_unitario,
    margen: h.margen_pct,
  })) || []

  const tabs = [
    { id: 'productos', label: 'Por Producto', icon: TagIcon },
    { id: 'vendedores', label: 'Por Vendedor', icon: UsersIcon },
    { id: 'clientes', label: 'Por Cliente', icon: BuildingStorefrontIcon },
    { id: 'lineas', label: 'Por Línea', icon: ChartBarIcon },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ChartBarIcon className="w-6 h-6 text-[var(--accent-primary)]" />
          Márgenes
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Precio contra costo real: productos, vendedores, clientes y líneas
        </p>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Margen Bruto Total</p>
          <p className="text-2xl font-bold text-emerald-400">{formatGTQ(resumen?.total_margen_bruto_q || 0)}</p>
          <p className="text-xs text-[var(--text-muted)]">{formatNum(resumen?.margen_global_pct)}% sobre ventas</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Dejaste de ganar (12 meses)</p>
          <p className="text-2xl font-bold text-red-400">{formatGTQ(resumen?.total_margen_perdido_12m || 0)}</p>
          <p className="text-xs text-[var(--text-muted)]">Productos que no ajustaron precio</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Necesitan ajuste de precio</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-red-400">{resumen?.productos_rojo || 0}</p>
            <p className="text-sm text-amber-400">+ {resumen?.productos_ambar || 0} en ámbar</p>
          </div>
          <p className="text-xs text-[var(--text-muted)]">De {resumen?.total_productos || 0} totales</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Ventas</p>
          <p className="text-2xl font-bold text-[var(--accent-primary)]">{formatGTQ(resumen?.total_ventas_q || 0)}</p>
          <p className="text-xs text-[var(--text-muted)]">Últimos 12 meses</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-color)]">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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

      {/* ===== CONTENIDO POR TAB ===== */}

      {/* TAB: PRODUCTOS */}
      {activeTab === 'productos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="p-4 border-b border-[var(--border-color)]">
                <h2 className="font-semibold flex items-center gap-2">
                  <TagIcon className="w-5 h-5 text-[var(--accent-primary)]" />
                  Productos que perdieron margen
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {productos?.filter(p => p.semaforo !== 'verde').length || 0} productos con margen menor al año pasado
                </p>
              </div>
              <SortableTable
                columns={[
                  { key: 'nombre', label: 'Producto', sortable: false, render: r => (
                    <div>
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.sku}</div>
                    </div>
                  )},
                  { key: 'precio_actual', label: 'Precio', className: 'text-right', render: r => `Q ${formatNum(r.precio_actual, 2)}` },
                  { key: 'costo_actual', label: 'Costo', className: 'text-right', render: r => `Q ${formatNum(r.costo_actual, 2)}` },
                  { key: 'margen_pct_actual', label: 'Margen Hoy', className: 'text-right', render: r => `${formatNum(r.margen_pct_actual)}%` },
                  { key: 'margen_pct_historico', label: 'Hace 12m', className: 'text-right', render: r => `${formatNum(r.margen_pct_historico)}%` },
                  { key: 'delta_puntos', label: 'Puntos perdidos', className: 'text-right', render: r => (
                    <span className={r.delta_puntos < 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {r.delta_puntos > 0 ? '+' : ''}{formatNum(r.delta_puntos)}
                    </span>
                  )},
                  { key: 'quetzales_perdidos', label: 'Q que dejaste de ganar', className: 'text-right', render: r => (
                    r.quetzales_perdidos > 0 ? <span className="text-red-400">{formatGTQ(r.quetzales_perdidos)}</span> : '-'
                  )},
                  { key: 'semaforo', label: '', className: 'text-center', sortable: false, render: r => (
                    <span className={`inline-block w-3 h-3 rounded-full ${
                      r.semaforo === 'rojo' ? 'bg-red-500' :
                      r.semaforo === 'ambar' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                  )},
                ]}
                data={productos || []}
                onRowClick={row => setProductoSeleccionado(row)}
                keyField="sku"
              />
            </div>
          </div>

          {/* Panel de Detalle Producto */}
          <div className="card p-6">
            {productoSeleccionado ? (
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg">{productoSeleccionado.nombre}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{productoSeleccionado.sku}</p>
                  </div>
                  <button onClick={() => setProductoSeleccionado(null)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                    <XMarkIcon className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>

                {productoSeleccionado.precio_sugerido > productoSeleccionado.precio_actual && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
                    <p className="text-xs text-red-400 uppercase tracking-wider">Precio sugerido para recuperar margen</p>
                    <p className="text-xl font-bold text-red-400">Q {formatNum(productoSeleccionado.precio_sugerido, 2)}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      vs Q {formatNum(productoSeleccionado.precio_actual, 2)} actual (+{formatNum((productoSeleccionado.precio_sugerido / productoSeleccionado.precio_actual - 1) * 100)}%)
                    </p>
                  </div>
                )}

                {chartData.length > 0 && (
                  <div className="h-64 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="precio" fill="#10b981" name="Precio" />
                        <Bar dataKey="costo" fill="#ef4444" name="Costo" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                    <p className="text-xs text-[var(--text-muted)]">Margen Actual</p>
                    <p className={`text-lg font-bold ${productoSeleccionado.margen_pct_actual < 25 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatNum(productoSeleccionado.margen_pct_actual)}%
                    </p>
                  </div>
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                    <p className="text-xs text-[var(--text-muted)]">Margen Hace 12m</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{formatNum(productoSeleccionado.margen_pct_historico)}%</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                    <p className="text-xs text-[var(--text-muted)]">Puntos perdidos</p>
                    <p className={`text-lg font-bold ${productoSeleccionado.delta_puntos < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {productoSeleccionado.delta_puntos > 0 ? '+' : ''}{formatNum(productoSeleccionado.delta_puntos)}
                    </p>
                  </div>
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                    <p className="text-xs text-[var(--text-muted)]">Q que dejaste de ganar</p>
                    <p className="text-lg font-bold text-red-400">
                      {productoSeleccionado.quetzales_perdidos > 0 ? formatGTQ(productoSeleccionado.quetzales_perdidos) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
                <TagIcon className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Selecciona un producto para ver detalle</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: VENDEDORES */}
      {activeTab === 'vendedores' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="p-4 border-b border-[var(--border-color)]">
                <h2 className="font-semibold flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-[var(--accent-primary)]" />
                  Margen por Vendedor
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {vendedores.filter(v => v.semaforo === 'rojo').length} vendedores con pérdida fuerte de margen
                </p>
              </div>
              {vLoading ? (
                <div className="p-6 text-[var(--text-muted)]">Cargando vendedores...</div>
              ) : (
                <SortableTable
                  columns={[
                    { key: 'nombre', label: 'Vendedor', sortable: false },
                    { key: 'ventas_12m', label: 'Ventas 12m', className: 'text-right', render: r => formatGTQ(r.ventas_12m) },
                    { key: 'margen_pct_actual', label: 'Margen Actual', className: 'text-right', render: r => `${formatNum(r.margen_pct_actual)}%` },
                    { key: 'margen_pct_historico', label: 'Hace 12m', className: 'text-right', render: r => `${formatNum(r.margen_pct_historico)}%` },
                    { key: 'delta_puntos', label: 'Puntos perdidos', className: 'text-right', render: r => (
                      <span className={r.delta_puntos < 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {r.delta_puntos > 0 ? '+' : ''}{formatNum(r.delta_puntos)}
                      </span>
                    )},
                    { key: 'quetzales_perdidos', label: 'Q que dejaste de ganar', className: 'text-right', render: r => (
                      r.quetzales_perdidos > 0 ? <span className="text-red-400">{formatGTQ(r.quetzales_perdidos)}</span> : '-'
                    )},
                    { key: 'semaforo', label: '', className: 'text-center', sortable: false, render: r => (
                      <span className={`inline-block w-3 h-3 rounded-full ${
                        r.semaforo === 'rojo' ? 'bg-red-500' :
                        r.semaforo === 'ambar' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                    )},
                  ]}
                  data={vendedores}
                  keyField="id"
                />
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Mejor Vendedor</p>
              <p className="text-lg font-bold mt-1">{vendedores[0]?.nombre || '-'}</p>
              <p className="text-sm text-emerald-400">{formatNum(vendedores[0]?.margen_pct_actual)}% margen</p>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Ventas por Vendedor</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vendedores}
                      dataKey="ventas_12m"
                      nameKey="nombre"
                      cx="50%" cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                    >
                      {vendedores.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CLIENTES */}
      {activeTab === 'clientes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="p-4 border-b border-[var(--border-color)]">
                <h2 className="font-semibold flex items-center gap-2">
                  <BuildingStorefrontIcon className="w-5 h-5 text-[var(--accent-primary)]" />
                  Margen por Cliente
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {clientes.filter(c => c.semaforo === 'rojo').length} clientes con margen crítico
                </p>
              </div>
              {cLoading ? (
                <div className="p-6 text-[var(--text-muted)]">Cargando clientes...</div>
              ) : (
                <SortableTable
                  columns={[
                    { key: 'nombre', label: 'Cliente', sortable: false },
                    { key: 'ventas_12m', label: 'Comprado 12m', className: 'text-right', render: r => formatGTQ(r.ventas_12m) },
                    { key: 'margen_pct_actual', label: 'Margen Actual', className: 'text-right', render: r => `${formatNum(r.margen_pct_actual)}%` },
                    { key: 'margen_pct_historico', label: 'Hace 12m', className: 'text-right', render: r => `${formatNum(r.margen_pct_historico)}%` },
                    { key: 'delta_puntos', label: 'Puntos perdidos', className: 'text-right', render: r => (
                      <span className={r.delta_puntos < 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {r.delta_puntos > 0 ? '+' : ''}{formatNum(r.delta_puntos)}
                      </span>
                    )},
                    { key: 'quetzales_perdidos', label: 'Q que dejaste de ganar', className: 'text-right', render: r => (
                      r.quetzales_perdidos > 0 ? <span className="text-red-400">{formatGTQ(r.quetzales_perdidos)}</span> : '-'
                    )},
                    { key: 'semaforo', label: '', className: 'text-center', sortable: false, render: r => (
                      <span className={`inline-block w-3 h-3 rounded-full ${
                        r.semaforo === 'rojo' ? 'bg-red-500' :
                        r.semaforo === 'ambar' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                    )},
                  ]}
                  data={clientes}
                  keyField="id"
                />
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Top Cliente</p>
              <p className="text-lg font-bold mt-1">{clientes[0]?.nombre || '-'}</p>
              <p className="text-sm text-emerald-400">{formatGTQ(clientes[0]?.ventas_12m)} comprado</p>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Ventas por Cliente</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={clientes}
                      dataKey="ventas_12m"
                      nameKey="nombre"
                      cx="50%" cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                    >
                      {clientes.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LÍNEAS */}
      {activeTab === 'lineas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="p-4 border-b border-[var(--border-color)]">
                <h2 className="font-semibold flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-[var(--accent-primary)]" />
                  Margen por Línea de Producto
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {lineas.filter(l => l.semaforo === 'rojo').length} líneas con pérdida de margen
                </p>
              </div>
              {lLoading ? (
                <div className="p-6 text-[var(--text-muted)]">Cargando líneas...</div>
              ) : (
                <SortableTable
                  columns={[
                    { key: 'nombre', label: 'Línea', sortable: false },
                    { key: 'unidades_12m', label: 'Unidades', className: 'text-right', render: r => Math.round(r.unidades_12m).toLocaleString() },
                    { key: 'ventas_12m', label: 'Ventas 12m', className: 'text-right', render: r => formatGTQ(r.ventas_12m) },
                    { key: 'margen_pct_actual', label: 'Margen Actual', className: 'text-right', render: r => `${formatNum(r.margen_pct_actual)}%` },
                    { key: 'margen_pct_historico', label: 'Hace 12m', className: 'text-right', render: r => `${formatNum(r.margen_pct_historico)}%` },
                    { key: 'delta_puntos', label: 'Puntos perdidos', className: 'text-right', render: r => (
                      <span className={r.delta_puntos < 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {r.delta_puntos > 0 ? '+' : ''}{formatNum(r.delta_puntos)}
                      </span>
                    )},
                    { key: 'quetzales_perdidos', label: 'Q que dejaste de ganar', className: 'text-right', render: r => (
                      r.quetzales_perdidos > 0 ? <span className="text-red-400">{formatGTQ(r.quetzales_perdidos)}</span> : '-'
                    )},
                    { key: 'semaforo', label: '', className: 'text-center', sortable: false, render: r => (
                      <span className={`inline-block w-3 h-3 rounded-full ${
                        r.semaforo === 'rojo' ? 'bg-red-500' :
                        r.semaforo === 'ambar' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                    )},
                  ]}
                  data={lineas}
                  keyField="id"
                />
              )}
            </div>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Margen por Línea</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineas} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="margen_pct_actual" fill="#10b981" name="Margen %" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
