import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { PRESETS, usePeriodo } from '../../context/PeriodoContext'

// Selector del filtro de fechas global. Vive en la barra superior del layout,
// así está visible en todos los módulos.
export default function FiltroPeriodo() {
  const { preset, desde, hasta, setPreset, setCustom } = usePeriodo()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <CalendarDaysIcon className="w-4 h-4" />
        <span className="hidden md:inline">Período</span>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="input py-1 text-xs w-auto"
          aria-label="Período"
        >
          {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      {preset === 'custom' && (
        <div className="flex items-center gap-1 text-xs">
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => e.target.value && setCustom({ desde: e.target.value, hasta })}
            className="input py-1 text-xs w-auto"
            aria-label="Desde"
          />
          <span className="text-[var(--text-muted)]">–</span>
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => e.target.value && setCustom({ desde, hasta: e.target.value })}
            className="input py-1 text-xs w-auto"
            aria-label="Hasta"
          />
        </div>
      )}
    </div>
  )
}

// Leyenda del período activo para los encabezados de cada módulo.
export function PeriodoActivo({ nota, className = '' }) {
  const { etiqueta } = usePeriodo()
  return (
    <p className={`text-xs text-[var(--text-muted)] flex items-center gap-1 ${className}`}>
      <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />
      <span>Período: <span className="font-medium text-[var(--text-secondary)]">{etiqueta}</span>{nota ? ` · ${nota}` : ''}</span>
    </p>
  )
}
