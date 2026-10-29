import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PeriodoProvider } from './context/PeriodoContext'
import DashboardLayout from './components/dashboard/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Tesoreria from './pages/Tesoreria'
// import Contabilidad from './pages/Contabilidad'
import Analisis from './pages/Analisis'
import InventarioQuieto from './pages/InventarioQuieto'
import RotacionInventario from './pages/RotacionInventario'
import VentasCompras from './pages/VentasCompras'
import GastosOperativos from './pages/GastosOperativos'
import HistorialVentas from './pages/HistorialVentas'
import Compras from './pages/Compras'
import GastosAdministracion from './pages/GastosAdministracion'
import Ventas from './pages/Ventas'
import VendedorVentas from './pages/VendedorVentas'
import Inventario from './pages/Inventario'
// import SAT from './pages/SAT'
import LogActividades from './pages/LogActividades'
import Usuarios from './pages/Usuarios'
import Login from './pages/Login'
import AsistenteIA from './pages/AsistenteIA'
import InsightsIA from './pages/InsightsIA'
// Páginas secundarias
// import LibroDiario from './pages/LibroDiario'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import ClienteCxc from './pages/ClienteCxc'
import CuentasPorPagar from './pages/CuentasPorPagar'
import ProveedorCxp from './pages/ProveedorCxp'
// import CuentasBancarias from './pages/CuentasBancarias'
import ProyeccionesFinancieras from './pages/ProyeccionesFinancieras'
import Margenes from './pages/Margenes'
// Cierre Mensual
// import CierreDashboard from './pages/CierreDashboard'
// import CierreWizard from './pages/CierreWizard'
// import ConciliacionBancaria from './pages/ConciliacionBancaria'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#001639] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-[var(--text-muted)]">Cargando...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Página fuera de los permisos del rol (p. ej. un enlace directo): aviso en lugar del módulo
function RutaPermitida({ children }) {
  const { puedeVer } = useAuth()
  const { pathname } = useLocation()
  if (puedeVer(pathname)) return children
  return (
    <div className="max-w-xl card p-6 space-y-2">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Sin acceso a este módulo</h1>
      <p className="text-sm text-[var(--text-secondary)]">
        Su rol no incluye esta página. Si la necesita, pídale al administrador del sistema que revise su rol.
      </p>
      <Link to="/" className="text-sm text-[var(--accent-blue)] hover:underline">Ir al panel</Link>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <PeriodoProvider>
            <DashboardLayout>
              <RutaPermitida>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/asistente" element={<AsistenteIA />} />
                <Route path="/insights" element={<InsightsIA />} />
                <Route path="/tesoreria" element={<Tesoreria />} />
                {/* <Route path="/contabilidad" element={<Contabilidad />} /> */}
                <Route path="/analisis" element={<Analisis />} />
                <Route path="/analisis/capital-inmovilizado" element={<InventarioQuieto />} />
                <Route path="/analisis/rotacion-inventario" element={<RotacionInventario />} />
                <Route path="/analisis/ventas-vs-compras" element={<VentasCompras />} />
                <Route path="/gastos-operativos" element={<GastosOperativos />} />
                <Route path="/gastos-operativos/administracion" element={<GastosAdministracion />} />
                <Route path="/gastos-operativos/historial-servicios" element={<HistorialVentas />} />
                <Route path="/compras" element={<Compras />} />
                <Route path="/compras/historial-ventas" element={<HistorialVentas />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/ventas/vendedor/:codigo" element={<VendedorVentas />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/margenes" element={<Margenes />} />
                {/* <Route path="/sat" element={<SAT />} /> */}
                <Route path="/log-actividades" element={<LogActividades />} />
                <Route path="/usuarios" element={<Usuarios />} />
                {/* Páginas secundarias */}
                {/* <Route path="/contabilidad/libro-diario" element={<LibroDiario />} /> */}
                <Route path="/tesoreria/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
                <Route path="/tesoreria/cuentas-por-cobrar/cliente/:id" element={<ClienteCxc />} />
                <Route path="/tesoreria/cuentas-por-pagar" element={<CuentasPorPagar />} />
                <Route path="/tesoreria/cuentas-por-pagar/proveedor/:id" element={<ProveedorCxp />} />
                {/* <Route path="/tesoreria/cuentas-bancarias" element={<CuentasBancarias />} /> */}
                <Route path="/tesoreria/proyecciones" element={<ProyeccionesFinancieras />} />
                {/* Cierre Mensual */}
                {/* <Route path="/contabilidad/cierre" element={<CierreDashboard />} /> */}
                {/* <Route path="/contabilidad/cierre/:anio/:mes" element={<CierreWizard />} /> */}
                {/* <Route path="/contabilidad/conciliacion/:cuentaId/:anio/:mes" element={<ConciliacionBancaria />} /> */}
              </Routes>
              </RutaPermitida>
            </DashboardLayout>
            </PeriodoProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
