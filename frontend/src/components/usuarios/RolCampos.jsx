import { useState } from 'react'

const ETIQUETA_ALCANCE = {
  lineas: { titulo: 'Líneas asignadas', ayuda: 'Categorías de producto que ve este gerente.' },
  vendedores: { titulo: 'Vendedores', ayuda: 'El ejecutivo: su propio código. Gerente o asistente: los vendedores de su equipo.' },
}

// Selector de rol (+ roles adicionales) y alcance (líneas o vendedores), con el resumen
// de lo que puede ver. `value` = { rol, roles_adicionales, alcance }, `catalogo` = /auth/roles
export default function RolCampos({ value, onChange, catalogo }) {
  const extra = (value.roles_adicionales || []).filter(k => k !== value.rol)
  const roles = (catalogo?.roles || []).filter(r => r.key === value.rol || extra.includes(r.key))
  const rol = roles.length ? unir(roles) : null
  const alcance = value.alcance || {}
  const alternarExtra = (k) => onChange({ ...value, roles_adicionales: extra.includes(k) ? extra.filter(x => x !== k) : [...extra, k] })

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Rol</label>
        <select
          value={value.rol || ''}
          onChange={(e) => onChange({ ...value, rol: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639] bg-white"
          required
        >
          <option value="" disabled>Seleccione un rol…</option>
          {(catalogo?.roles || []).map(r => <option key={r.key} value={r.key}>{r.nombre}</option>)}
        </select>
      </div>

      {value.rol && (
        <details className="text-sm" open={extra.length > 0}>
          <summary className="cursor-pointer text-[var(--text-secondary)]">
            Roles adicionales{extra.length ? ` (${extra.length})` : ''}
          </summary>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            {catalogo.roles.filter(r => r.key !== value.rol).map(r => (
              <label key={r.key} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={extra.includes(r.key)} onChange={() => alternarExtra(r.key)} className="w-3.5 h-3.5 rounded" />
                {r.nombre}
              </label>
            ))}
          </div>
        </details>
      )}

      {rol && (
        <div className="flex flex-wrap gap-1">
          {catalogo.modulos.filter(m => rol.permisos[m.key]).map(m => {
            const p = rol.permisos[m.key]
            return (
              <span
                key={m.key}
                title={p.alcance ? `${m.nombre}: ${p.alcance}` : m.nombre}
                className={`text-[11px] px-1.5 py-0.5 rounded ${p.nivel === 'total' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
              >
                {m.nombre.split(' (')[0]}{p.alcance ? ` · ${p.alcance}` : ''}
              </span>
            )
          })}
        </div>
      )}

      {(rol?.alcance || []).map(k => (
        <ListaAlcance
          key={k}
          {...ETIQUETA_ALCANCE[k]}
          opciones={catalogo.opciones[k] || []}
          seleccion={alcance[k] || []}
          onChange={(sel) => onChange({ ...value, alcance: { ...alcance, [k]: sel } })}
        />
      ))}
    </div>
  )
}

// Permisos combinados de varios roles: en cada módulo el nivel más amplio
function unir(roles) {
  const permisos = {}
  for (const r of roles) {
    for (const [m, p] of Object.entries(r.permisos)) {
      if (!permisos[m] || (permisos[m].nivel !== 'total' && p.nivel === 'total')) permisos[m] = p
    }
  }
  return { permisos, alcance: [...new Set(roles.flatMap(r => r.alcance))] }
}

function ListaAlcance({ titulo, ayuda, opciones, seleccion, onChange }) {
  const [q, setQ] = useState('')
  const set = new Set(seleccion)
  const visibles = opciones.filter(o => `${o.nombre} ${o.valor}`.toLowerCase().includes(q.toLowerCase()))
  const alternar = (v) => onChange(set.has(v) ? seleccion.filter(x => x !== v) : [...seleccion, v])

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-medium text-[var(--text-primary)]">{titulo}</label>
        <span className="text-xs text-[var(--text-muted)]">{seleccion.length} seleccionados</span>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-1">{ayuda}</p>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar…"
        className="w-full mb-1 px-3 py-1.5 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639]"
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border-default)] divide-y divide-[var(--border-default)]">
        {visibles.map(o => (
          <label key={o.valor} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--bg-secondary)]">
            <input type="checkbox" checked={set.has(o.valor)} onChange={() => alternar(o.valor)} className="w-4 h-4 rounded" />
            <span className="flex-1 truncate">{o.nombre}</span>
            {o.valor !== o.nombre && <span className="text-xs text-[var(--text-muted)] tabular-nums">{o.valor}</span>}
            {o.activo === false && <span className="text-[10px] text-[var(--text-muted)]">inactivo</span>}
          </label>
        ))}
        {visibles.length === 0 && <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Sin resultados</p>}
      </div>
    </div>
  )
}
