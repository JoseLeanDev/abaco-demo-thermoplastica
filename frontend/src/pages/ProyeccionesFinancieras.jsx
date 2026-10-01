import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useTesoreriaProyeccion, useProyeccionVentas } from '../hooks/useCfoData'
import FlujoCajaProyectado from '../components/analisis/FlujoCajaProyectado'
import ProyeccionVentas from '../components/analisis/ProyeccionVentas'

/**
 * Proyecciones desde Tesorería. Usa los mismos componentes y el mismo cálculo
 * que la página de Salud financiera (/analisis); aquí se puede variar el horizonte.
 */
export default function ProyeccionesFinancieras() {
  const [semanas, setSemanas] = useState(13)
  const { data: flujoRes, isLoading: cargandoFlujo } = useTesoreriaProyeccion(semanas)
  const { data: ventasRes, isLoading: cargandoVentas } = useProyeccionVentas(6)

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/tesoreria"
            className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Proyecciones Financieras</h1>
              <p className="text-sm text-[var(--text-muted)]">Flujo de caja operativo a {semanas} semanas y ventas a 6 meses</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {[4, 8, 13, 26].map(n => (
            <button
              key={n}
              onClick={() => setSemanas(n)}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                semanas === n
                  ? 'bg-[#001639] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {n} sem
            </button>
          ))}
        </div>
      </div>

      <FlujoCajaProyectado data={flujoRes?.data} isLoading={cargandoFlujo} />

      <ProyeccionVentas data={ventasRes?.data} isLoading={cargandoVentas} />
    </div>
  )
}
