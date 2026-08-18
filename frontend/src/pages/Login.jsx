import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('demo@cfoai.com')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(email, password)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src="/logo-abaco.jpg" 
              alt="abaco" 
              className="h-24 w-auto object-contain rounded-lg"
            />
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-2">Inteligencia Financiera para CEOs</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl border border-[var(--border-default)] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Iniciar Sesión</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">Ingresa tus credenciales para continuar</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-white text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639] focus:border-transparent"
                placeholder="tu@correo.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-white text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639] focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#001639] text-white rounded-lg text-sm font-medium hover:bg-[#002a5c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-4 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <p className="text-xs text-[var(--text-muted)] mb-1 font-medium">Demo:</p>
            <p className="text-xs text-[var(--text-secondary)]">Correo: <span className="font-mono">demo@cfoai.com</span></p>
            <p className="text-xs text-[var(--text-secondary)]">Contraseña: <span className="font-mono">demo123</span></p>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          © 2025 abaco — Versión Demo
        </p>
      </div>
    </div>
  )
}
