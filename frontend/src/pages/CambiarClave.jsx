import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL || 'https://cfo-ai-backend-4n29.onrender.com/api'

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-white text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639] focus:border-transparent'

// Pantalla obligatoria para quien entra con la contraseña que le asignó el administrador
export default function CambiarClave() {
  const { token, user, updateUser, logout } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres')
    if (nueva !== confirmar) return setError('Las contraseñas nuevas no coinciden')
    if (nueva === actual) return setError('La nueva contraseña debe ser distinta de la actual')

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/cambiar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ passwordActual: actual, passwordNuevo: nueva })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'No se pudo cambiar la contraseña')
      updateUser({ debe_cambiar_clave: false })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-abaco.jpg" alt="abaco" className="h-24 w-auto object-contain rounded-lg inline-block" />
        </div>

        <div className="bg-white rounded-xl border border-[var(--border-default)] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Cambie su contraseña</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {user?.nombre ? `${user.nombre}, ingresó` : 'Ingresó'} con una contraseña temporal. Elija una nueva para continuar.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" value={user?.email || ''} autoComplete="username" readOnly hidden />
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Contraseña actual</label>
              <input type="password" value={actual} onChange={(e) => setActual(e.target.value)}
                className={inputCls} autoComplete="current-password" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Nueva contraseña</label>
              <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)}
                className={inputCls} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Confirmar nueva contraseña</label>
              <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
                className={inputCls} autoComplete="new-password" required />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-[#001639] text-white rounded-lg text-sm font-medium hover:bg-[#002a5c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>

          <button onClick={logout} className="w-full mt-3 text-sm text-[var(--text-muted)] hover:underline">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
