import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import { 
  ArrowTrendingDownIcon, 
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CheckIcon,
  CreditCardIcon,
  TagIcon,
  TruckIcon
} from '@heroicons/react/24/outline'

export default function CuentasPorPagar() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroUrgencia, setFiltroUrgencia] = useState('todos')
  
  const { data: cxpData, isLoading } = useQuery('cxp-detalle', () => endpoints.tesoreria.cxp({ proximos_dias: 90 }))
  
  const data = cxpData?.data || {}
  const proximosPagos = data.proximos_pagos || []
  
  // Mock data extendido
  const todasLasCxP = [
    { proveedor: 'Importaciones del Pacífico', nit: '1234567-8', monto: 345000, dias_restantes: 3, descuento_pronto_pago: true, factura: 'FAC-PROV-452', vencimiento: '2026-04-10', tipo: 'Importación', condicion: '2% a 7 días' },
    { proveedor: 'Servicios Eléctricos S.A.', nit: '8765432-1', monto: 89000, dias_restantes: 5, descuento_pronto_pago: false, factura: 'FAC-PROV-453', vencimiento: '2026-04-12', tipo: 'Servicios', condicion: 'Neto 30' },
    { proveedor: 'Papelera Nacional', nit: '5678901-2', monto: 45000, dias_restantes: 8, descuento_pronto_pago: true, factura: 'FAC-PROV-450', vencimiento: '2026-04-15', tipo: 'Insumos', condicion: '3% a 10 días' },
    { proveedor: 'Tecnología Avanzada S.A.', nit: '1098765-4', monto: 275000, dias_restantes: 12, descuento_pronto_pago: false, factura: 'FAC-PROV-448', vencimiento: '2026-04-20', tipo: 'Equipos', condicion: 'Neto 30' },
    { proveedor: 'Transporte Rápido', nit: '3456789-0', monto: 28000, dias_restantes: 15, descuento_pronto_pago: false, factura: 'FAC-PROV-455', vencimiento: '2026-04-23', tipo: 'Logística', condicion: 'Neto 15' },
    { proveedor: 'Químicos Industriales', nit: '6543210-9', monto: 156000, dias_restantes: 18, descuento_pronto_pago: true, factura: 'FAC-PROV-445', vencimiento: '2026-04-25', tipo: 'Materia Prima', condicion: '5% a 15 días' },
    { proveedor: 'Seguridad Corporativa', nit: '7890123-4', monto: 45000, dias_restantes: 22, descuento_pronto_pago: false, factura: 'FAC-PROV-460', vencimiento: '2026-04-30', tipo: 'Servicios', condicion: 'Neto 30' },
    { proveedor: 'Marketing Digital Pro', nit: '4567890-1', monto: 72000, dias_restantes: 25, descuento_pronto_pago: false, factura: 'FAC-PROV-462', vencimiento: '2026-05-02', tipo: 'Marketing', condicion: 'Neto 30' },
    { proveedor: 'Mantenimiento Industrial', nit: '2345678-9', monto: 125000, dias_restantes: 28, descuento_pronto_pago: false, factura: 'FAC-PROV-440', vencimiento: '2026-05-05', tipo: 'Servicios', condicion: 'Neto 30' },
    { proveedor: 'Consultoría Estratégica', nit: '8901234-5', monto: 180000, dias_restantes: 35, descuento_pronto_pago: false, factura: 'FAC-PROV-435', vencimiento: '2026-05-15', tipo: 'Consultoría', condicion: 'Neto 45' },
  ]

  const cxpFiltradas = todasLasCxP.filter(cxp => {
    const matchBusqueda = busqueda === '' || 
      cxp.proveedor.toLowerCase().includes(busqueda.toLowerCase()) ||
      cxp.factura.toLowerCase().includes(busqueda.toLowerCase()) ||
      cxp.nit.includes(busqueda)
    
    let matchUrgencia = true
    if (filtroUrgencia === 'critico') matchUrgencia = cxp.dias_restantes <= 5
    else if (filtroUrgencia === 'urgente') matchUrgencia = cxp.dias_restantes > 5 && cxp.dias_restantes <= 10
    else if (filtroUrgencia === 'descuento') matchUrgencia = cxp.descuento_pronto_pago
    else if (filtroUrgencia === 'proximo') matchUrgencia = cxp.dias_restantes > 10 && cxp.dias_restantes <= 20
    
    return matchBusqueda && matchUrgencia
  })

  const getUrgenciaConfig = (dias) => {
    if (dias <= 5) return { color: 'bg-rose-500', label: 'Crítico', badgeClass: 'badge-danger' }
    if (dias <= 10) return { color: 'bg-amber-500', label: 'Urgente', badgeClass: 'badge-warning' }
    if (dias <= 20) return { color: 'bg-blue-500', label: 'Próximo', badgeClass: 'badge-info' }
    return { color: 'bg-emerald-500', label: 'Normal', badgeClass: 'badge-success' }
  }

  const totalFiltrado = cxpFiltradas.reduce((sum, c) => sum + c.monto, 0)
  const totalDescuentos = cxpFiltradas
    .filter(c => c.descuento_pronto_pago)
    .reduce((sum, c) => sum + (c.monto * 0.03), 0)

  const pagosCriticos = todasLasCxP.filter(c => c.dias_restantes <= 5).length
  const pagosConDescuento = todasLasCxP.filter(c => c.descuento_pronto_pago).length

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/tesoreria" 
            className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <ArrowTrendingDownIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Cuentas por Pagar</h1>
              <p className="text-sm text-[var(--text-muted)]">{todasLasCxP.length} facturas pendientes • Promedio {data.promedio_dias_pago} días</p>
            </div>
          </div>
        </div>
        
        <button className="btn-secondary flex items-center gap-2">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Alert Banner */}
      {pagosCriticos > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
            <ClockIcon className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-rose-800">⚠️ {pagosCriticos} pagos críticos en los próximos 5 días</p>
            <p className="text-sm text-rose-600">Revisa las facturas marcadas en rojo para evitar recargos por mora.</p>
          </div>
        </div>
      )}

      {/* Indicadores Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <span className="kpi-label">Total por Pagar</span>
          <p className="kpi-value">Q{(data.total_cxp || 0).toLocaleString()}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{todasLasCxP.length} facturas</p>
        </div>
        
        <div className="kpi-card card-hover">
          <span className="kpi-label">Pagos Críticos (&lt;5 días)</span>
          <p className="kpi-value text-[var(--danger)]">{pagosCriticos}</p>
          <p className="text-xs text-[var(--danger)] mt-1">Atención inmediata</p>
        </div>
        
        <div className="kpi-card card-hover">
          <span className="kpi-label">Descuentos Disponibles</span>
          <p className="kpi-value text-[var(--success)]">{pagosConDescuento}</p>
          <p className="text-xs text-[var(--success)] mt-1">Ahorro potencial: Q{Math.round(totalDescuentos).toLocaleString()}</p>
        </div>
        
        <div className="kpi-card card-hover">
          <span className="kpi-label">Promedio Días Pago</span>
          <p className="kpi-value">{data.promedio_dias_pago || 0}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">días</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar proveedor, factura, NIT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input w-full pl-12"
          />
        </div>
        <select 
          value={filtroUrgencia} 
          onChange={(e) => setFiltroUrgencia(e.target.value)}
          className="input min-w-[180px]"
        >
          <option value="todos">Todos los pagos</option>
          <option value="critico">🚨 Críticos (&lt;5 días)</option>
          <option value="urgente">⚠️ Urgentes (5-10 días)</option>
          <option value="descuento">💰 Con descuento PP</option>
          <option value="proximo">📅 Próximos (10-20 días)</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <TruckIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">{cxpFiltradas.length} resultados</span>
          </div>
          <span className="text-sm font-semibold">
            Total: Q{totalFiltrado.toLocaleString()}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Proveedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Factura</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Monto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">Urgencia</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">Días</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Vencimiento</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">Descuento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {cxpFiltradas.map((cxp) => {
                const urgencia = getUrgenciaConfig(cxp.dias_restantes)
                const ahorro = cxp.descuento_pronto_pago ? cxp.monto * 0.03 : 0
                return (
                  <tr key={cxp.factura} className="hover:bg-[var(--bg-secondary)] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                          <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-muted)]" />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{cxp.proveedor}</p>
                          <p className="text-xs text-[var(--text-muted)]">NIT: {cxp.nit} • {cxp.tipo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium">{cxp.factura}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-bold tabular-nums">Q{cxp.monto.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`badge ${urgencia.badgeClass}`}>
                        <span className={`inline-block w-2 h-2 rounded-full ${urgencia.color} mr-1`} />
                        {urgencia.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-sm font-semibold ${
                        cxp.dias_restantes <= 5 ? 'text-[var(--danger)]' : 
                        cxp.dias_restantes <= 10 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                      }`}>
                        {cxp.dias_restantes} días
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--text-secondary)]">{cxp.vencimiento}</span>
                      <p className="text-xs text-[var(--text-muted)]">{cxp.condicion}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {cxp.descuento_pronto_pago ? (
                        <div className="badge-success text-[10px]">
                          <TagIcon className="w-3 h-3 inline mr-1" />
                          Ahorro: Q{ahorro.toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
