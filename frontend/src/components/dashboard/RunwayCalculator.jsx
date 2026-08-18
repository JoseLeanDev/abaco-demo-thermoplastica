import { useMemo } from 'react'
import { 
  ArrowTrendingDownIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline'

/**
 * Calculadora de Reserva - Componente de cálculo de meses de operación
 * 
 * Fórmula: Reserva = Efectivo Disponible / Quema de Efectivo Mensual
 * Quema de Efectivo = (Gastos Operativos - Ingresos Operativos) mensual promedio
 * 
 * Umbrales:
 * - 🟢 >6 meses: Saludable
 * - 🟡 3-6 meses: Atención
 * - 🔴 <3 meses: Crítico
 */
export default function RunwayCalculator({ 
  saldoActual = 0, 
  promedioIngresosMensual = 0, 
  promedioGastosMensual = 0,
  proyeccionMeses = 12 
}) {
  // Debug: mostrar props recibidos
  console.log('RunwayCalculator props:', { 
    saldoActual, 
    promedioIngresosMensual, 
    promedioGastosMensual,
    esRentable: promedioIngresosMensual > promedioGastosMensual 
  })
  
  const calcularRunway = useMemo(() => {
    const beneficioMensual = promedioIngresosMensual - promedioGastosMensual
    
    // Runway = cuántos meses puedo operar con el efectivo actual
    // Si dejo de tener ingresos, cuánto dura mi efectivo con los gastos actuales
    const runwayMeses = promedioGastosMensual > 0 
      ? saldoActual / promedioGastosMensual 
      : 999 // Si no hay gastos, runway es prácticamente infinito
    
    // Si es rentable (ingresos > gastos)
    if (beneficioMensual > 0) {
      return {
        meses: runwayMeses,
        beneficioMensual,
        gastosMensuales: promedioGastosMensual,
        estado: 'profitable',
        mensaje: `Operando con beneficio de Q${beneficioMensual.toLocaleString()} por mes`
      }
    }
    
    // Si quema efectivo (gastos > ingresos)
    let estado = 'saludable'
    if (runwayMeses < 3) estado = 'critico'
    else if (runwayMeses < 6) estado = 'atencion'
    
    return {
      meses: runwayMeses,
      beneficioMensual: 0,
      gastosMensuales: promedioGastosMensual,
      estado,
      mensaje: `${runwayMeses.toFixed(1)} meses de operación`
    }
  }, [saldoActual, promedioIngresosMensual, promedioGastosMensual])
  
  const generarProyeccion = useMemo(() => {
    const { beneficioMensual, estado } = calcularRunway
    const datos = []
    let saldoProyectado = saldoActual
    
    // Variación mensual: positiva si rentable, negativa si quema efectivo
    const variacionMensual = estado === 'profitable' 
      ? beneficioMensual 
      : -(calcularRunway.burnRate)
    
    for (let i = 0; i <= proyeccionMeses; i++) {
      const mes = new Date()
      mes.setMonth(mes.getMonth() + i)
      
      datos.push({
        mes: mes.toLocaleDateString('es-GT', { month: 'short', year: '2-digit' }),
        saldo: Math.max(0, Math.round(saldoProyectado)),
        esCritico: estado !== 'profitable' && saldoProyectado < calcularRunway.burnRate * 3,
        esPeligro: estado !== 'profitable' && saldoProyectado <= 0,
        esCrecimiento: estado === 'profitable'
      })
      
      saldoProyectado += variacionMensual
    }
    
    return datos
  }, [saldoActual, calcularRunway, proyeccionMeses])
  
  const { meses, beneficioMensual, estado, mensaje } = calcularRunway
  const proyeccion = generarProyeccion
  
  const configEstado = {
    saludable: {
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: ClockIcon,
      label: 'SALUDABLE'
    },
    atencion: {
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: ExclamationTriangleIcon,
      label: 'REQUIERE ATENCIÓN'
    },
    critico: {
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      icon: ArrowTrendingDownIcon,
      label: 'CRÍTICO'
    },
    profitable: {
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: CalculatorIcon,
      label: 'RENTABLE'
    }
  }
  
  const config = configEstado[estado]
  const Icon = config.icon
  
  // Encontrar mes de quiebra
  const mesQuiebra = proyeccion.find(p => p.esPeligro)
  const mesCritico = proyeccion.find(p => p.esCritico && !p.esPeligro)
  
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="section-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
            <CalculatorIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">Calculadora de Reserva</h2>
            <p className="text-sm text-[var(--text-muted)]">Meses de operación con efectivo actual</p>
          </div>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} ${config.border} border`}>
          {config.label}
        </span>
      </div>
      
      <div className="p-5 space-y-6">
        {/* KPI Principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg ${config.bg} border ${config.border}`}>
            <span className="text-sm text-[var(--text-muted)]">Reserva</span>
            <p className={`text-3xl font-bold ${config.color}`}>
              {meses.toFixed(1)} meses
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {estado === 'profitable' 
                ? `Con beneficio de Q${beneficioMensual.toLocaleString()} por mes` 
                : `${meses.toFixed(1)} meses con el efectivo actual`}
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
            <span className="text-sm text-[var(--text-muted)]">
              {estado === 'profitable' ? 'Beneficio Mensual' : 'Pérdida Mensual'}
            </span>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              Q{Math.abs(beneficioMensual).toLocaleString()}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {estado === 'profitable' 
                ? 'Ingresos superan gastos' 
                : 'Gastos superan ingresos'}
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
            <span className="text-sm text-[var(--text-muted)]">Efectivo Actual</span>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              Q{saldoActual.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Disponible inmediato</p>
          </div>
        </div>
        
        {/* Alertas */}
        {(mesCritico || mesQuiebra) && estado !== 'profitable' && (
          <div className={`p-4 rounded-lg border ${mesQuiebra ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <Icon className={`w-6 h-6 ${mesQuiebra ? 'text-rose-600' : 'text-amber-600'}`} />
              <div>
                <p className={`font-semibold ${mesQuiebra ? 'text-rose-800' : 'text-amber-800'}`}>
                  {mesQuiebra 
                    ? `⚠️ Quiebra técnica proyectada: ${mesQuiebra.mes}` 
                    : `⚡ Zona crítica: ${mesCritico.mes}`}
                </p>
                <p className={`text-sm ${mesQuiebra ? 'text-rose-600' : 'text-amber-600'}`}>
                  {mesQuiebra 
                    ? 'Acción inmediata requerida: acelerar cobranzas o conseguir financiamiento'
                    : 'Considerar: negociar plazos con proveedores o línea de crédito'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Gráfico de Proyección */}
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Proyección de Efectivo (12 meses)
          </h3>
          
          <div className="h-48 flex items-end gap-1 px-2">
            {proyeccion.slice(0, 12).map((p, i) => {
              // Encontrar min y max para escalar
              const maxSaldo = Math.max(...proyeccion.map(x => x.saldo))
              const minSaldo = Math.min(...proyeccion.map(x => x.saldo))
              
              // Calcular altura: entre 20% y 100% del contenedor
              // Usar escala logarítmica para que se vean mejor las diferencias
              const ratio = maxSaldo > 0 ? p.saldo / maxSaldo : 0
              const heightPercent = Math.max(20, Math.min(100, ratio * 100))
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div 
                    className={`w-full rounded-t transition-all ${
                      p.esPeligro ? 'bg-rose-500' : 
                      p.esCritico ? 'bg-amber-500' : 
                      p.esCrecimiento ? 'bg-emerald-500' : 'bg-emerald-400'
                    }`}
                    style={{ 
                      height: `${heightPercent}%`,
                      minHeight: '20px'
                    }}
                  />
                  <span className="text-[10px] text-[var(--text-muted)] mt-1 truncate w-full text-center leading-tight">
                    {p.mes}
                  </span>
                </div>
              )
            })}
          </div>          
          {/* Leyenda */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            {estado === 'profitable' ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Acumulación de efectivo
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Saludable
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Atención
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Crítico
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Acciones Sugeridas */}
        {estado !== 'profitable' && estado !== 'saludable' && (
          <div className="border-t border-[var(--border-default)] pt-4">
            <h3 className="text-sm font-medium mb-3">🎯 Acciones Recomendadas</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { accion: 'Acelerar cobranzas', impacto: '+Q' + (saldoActual * 0.3).toLocaleString(), tiempo: '1-2 semanas' },
                { accion: 'Negociar plazos proveedores', impacto: '+15 días', tiempo: 'Inmediato' },
                { accion: 'Línea de crédito bancaria', impacto: 'Q500K disponible', tiempo: '2-4 semanas' },
                { accion: 'Reducir gastos operativos', impacto: '-20% burn rate', tiempo: '1 mes' }
              ].map((item, i) => (
                <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors">
                  <p className="font-medium text-sm">{item.accion}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[var(--success)]">{item.impacto}</span>
                    <span className="text-xs text-[var(--text-muted)]">{item.tiempo}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
