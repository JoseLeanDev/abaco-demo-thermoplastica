import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import DashboardLayout from './components/dashboard/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Tesoreria from './pages/Tesoreria'
// import Contabilidad from './pages/Contabilidad'
import Analisis from './pages/Analisis'
import GastosOperativos from './pages/GastosOperativos'
import HistorialVentas from './pages/HistorialVentas'
import Compras from './pages/Compras'
import Ventas from './pages/Ventas'
// import SAT from './pages/SAT'
import LogActividades from './pages/LogActividades'
import Usuarios from './pages/Usuarios'
import Login from './pages/Login'
// Páginas secundarias
// import LibroDiario from './pages/LibroDiario'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import CuentasPorPagar from './pages/CuentasPorPagar'
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tesoreria" element={<Tesoreria />} />
                {/* <Route path="/contabilidad" element={<Contabilidad />} /> */}
                <Route path="/analisis" element={<Analisis />} />
                <Route path="/gastos-operativos" element={<GastosOperativos />} />
                <Route path="/gastos-operativos/historial-servicios" element={<HistorialVentas />} />
                <Route path="/compras" element={<Compras />} />
                <Route path="/compras/historial-ventas" element={<HistorialVentas />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/margenes" element={<Margenes />} />
                {/* <Route path="/sat" element={<SAT />} /> */}
                <Route path="/log-actividades" element={<LogActividades />} />
                <Route path="/usuarios" element={<Usuarios />} />
                {/* Páginas secundarias */}
                {/* <Route path="/contabilidad/libro-diario" element={<LibroDiario />} /> */}
                <Route path="/tesoreria/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
                <Route path="/tesoreria/cuentas-por-pagar" element={<CuentasPorPagar />} />
                {/* <Route path="/tesoreria/cuentas-bancarias" element={<CuentasBancarias />} /> */}
                <Route path="/tesoreria/proyecciones" element={<ProyeccionesFinancieras />} />
                {/* Cierre Mensual */}
                {/* <Route path="/contabilidad/cierre" element={<CierreDashboard />} /> */}
                {/* <Route path="/contabilidad/cierre/:anio/:mes" element={<CierreWizard />} /> */}
                {/* <Route path="/contabilidad/conciliacion/:cuentaId/:anio/:mes" element={<ConciliacionBancaria />} /> */}
              </Routes>
            </DashboardLayout>
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
