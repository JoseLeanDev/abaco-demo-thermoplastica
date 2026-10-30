import { createContext, useContext, useState, useEffect } from 'react'
import { puedeVerRuta } from '../config/permisos'

const AuthContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_URL || 'https://cfo-ai-backend-4n29.onrender.com/api'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('cfo_token'))
  const [loading, setLoading] = useState(true)

  // Verificar token al cargar
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('cfo_token')
      if (!storedToken) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        })

        if (res.ok) {
          const data = await res.json()
          setUser(data.data.user)
          setToken(storedToken)
        } else {
          // Token inválido, limpiar
          localStorage.removeItem('cfo_token')
          setToken(null)
        }
      } catch (err) {
        console.error('[Auth] Error verificando token:', err)
        localStorage.removeItem('cfo_token')
        setToken(null)
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [])

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Error en login')
      }

      const { token: newToken, user: userData } = data.data
      localStorage.setItem('cfo_token', newToken)
      setToken(newToken)
      setUser(userData)

      return { success: true, user: userData }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const register = async (nombre, email, password, rol) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password, rol })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Error en registro')
      }

      const { token: newToken, user: userData } = data.data
      localStorage.setItem('cfo_token', newToken)
      setToken(newToken)
      setUser(userData)

      return { success: true, user: userData }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const logout = async () => {
    try {
      // Notificar al backend (opcional)
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (err) {
      // Ignorar errores de logout
    } finally {
      localStorage.removeItem('cfo_token')
      setToken(null)
      setUser(null)
    }
  }

  const updateUser = (updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }))
  }

  const isAuthenticated = !!user && !!token
  const isAdmin = user?.rol === 'admin'
  const permisos = user?.permisos || {}
  // puede('cxc') → el rol tiene ese módulo; puedeVer('/ventas') → puede abrir esa página
  const puede = (modulo) => !!permisos[modulo]
  const puedeVer = (pathname) => puedeVerRuta(permisos, pathname)
  // oculta('/ventas', 'costo') → el backend quita ese monto en ese módulo para este rol
  // ('costo' | 'margen' | 'montos' = todo lo que está en Q); sirve para no dibujar columnas vacías
  const oculta = (api, que) => (user?.ocultar?.[api] || []).includes(que)

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    isAdmin,
    permisos,
    puede,
    puedeVer,
    oculta,
    login,
    register,
    logout,
    updateUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
