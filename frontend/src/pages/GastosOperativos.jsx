import { BuildingOffice2Icon } from '@heroicons/react/24/outline'
import AnalisisGastos from '../components/gastos/AnalisisGastos'

// Gastos Operativos: todo el gasto operativo por centro de costo, rubro y concepto,
// comparado con el año anterior y con las ventas. Ver components/gastos/AnalisisGastos.
export default function GastosOperativos() {
  return <AnalisisGastos titulo="Gastos Operativos" icono={BuildingOffice2Icon} volver="/" />
}
