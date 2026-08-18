import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline'
import PageInsights from '../components/agents/PageInsights'
import AnalisisVentas from '../components/dashboard/AnalisisVentas'
import GastosNomina from '../components/dashboard/GastosNomina'

export default function Analisis() {
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
          <ChartBarIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Análisis Financiero</h1>
          <p className="text-sm text-[var(--text-muted)]">Ratios, rentabilidad y tendencias</p>
        </div>
      </div>

      {/* Análisis de IA */}
      <PageInsights context="analisis" maxInsights={3} />

      {/* Subsección: Análisis de Ventas (Servicios, Sucursales, Clientes) */}
      <AnalisisVentas />

      {/* Subsección: Gastos y Nómina */}
      <GastosNomina />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { titulo: 'ROI', valor: '18.5%', anterior: '16.2%', meta: '20%', tendencia: 'up' },
          { titulo: 'Margen Bruto', valor: '42.3%', anterior: '40.1%', meta: '45%', tendencia: 'up' },
          { titulo: 'Margen Neto', valor: '12.1%', anterior: '10.8%', meta: '15%', tendencia: 'up' },
          { titulo: 'EBITDA', valor: 'Q2.4M', anterior: 'Q2.1M', meta: 'Q2.8M', tendencia: 'up' },
        ].map((kpi, idx) => (
          <div key={idx} className="kpi-card card-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="kpi-label">{kpi.titulo}</span>
              <span className="badge-success text-[10px]">↑ vs mes ant.</span>
            </div>
            <div className="kpi-value">{kpi.valor}</div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Meta: {kpi.meta} · Ant: {kpi.anterior}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rentabilidad */}
        <div className="card">
          <div className="section-header">
            <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Rentabilidad por Dimensión</h2>
          </div>
          
          <div className="space-y-4 p-5 pt-0">
            {[
              { dimension: 'Por Servicio', servicio: 'Termoformados Alimentarios', rentabilidad: 45, unidades: 8500 },
              { dimension: 'Por Línea', servicio: 'Alimentaria', rentabilidad: 42, unidades: 6200 },
              { dimension: 'Por Cliente', servicio: 'Cervecería Centroamericana', rentabilidad: 48, unidades: 45 },
              { dimension: 'Por Sucursal', servicio: 'Planta Industrial Zona 3', rentabilidad: 38, unidades: 2100 },
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-muted)]">{item.dimension}</span>
                  <span className="font-bold tabular-nums">{item.rentabilidad}%</span>
                </div>
                <p className="text-sm text-[var(--text-primary)]">{item.servicio}</p>
                <div className="mt-2 h-2 bg-white rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#001639] rounded-full"
                    style={{ width: `${item.rentabilidad}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ratios */}
        <div className="card">
          <div className="section-header">
            <ArrowTrendingUpIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Análisis vs Mes Anterior</h2>
          </div>
          
          <div className="space-y-4 p-5 pt-0">
            {[
              { nombre: 'Liquidez Corriente', actual: 1.85, anterior: 1.62, umbral: 1.5, unidad: '' },
              { nombre: 'Prueba Ácida', actual: 1.32, anterior: 1.15, umbral: 1.0, unidad: '' },
              { nombre: 'Endeudamiento', actual: 0.45, anterior: 0.52, umbral: 0.6, unidad: '' },
              { nombre: 'ROE', actual: 22.5, anterior: 19.8, umbral: 15.0, unidad: '%' },
              { nombre: 'Capacidad de Utilización', actual: 85.5, anterior: 78.2, umbral: 70.0, unidad: '%' },
            ].map((ratio, idx) => {
              const variacion = ((ratio.actual - ratio.anterior) / ratio.anterior * 100).toFixed(1)
              const esPositivo = ratio.actual > ratio.anterior
              const saludable = ratio.nombre === 'Endeudamiento' ? ratio.actual < ratio.umbral : ratio.actual > ratio.umbral
              
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ratio.nombre}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs flex items-center gap-1 ${esPositivo ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {esPositivo ? <ArrowTrendingUpIcon className="w-3 h-3" /> : <ArrowTrendingDownIcon className="w-3 h-3" />}
                        {Math.abs(variacion)}%
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">Umbral: {ratio.umbral}{ratio.unidad}</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`font-bold tabular-nums ${saludable ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                      {ratio.actual}{ratio.unidad}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
