import { useQuery } from 'react-query'
import { endpoints } from '../services/cfoApi'
import { usePeriodo } from '../context/PeriodoContext'

// Los hooks de datos con ventana temporal leen el filtro de fechas global
// (default: año en curso) y lo incluyen en la query key.

export const useDashboard = () => {
  const { params } = usePeriodo()
  return useQuery(['dashboard', params], () => endpoints.dashboard(params), {
    keepPreviousData: true,
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
  })
}

export const useTesoreriaPosicion = () => {
  const { params } = usePeriodo()
  return useQuery(['tesoreria-posicion', params], () => endpoints.tesoreria.posicion(params), { keepPreviousData: true })
}

export const useTesoreriaCxC = () => {
  const { params } = usePeriodo()
  return useQuery(['tesoreria-cxc', params], () => endpoints.tesoreria.cxc(params), { keepPreviousData: true })
}

export const useTesoreriaCxP = () => {
  const { params } = usePeriodo()
  return useQuery(['tesoreria-cxp', params], () => endpoints.tesoreria.cxp(params), { keepPreviousData: true })
}

export const useTesoreriaProyeccion = (semanas = 13) => {
  return useQuery(['tesoreria-proyeccion', semanas], () => 
    endpoints.tesoreria.proyeccion(semanas)
  )
}

export const useAlertas = () => {
  return useQuery('alertas', endpoints.alertas, {
    refetchInterval: 60 * 1000, // Refetch cada minuto
  })
}

export const useInsights = (context = 'all') => {
  return useQuery(['insights', context], () => endpoints.analisis.insights(context), {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

// usarPeriodo=true: filtra por el período global (página Insights de IA).
// Sin él: últimos `days` días (banners de insights recientes dentro de cada módulo).
export const useInsightsHistorico = (options = {}) => {
  const { limit = 50, type, severity, days = 30, usarPeriodo = false } = options
  const { params } = usePeriodo()
  const ventana = usarPeriodo ? params : { days }
  return useQuery(
    ['insights-historico', limit, type, severity, ventana],
    () => endpoints.analisis.insightsHistorico({ limit, type, severity, ...ventana }),
    {
      refetchInterval: 10 * 60 * 1000,
    }
  )
}

export const useAgentesLogs = (options = {}) => {
  const { limit = 50, agente, categoria, status } = options
  const { params } = usePeriodo()
  return useQuery(
    ['agentes-logs', limit, agente, categoria, status, params],
    () => endpoints.agents.logs({ limit, agente, categoria, status, ...params }),
    {
      refetchInterval: 30 * 1000, // Refrescar cada 30 segundos
    }
  )
}

export const useSaludFinanciera = () => {
  const { params } = usePeriodo()
  return useQuery(['salud-financiera', params], () => endpoints.analisis.salud(params), {
    keepPreviousData: true,
    staleTime: 10 * 60 * 1000,
  })
}

export const useProyeccionVentas = (meses = 6) => {
  return useQuery(['proyeccion-ventas', meses], () => endpoints.analisis.proyeccionVentas(meses), {
    staleTime: 10 * 60 * 1000,
  })
}

export const useFlujoCaja = (semanas = 13) => {
  return useQuery(['flujo-caja', semanas], () => endpoints.analisis.flujoCaja(semanas), {
    staleTime: 10 * 60 * 1000,
  })
}

export const useMargenes = () => {
  const { params } = usePeriodo()
  return useQuery(['margenes', params], () => endpoints.margenes.resumen(params), {
    keepPreviousData: true,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

export const useMargenProductoDetalle = (id) => {
  const { params } = usePeriodo()
  return useQuery(['margen-producto-detalle', id, params], () =>
    endpoints.margenes.detalleProducto(id, params),
    { enabled: !!id }
  )
}

export const useMargenVendedores = () => {
  const { params } = usePeriodo()
  return useQuery(['margen-vendedores', params], () => endpoints.margenes.vendedores(params), {
    keepPreviousData: true,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

export const useMargenClientes = () => {
  const { params } = usePeriodo()
  return useQuery(['margen-clientes', params], () => endpoints.margenes.clientes(params), {
    keepPreviousData: true,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

export const useMargenLineas = () => {
  const { params } = usePeriodo()
  return useQuery(['margen-lineas', params], () => endpoints.margenes.lineas(params), {
    keepPreviousData: true,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}
