import { useQuery } from 'react-query'
import { endpoints } from '../services/cfoApi'

export const useDashboard = () => {
  return useQuery('dashboard', endpoints.dashboard, {
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
  })
}

export const useTesoreriaPosicion = () => {
  return useQuery('tesoreria-posicion', endpoints.tesoreria.posicion)
}

export const useTesoreriaCxC = () => {
  return useQuery('tesoreria-cxc', endpoints.tesoreria.cxc)
}

export const useTesoreriaCxP = () => {
  return useQuery('tesoreria-cxp', endpoints.tesoreria.cxp)
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

export const useInsightsHistorico = (options = {}) => {
  const { limit = 50, type, severity, days = 30 } = options
  return useQuery(
    ['insights-historico', limit, type, severity, days],
    () => endpoints.analisis.insightsHistorico({ limit, type, severity, days }),
    {
      refetchInterval: 10 * 60 * 1000,
    }
  )
}

export const useAgentesLogs = (options = {}) => {
  const { limit = 50, agente, categoria, status, dias = 7 } = options
  return useQuery(
    ['agentes-logs', limit, agente, categoria, status, dias],
    () => endpoints.agents.logs({ limit, agente, categoria, status, dias }),
    {
      refetchInterval: 30 * 1000, // Refrescar cada 30 segundos
    }
  )
}

export const useWorkingCapital = (options = {}) => {
  const { empresaId = 1, meses = 6 } = options
  return useQuery(
    ['working-capital', empresaId, meses],
    () => endpoints.analisis.workingCapital({ empresa_id: empresaId, meses }),
    {
      refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
      staleTime: 2 * 60 * 1000,
    }
  )
}

export const useMargenes = () => {
  return useQuery('margenes', endpoints.margenes.resumen, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

export const useMargenProductoDetalle = (id) => {
  return useQuery(['margen-producto-detalle', id], () => 
    endpoints.margenes.detalleProducto(id),
    { enabled: !!id }
  )
}

export const useMargenVendedores = () => {
  return useQuery('margen-vendedores', endpoints.margenes.vendedores, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

export const useMargenClientes = () => {
  return useQuery('margen-clientes', endpoints.margenes.clientes, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

export const useMargenLineas = () => {
  return useQuery('margen-lineas', endpoints.margenes.lineas, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}
