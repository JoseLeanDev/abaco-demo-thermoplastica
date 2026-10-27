// Matriz módulo × rol, igual que la hoja "Usuarios y roles Abaco"
export default function MatrizPermisos({ catalogo }) {
  if (!catalogo) return null
  const { modulos, roles } = catalogo

  return (
    <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-default)]">
        <h2 className="font-semibold text-[var(--text-primary)]">Permisos por módulo y rol</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          ✅ acceso completo · 👁 acceso con alcance limitado · — sin acceso.
          El alcance por fila (solo sus líneas, sus clientes, sin costo…) todavía no se aplica a los datos: hoy un 👁 ve el módulo completo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-secondary)] min-w-[180px]">Módulo</th>
              {roles.map(r => (
                <th key={r.key} className="px-2 py-2 font-medium text-[var(--text-secondary)] text-center min-w-[90px]">{r.nombre}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {modulos.map(m => (
              <tr key={m.key}>
                <td className="px-3 py-2 text-[var(--text-primary)] sticky left-0 bg-white">{m.nombre}</td>
                {roles.map(r => {
                  const p = r.permisos[m.key]
                  return (
                    <td key={r.key} className="px-2 py-2 text-center align-top">
                      {!p ? <span className="text-[var(--text-muted)]">—</span>
                        : p.nivel === 'total' ? <span>✅{p.alcance ? <span className="block text-[10px] text-[var(--text-muted)]">{p.alcance}</span> : null}</span>
                        : <span title={p.alcance}>👁<span className="block text-[10px] text-[var(--text-muted)] leading-tight">{p.alcance}</span></span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
