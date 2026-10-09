import { BriefcaseIcon } from '@heroicons/react/24/outline'
import AnalisisGastos from '../components/gastos/AnalisisGastos'

// Gastos de Administración (subpágina de Gastos Operativos): el centro de costo
// "Administración" concentra ~3/4 del gasto operativo. Misma vista que Gastos
// Operativos con el centro fijo.
export default function GastosAdministracion() {
  return (
    <AnalisisGastos
      centroFijo="Administración"
      titulo="Gastos de Administración"
      icono={BriefcaseIcon}
      volver="/gastos-operativos"
    />
  )
}
