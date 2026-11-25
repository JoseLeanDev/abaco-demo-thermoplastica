import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { demoMesesCierre, demoAlertasCierre, demoCierreMensual } from '../data/demoData'
import { 
  CalendarIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  LockClosedIcon,
  PlayCircleIcon
} from '@heroicons/react/24/outline'
import { dec2 } from '../components/analisis/formato'

// Datos de ejemplo - últimos 12 meses
const mesesCierre = demoMesesCierre

// Alertas activas
const alertasActivas = demoAlertasCierre

// Datos comparativo
const comparativoData = demoCierreMensual

// Componente de tarjeta de mes
const TarjetaMes = ({ data, onAction }) => {
  const estadosConfig = {
    abierto: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-100',
      textColor: 'text-emerald-700',
      label: 'ABIERTO',
      Icon: PlayCircleIcon,
      btnClass: 'btn-primary bg-emerald-600 hover:bg-emerald-700'
    },
    'en proceso': {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      textColor: 'text-amber-700',
      label: 'EN PROCESO',
      Icon: ClockIcon,
      btnClass: 'btn-primary bg-amber-600 hover:bg-amber-700'
    },
    cerrado: {
      bg: 'bg-[var(--bg-secondary)]',
      border: 'border-[var(--border-default)]',
      iconBg: 'bg-[var(--bg-tertiary)]',
      textColor: 'text-[var(--text-muted)]',
      label: 'CERRADO',
      Icon: LockClosedIcon,
      btnClass: 'btn-secondary'
    }
  }

  const config = estadosConfig[data.estado] || estadosConfig.abierto
  const Icon = config.Icon

  return (
    <div className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.iconBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${config.textColor}`} />
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">{data.mes} {data.año}</p>
            <p className={`text-xs ${config.textColor}`}>{config.label}</p>
          </div>
        </div>
      </div>
      
      {data.fechaCierre && (
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Cerrado: {data.fechaCierre}
        </p>
      )}
      
      <button 
        onClick={() => onAction(data)}
        className={`w-full text-sm ${config.btnClass}`}
      >
        {data.estado === 'cerrado' ? 'Ver reporte' : 'Iniciar cierre'}
        <ArrowRightIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function CierreDashboard() {
  const navigate = useNavigate()
  const [filtroAño, setFiltroAño] = useState(2025)

  const mesesFiltrados = mesesCierre.filter(m => m.año === filtroAño)
  const mesActual = mesesCierre.find(m => m.estado === 'abierto')

  const handleAction = (mes) => {
    if (mes.estado === 'cerrado') {
      navigate(`/contabilidad/cierre/${mes.año}/${mes.id}`)
    } else {
      navigate(`/contabilidad/cierre/${mes.año}/${mes.id}`)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Cierre Mensual</h1>
          <p className="text-sm text-[var(--text-muted)]">Gestión de cierres contables</p>
        </div>
      </div>

      {/* Alertas */}
      {alertasActivas.length > 0 && (
        <div className="space-y-3">
          {alertasActivas.map(alerta => (
            <div 
              key={alerta.id} 
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                alerta.tipo === 'error' ? 'bg-rose-50 border-rose-200' :
                alerta.tipo === 'warning' ? 'bg-amber-50 border-amber-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              <ExclamationTriangleIcon className={`w-5 h-5 ${
                alerta.tipo === 'error' ? 'text-rose-600' :
                alerta.tipo === 'warning' ? 'text-amber-600' :
                'text-blue-600'
              }`} />
              <div className="flex-1">
                <p className="font-medium text-[var(--text-primary)]">{alerta.mensaje}</p>
                {alerta.count && <p className="text-sm text-[var(--text-muted)]">{alerta.count} items</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mes Actual */}
      {mesActual && (
        <div className="card border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <PlayCircleIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{mesActual.mes} {mesActual.año}</h2>
                <p className="text-sm text-[var(--text-muted)]">Período en curso</p>
              </div>
            </div>
            
            <button 
              onClick={() => handleAction(mesActual)}
              className="btn-primary"
            >
              Iniciar cierre
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
              <p className="text-xs text-[var(--text-muted)]">Asientos del mes</p>
              <p className="text-2xl font-bold">247</p>
            </div>
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
              <p className="text-xs text-[var(--text-muted)]">Sin conciliar</p>
              <p className="text-2xl font-bold text-[var(--warning)]">3</p>
            </div>
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
              <p className="text-xs text-[var(--text-muted)]">Días restantes</p>
              <p className="text-2xl font-bold text-[var(--success)]">12</p>
            </div>
          </div>
        </div>
      )}

      {/* Comparativo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="section-header">
            <ArrowTrendingUpIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Comparativo</h2>
          </div>
          
          <div className="p-5 pt-0 space-y-4">
            {[
              { label: 'Ventas', actual: comparativoData.mesActual.ventas, anterior: comparativoData.mesAnterior.ventas },
              { label: 'Gastos', actual: comparativoData.mesActual.gastos, anterior: comparativoData.mesAnterior.gastos },
              { label: 'Utilidad', actual: comparativoData.mesActual.utilidad, anterior: comparativoData.mesAnterior.utilidad },
            ].map((item) => {
              const variacion = ((item.actual - item.anterior) / item.anterior * 100).toFixed(1)
              const esPositivo = parseFloat(variacion) > 0
              
              return (
                <div key={item.label} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">{item.label}</p>
                    <p className="font-bold">Q{item.actual.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${esPositivo ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {esPositivo ? '+' : ''}{dec2(variacion)}%
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Ant: Q{item.anterior.toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Historial */}
        <div className="lg:col-span-2 card">
          <div className="section-header">
            <CalendarIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Historial de Cierres</h2>
            
            <select 
              value={filtroAño} 
              onChange={(e) => setFiltroAño(Number(e.target.value))}
              className="input text-sm py-1"
            >
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>
          
          <div className="p-5 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mesesFiltrados.map(mes => (
                <TarjetaMes key={mes.id} data={mes} onAction={handleAction} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
