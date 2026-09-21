import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList
} from 'recharts'

/**
 * Renderiza un bloque visual devuelto por el agente SQL.
 *
 * El agente elige el tipo de visualizacion y que columnas usar, pero NUNCA
 * escribe los datos: vienen del resultado real de su consulta SQL. Por eso
 * aqui no hay riesgo de que un numero de la grafica no cuadre con la base.
 */

// Paleta categorica validada (CVD-safe, ver skill dataviz).
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
const TINTA = '#52514e'
const REJILLA = '#e8e8e6'

const nf = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 })
const nfDec = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 })

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/** Formato compacto para ejes: 1.2M, 450K */
const corto = (v) => {
  const n = num(v)
  if (n === null) return ''
  const a = Math.abs(n)
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (a >= 1e3) return Math.round(n / 1e3) + 'K'
  return nf.format(n)
}

/** Formato de celda: numeros con separador, fechas legibles, resto tal cual */
function celda(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  const n = num(v)
  if (n !== null && typeof v !== 'boolean') {
    return Number.isInteger(n) ? nf.format(n) : nfDec.format(n)
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return String(v)
}

/** Etiqueta de eje X: si es fecha ISO la acorta a YYYY-MM */
const etiquetaX = (v) => {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 7)
  if (typeof v === 'string' && v.length > 16) return v.slice(0, 15) + '…'
  return String(v ?? '')
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-900 mb-1">{etiquetaX(label)}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-gray-700">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium tabular-nums">{celda(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function Marco({ titulo, nota, children }) {
  return (
    <div className="mt-3 border border-gray-200 rounded-xl bg-white overflow-hidden">
      {titulo && (
        <div className="px-3 pt-2.5 pb-1">
          <h4 className="text-xs font-semibold text-gray-900">{titulo}</h4>
          {nota && <p className="text-[10px] text-gray-500 mt-0.5">{nota}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

export default function BloqueVisual({ bloque }) {
  if (!bloque?.datos?.length) return null

  const { tipo, titulo, datos, num_filas } = bloque
  const llaves = Object.keys(datos[0] || {})

  // El agente puede omitir x/y; deducimos: primera columna de texto para el eje,
  // las numericas para las series.
  const numericas = llaves.filter(k => datos.every(d => d[k] === null || num(d[k]) !== null))
  const textuales = llaves.filter(k => !numericas.includes(k))

  const ejeX = bloque.x && llaves.includes(bloque.x) ? bloque.x : (textuales[0] || llaves[0])
  const series = (bloque.y?.length ? bloque.y.filter(k => llaves.includes(k)) : numericas.filter(k => k !== ejeX)).slice(0, 6)

  const nota = num_filas > datos.length ? `Mostrando ${datos.length} de ${num_filas} filas` : null

  // ---------- TABLA ----------
  if (tipo === 'tabla' || !series.length) {
    const cols = (bloque.columnas?.filter(c => llaves.includes(c)) || llaves)
    return (
      <Marco titulo={titulo} nota={nota}>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {cols.map(c => (
                  <th key={c} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap border-b border-gray-200">
                    {c.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map((fila, i) => (
                <tr key={i} className={i % 2 ? 'bg-gray-50/50' : ''}>
                  {cols.map(c => (
                    <td key={c} className={`px-3 py-1.5 whitespace-nowrap border-b border-gray-100 ${
                      numericas.includes(c) ? 'text-right tabular-nums text-gray-900' : 'text-gray-700'
                    }`}>
                      {celda(fila[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Marco>
    )
  }

  // ---------- KPI ----------
  if (tipo === 'kpi') {
    const f = datos[0]
    const campos = series.length ? series : numericas
    return (
      <Marco titulo={titulo}>
        <div className="px-3 pb-3 grid grid-cols-2 gap-3">
          {campos.slice(0, 4).map(k => (
            <div key={k}>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{k.replace(/_/g, ' ')}</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{celda(f[k])}</p>
            </div>
          ))}
        </div>
      </Marco>
    )
  }

  const datosNum = datos.map(d => {
    const o = { ...d }
    series.forEach(k => { o[k] = num(d[k]) })
    return o
  })

  // ---------- PASTEL ----------
  if (tipo === 'pastel') {
    const k = series[0]
    const orden = [...datosNum].sort((a, b) => (b[k] || 0) - (a[k] || 0))
    const top = orden.slice(0, 5)
    const resto = orden.slice(5)
    if (resto.length) top.push({ [ejeX]: `Otros (${resto.length})`, [k]: resto.reduce((s, d) => s + (d[k] || 0), 0) })

    return (
      <Marco titulo={titulo} nota={nota}>
        <div className="px-2 pb-2" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={top} dataKey={k} nameKey={ejeX} cx="50%" cy="50%" outerRadius={72} strokeWidth={2} stroke="#fff">
                {top.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Pie>
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: TINTA }} iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Marco>
    )
  }

  // ---------- LINEA ----------
  if (tipo === 'linea') {
    return (
      <Marco titulo={titulo} nota={nota}>
        <div className="px-1 pb-2" style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datosNum} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={REJILLA} vertical={false} />
              <XAxis dataKey={ejeX} tickFormatter={etiquetaX} tick={{ fontSize: 10, fill: TINTA }} axisLine={{ stroke: REJILLA }} tickLine={false} />
              <YAxis tickFormatter={corto} tick={{ fontSize: 10, fill: TINTA }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<Tip />} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />}
              {series.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={SERIES[i % SERIES.length]}
                      strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: SERIES[i % SERIES.length] }}
                      activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Marco>
    )
  }

  // ---------- BARRAS ----------
  const horizontal = datosNum.length > 6 || datosNum.some(d => String(d[ejeX] ?? '').length > 12)
  const alto = horizontal ? Math.max(170, Math.min(datosNum.length * 26 + 40, 320)) : 230

  return (
    <Marco titulo={titulo} nota={nota}>
      <div className="px-1 pb-2" style={{ height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datosNum} layout={horizontal ? 'vertical' : 'horizontal'}
                    margin={{ top: 8, right: horizontal ? 44 : 12, left: 4, bottom: 4 }} barCategoryGap="22%">
            <CartesianGrid stroke={REJILLA} horizontal={!horizontal} vertical={horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" tickFormatter={corto} tick={{ fontSize: 10, fill: TINTA }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey={ejeX} tickFormatter={etiquetaX} tick={{ fontSize: 10, fill: TINTA }}
                       axisLine={false} tickLine={false} width={104} />
              </>
            ) : (
              <>
                <XAxis dataKey={ejeX} tickFormatter={etiquetaX} tick={{ fontSize: 10, fill: TINTA }} axisLine={{ stroke: REJILLA }} tickLine={false} />
                <YAxis tickFormatter={corto} tick={{ fontSize: 10, fill: TINTA }} axisLine={false} tickLine={false} width={44} />
              </>
            )}
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />}
            {series.map((k, i) => (
              <Bar key={k} dataKey={k} fill={SERIES[i % SERIES.length]} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                {/* Etiquetas directas: el contraste de la paleta obliga a texto visible */}
                {series.length === 1 && (
                  <LabelList dataKey={k} position={horizontal ? 'right' : 'top'}
                             formatter={corto} style={{ fontSize: 9, fill: TINTA }} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Marco>
  )
}
