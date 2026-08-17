import { Link, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  BanknotesIcon as BanknotesIconNav,
  BanknotesIcon,
  BookOpenIcon,
  ChartBarIcon,
  DocumentCheckIcon,
  CpuChipIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  UsersIcon,
  ShoppingBagIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import AgentChat from '../agents/AgentChat'

const navigation = [
  { name: 'Panel', href: '/', icon: HomeIcon },
  { name: 'Ventas', href: '/ventas', icon: ShoppingBagIcon },
  { name: 'Gastos Operativos', href: '/gastos-operativos', icon: BanknotesIconNav },
  { name: 'Tesorería', href: '/tesoreria', icon: BanknotesIcon },
  // { name: 'Contabilidad', href: '/contabilidad', icon: BookOpenIcon },
  { name: 'Análisis', href: '/analisis', icon: ChartBarIcon },
  { name: 'Márgenes', href: '/margenes', icon: TagIcon },
  // { name: 'SAT', href: '/sat', icon: DocumentCheckIcon },
  { name: 'Agentes IA', href: '/log-actividades', icon: CpuChipIcon },
  { name: 'Usuarios', href: '/usuarios', icon: UsersIcon, adminOnly: true },
]

export default function DashboardLayout({ children }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout, isAdmin } = useAuth()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  // Obtener iniciales del usuario
  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-black/20" 
            onClick={() => setSidebarOpen(false)} 
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-[var(--border-default)]">
            <div className="flex h-20 items-center justify-between px-4 border-b border-[var(--border-default)]">
              <div className="flex items-center gap-3">
                <img src="/logo.jpg" alt="Thermoplástica, S.A." className="h-14 w-auto object-contain rounded" />
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-[var(--bg-secondary)] rounded">
                <XMarkIcon className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
            
            <nav className="p-2 space-y-1">
              {navigation
                .filter(item => !item.adminOnly || isAdmin)
                .map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={isActive ? 'nav-link-active' : 'nav-link'}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Mobile user section */}
            <div className="p-4 border-t border-[var(--border-default)]">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-8 h-8 rounded-full bg-[#001639] flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{getInitials(user?.nombre)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.nombre || 'Usuario'}</p>
                  <p className="text-xs text-[var(--text-muted)]">{user?.rol || 'Usuario'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-[var(--border-default)]">
          {/* Logo */}
          <div className="flex items-center h-20 px-5 border-b border-[var(--border-default)]">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Thermoplástica, S.A." className="h-16 w-auto object-contain rounded" />
            </Link>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1">
            {navigation
              .filter(item => !item.adminOnly || isAdmin)
              .map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={isActive ? 'nav-link-active' : 'nav-link'}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                  {item.name === 'Agentes IA' && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-[var(--success)]"></span>
                  )}
                </Link>
              )
            })}
          </nav>
          
          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-default)]">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
              <div className="w-8 h-8 rounded-full bg-[#001639] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">{getInitials(user?.nombre)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.nombre || 'Usuario'}</p>
                <p className="text-xs text-[var(--text-muted)]">{isAdmin ? 'Admin' : (user?.rol || 'Usuario')}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between h-14 px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-[var(--text-secondary)] lg:hidden hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
              
              <nav className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-[var(--text-muted)]">GT</span>
                <span className="text-[var(--border-strong)]">/</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {navigation.find(n => n.href === location.pathname)?.name || 'Panel'}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {/* User badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                <UserCircleIcon className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-primary)]">{user?.nombre || 'Usuario'}</span>
                {isAdmin && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#001639] text-white rounded-full">ADMIN</span>
                )}
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success-bg)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]"></span>
                <span className="text-xs font-medium text-[var(--success)]">Sistema operativo</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 animate-fade-in">
          {children}
        </main>
      </div>
      
      {/* AI Chat Assistant - Floating bubble */}
      <AgentChat />
    </div>
  )
}
