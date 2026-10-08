import { createContext, useContext, useMemo, useState } from 'react'

// Filtro de fechas global: lo comparten todos los módulos y vive en la barra
// superior del layout. Default: AÑO EN CURSO (1 de enero → hoy).

export const PRESETS = [
  { id: 'ytd',          label: 'Año en curso' },
  { id: 'mes',          label: 'Mes en curso' },
  { id: '3m',           label: 'Últimos 3 meses' },
  { id: '6m',           label: 'Últimos 6 meses' },
  { id: '12m',          label: 'Últimos 12 meses' },
  { id: '24m',          label: 'Últimos 24 meses' },
  { id: 'anio_anterior', label: 'Año anterior' },
  { id: 'custom',       label: 'Personalizado' },
]

// YYYY-MM-DD en hora local (toISOString usa UTC y en GT adelanta el día después de las 18:00)
export const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function rangoDePreset(preset) {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = hoy.getMonth()
  const inicioMes = (offset) => new Date(y, m - offset, 1)
  switch (preset) {
    case 'mes':           return { desde: isoLocal(inicioMes(0)),  hasta: isoLocal(hoy) }
    case '3m':            return { desde: isoLocal(inicioMes(2)),  hasta: isoLocal(hoy) }
    case '6m':            return { desde: isoLocal(inicioMes(5)),  hasta: isoLocal(hoy) }
    case '12m':           return { desde: isoLocal(inicioMes(11)), hasta: isoLocal(hoy) }
    case '24m':           return { desde: isoLocal(inicioMes(23)), hasta: isoLocal(hoy) }
    case 'anio_anterior': return { desde: `${y - 1}-01-01`,         hasta: `${y - 1}-12-31` }
    case 'ytd':
    default:              return { desde: `${y}-01-01`,             hasta: isoLocal(hoy) }
  }
}

const fmtCorta = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PeriodoContext = createContext(null)

export function PeriodoProvider({ children }) {
  const [preset, setPreset] = useState('ytd')
  const [custom, setCustom] = useState(() => rangoDePreset('ytd'))

  const value = useMemo(() => {
    const { desde, hasta } = preset === 'custom' ? custom : rangoDePreset(preset)
    const presetLabel = PRESETS.find(p => p.id === preset)?.label
    return {
      preset,
      desde,
      hasta,
      // Params listos para pasar al API y usar en las query keys de react-query
      params: { desde, hasta },
      // "Año en curso (1 ene 2026 – 7 oct 2026)"
      etiqueta: `${presetLabel} (${fmtCorta(desde)} – ${fmtCorta(hasta)})`,
      etiquetaCorta: preset === 'custom' ? `${fmtCorta(desde)} – ${fmtCorta(hasta)}` : presetLabel,
      setPreset: (p) => {
        if (p === 'custom') setCustom(preset === 'custom' ? custom : rangoDePreset(preset))
        setPreset(p)
      },
      setCustom: (r) => { setCustom(r); setPreset('custom') },
    }
  }, [preset, custom])

  return <PeriodoContext.Provider value={value}>{children}</PeriodoContext.Provider>
}

export function usePeriodo() {
  const ctx = useContext(PeriodoContext)
  if (!ctx) throw new Error('usePeriodo debe usarse dentro de <PeriodoProvider>')
  return ctx
}
