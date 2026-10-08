import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  UsersIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ShieldCheckIcon,
  UserIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'

const API_BASE = import.meta.env.VITE_API_URL || 'https://cfo-ai-backend-4n29.onrender.com/api'

export default function Usuarios() {
  const { user: currentUser, token, isAdmin, logout } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [showDelete, setShowDelete] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Form nuevo usuario
  const [newUser, setNewUser] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'usuario'
  })

  // Redirigir si no es admin
  useEffect(() => {
    if (!isAdmin) {
      setError('No tienes permisos de administrador para ver esta página')
      setLoading(false)
    }
  }, [isAdmin])

  // Cargar usuarios
  useEffect(() => {
    if (!isAdmin) return
    fetchUsuarios()
  }, [isAdmin])

  const fetchUsuarios = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/auth/usuarios`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setUsuarios(data.data.usuarios)
      } else {
        setError(data.message || 'Error cargando usuarios')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newUser.nombre || !newUser.email || !newUser.password) return
    if (newUser.password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('Usuario creado exitosamente')
        setNewUser({ nombre: '', email: '', password: '', rol: 'usuario' })
        setShowCreate(false)
        fetchUsuarios()
      } else {
        setMessage(data.message || 'Error creando usuario')
      }
    } catch (err) {
      setMessage('Error de conexión')
    }
    setActionLoading(false)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!showEdit) return

    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/usuarios/${showEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: showEdit.nombre,
          rol: showEdit.rol,
          activo: showEdit.activo
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('Usuario actualizado')
        setShowEdit(null)
        fetchUsuarios()
      } else {
        setMessage(data.message || 'Error actualizando usuario')
      }
    } catch (err) {
      setMessage('Error de conexión')
    }
    setActionLoading(false)
  }

  const handleToggleActive = async (id, currentActive) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/usuarios/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ activo: !currentActive })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(currentActive ? 'Usuario desactivado' : 'Usuario activado')
        fetchUsuarios()
      } else {
        setMessage(data.message || 'Error')
      }
    } catch (err) {
      setMessage('Error de conexión')
    }
    setActionLoading(false)
  }

  const handleDelete = async () => {
    if (!showDelete) return
    setActionLoading(true)
    try {
      // Soft delete = desactivar
      const res = await fetch(`${API_BASE}/auth/usuarios/${showDelete.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ activo: false })
      })
      if (res.ok) {
        setMessage('Usuario eliminado')
        setShowDelete(null)
        fetchUsuarios()
      } else {
        const data = await res.json()
        setMessage(data.message || 'Error')
      }
    } catch (err) {
      setMessage('Error de conexión')
    }
    setActionLoading(false)
  }

  // Filtrar usuarios
  const filtered = usuarios.filter(u =>
    (u.nombre?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.rol?.toLowerCase() || '').includes(search.toLowerCase())
  )

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getRolColor = (rol) => {
    if (rol === 'admin') return 'bg-[#001639] text-white'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Usuarios</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Administración de usuarios del sistema
          </p>
          <PeriodoActivo nota="la lista de usuarios no depende de fechas" className="mt-1" />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#001639] text-white rounded-lg text-sm font-medium hover:bg-[#002a5c] transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${message.includes('Error') || message.includes('desactivado') || message.includes('eliminado')
          ? 'bg-red-50 border border-red-200 text-red-700'
          : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
          <span>{message}</span>
          <button onClick={() => setMessage('')}>
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error de permisos */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <p className="text-xs mt-1">Solo los administradores pueden gestionar usuarios.</p>
          </div>
        </div>
      )}

      {/* Search */}
      {!error && (
        <div className="mb-4 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o rol..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--border-default)] bg-white text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#001639]"
          />
        </div>
      )}

      {/* Tabla */}
      {!error && !loading && (
        <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Último Login</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${u.activo ? 'bg-[#001639] text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {getInitials(u.nombre)}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{u.nombre}</p>
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">Tú</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRolColor(u.rol)}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${u.activo
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-green-500' : 'bg-red-500'}`} />
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                      {u.ultimo_login
                        ? new Date(u.ultimo_login).toLocaleDateString('es-GT', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })
                        : 'Nunca'
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setShowEdit(u)}
                          className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          title="Editar"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u.id, u.activo)}
                          disabled={actionLoading || u.id === currentUser?.id}
                          className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30"
                          title={u.activo ? 'Desactivar' : 'Activar'}
                        >
                          {u.activo
                            ? <XMarkIcon className="w-4 h-4 text-red-500" />
                            : <CheckIcon className="w-4 h-4 text-green-500" />
                          }
                        </button>
                        <button
                          onClick={() => setShowDelete(u)}
                          disabled={actionLoading || u.id === currentUser?.id}
                          className="p-1.5 rounded hover:bg-red-50 text-[var(--text-secondary)] hover:text-red-600 transition-colors disabled:opacity-30"
                          title="Eliminar"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                      No se encontraron usuarios
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#001639] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Modal: Crear Usuario */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-xl border border-[var(--border-default)] shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Nuevo Usuario</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-[var(--bg-secondary)] rounded">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Nombre</label>
                <input
                  type="text"
                  value={newUser.nombre}
                  onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Contraseña</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639]"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Rol</label>
                <select
                  value={newUser.rol}
                  onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639] bg-white"
                >
                  <option value="usuario">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 px-4 border border-[var(--border-default)] rounded-lg text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 px-4 bg-[#001639] text-white rounded-lg text-sm font-medium hover:bg-[#002a5c] disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-xl border border-[var(--border-default)] shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Editar Usuario</h3>
              <button onClick={() => setShowEdit(null)} className="p-1 hover:bg-[var(--bg-secondary)] rounded">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Nombre</label>
                <input
                  type="text"
                  value={showEdit.nombre}
                  onChange={(e) => setShowEdit({ ...showEdit, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
                <p className="px-3 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-secondary)]">
                  {showEdit.email}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Rol</label>
                <select
                  value={showEdit.rol}
                  onChange={(e) => setShowEdit({ ...showEdit, rol: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[#001639] bg-white"
                >
                  <option value="usuario">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                <input
                  type="checkbox"
                  id="activo"
                  checked={showEdit.activo}
                  onChange={(e) => setShowEdit({ ...showEdit, activo: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="activo" className="text-sm text-[var(--text-primary)] cursor-pointer">
                  Usuario activo
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(null)}
                  className="flex-1 py-2 px-4 border border-[var(--border-default)] rounded-lg text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 px-4 bg-[#001639] text-white rounded-lg text-sm font-medium hover:bg-[#002a5c] disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Eliminar */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-xl border border-[var(--border-default)] shadow-xl w-full max-w-sm">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">Eliminar Usuario</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Esta acción desactivará al usuario permanentemente.
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                ¿Estás seguro de eliminar a <strong>{showDelete.nombre}</strong> ({showDelete.email})?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDelete(null)}
                  className="flex-1 py-2 px-4 border border-[var(--border-default)] rounded-lg text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
