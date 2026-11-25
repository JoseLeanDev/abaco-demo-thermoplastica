// Formato compartido por los componentes de Análisis y Proyecciones.
export const fmtQ = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`

export const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}

// Redondea a 2 decimales como máximo para mostrar (18.29325… → 18.29; 18.3 queda 18.3).
// Lo que no es número (null, '—', texto) pasa igual.
export const dec2 = (n) => {
  if (typeof n === 'string' && n.trim() !== '' && Number.isFinite(Number(n))) n = Number(n)
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : n
}

export const fmtPct = (n, d = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`)

export const fmtDias = (n) => (n === null || n === undefined ? '—' : `${Math.round(Number(n))} días`)

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const fmtMes = (p) => {
  if (!p) return ''
  const [y, m] = String(p).split('-')
  return `${MESES[+m - 1]} ${y.slice(2)}`
}

export const fmtFechaCorta = (d) => {
  if (!d) return '—'
  const [, m, dia] = String(d).slice(0, 10).split('-')
  return `${+dia} ${MESES[+m - 1]}`
}

export const tooltipStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 12,
}
