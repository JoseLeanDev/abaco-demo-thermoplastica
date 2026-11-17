import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from 'react-query'
import toast, { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

// Red de seguridad: muchas pantallas solo miran isLoading y, si la consulta falla
// (timeout de 30 s o error del servidor), quedaban vacías sin decir nada. Se avisa
// una sola vez aunque fallen varias consultas a la vez. Los 401/403/404 no: esos ya
// los maneja cada pantalla o el interceptor de cfoApi.
const avisarFallo = (error) => {
  const status = error?.response?.status
  const timeout = error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')
  if (!timeout && !(status >= 500)) return
  toast.error(
    timeout
      ? 'Una consulta tardó demasiado y no se pudo mostrar. Intente de nuevo o cambie el filtro.'
      : 'No se pudieron cargar algunos datos. Intente de nuevo en un momento.',
    { id: 'fallo-consulta', duration: 8000 }
  )
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: avisarFallo }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
// Force rebuild Tue Apr 14 12:46:26 AM CST 2026
