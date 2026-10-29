// Exportación a Excel (.xlsx), común a toda la app.
// columnas: [{ label, get: fila => valor }]. Los números (o textos numéricos como
// "1234.50") se escriben como número con separador de miles y los mismos decimales;
// las fechas "YYYY-MM-DD" como fecha. Códigos con ceros a la izquierda quedan como texto.
// exceljs se carga solo al exportar para no engordar el bundle inicial.

const RE_NUM = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})(T00:00:00(\.000)?Z?)?$/

function celda(v) {
  if (v === null || v === undefined || v === '') return { v: null }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { v: null }
    const dec = Number.isInteger(v) ? 0 : Math.min(4, (String(v).split('.')[1] || '').length)
    return { v, fmt: dec ? `#,##0.${'0'.repeat(Math.max(2, dec))}` : '#,##0' }
  }
  if (v instanceof Date) return { v, fmt: 'dd/mm/yyyy' }
  const s = String(v).trim()
  if (RE_NUM.test(s)) {
    const dec = (s.split('.')[1] || '').length
    return { v: Number(s), fmt: dec ? `#,##0.${'0'.repeat(dec)}` : '#,##0' }
  }
  const f = RE_FECHA.exec(s)
  if (f) return { v: new Date(Date.UTC(+f[1], +f[2] - 1, +f[3])), fmt: 'dd/mm/yyyy' }
  return { v: s }
}

async function descargar(wb, nombre) {
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre.replace(/\.(csv|xlsx)$/i, '') + '.xlsx'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Escribe filas (arreglos de valores) en la hoja; devuelve el ancho máximo por columna.
function escribir(ws, filas, anchos, desde = 1, negrita = () => false) {
  filas.forEach((fila, i) => {
    const row = ws.getRow(desde + i)
    fila.forEach((valor, j) => {
      const c = celda(valor)
      const cell = row.getCell(j + 1)
      cell.value = c.v
      if (c.fmt) cell.numFmt = c.fmt
      const largo = c.v instanceof Date ? 10 : String(valor ?? '').length
      anchos[j] = Math.max(anchos[j] || 0, largo)
    })
    if (negrita(i)) row.font = { bold: true }
  })
}

const ajustarAnchos = (ws, anchos) => anchos.forEach((w, j) => { ws.getColumn(j + 1).width = Math.min(60, Math.max(8, w + 2)) })

// Tabla: encabezado en negrita, fila fija y autofiltro.
export async function exportarExcel(nombre, columnas, filas, { hoja = 'Datos' } = {}) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(hoja.slice(0, 31))
  const anchos = []
  escribir(ws, [columnas.map(c => c.label), ...filas.map(f => columnas.map(c => c.get(f)))], anchos, 1, i => i === 0)
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF2' } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  if (columnas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
  ajustarAnchos(ws, anchos)
  await descargar(wb, nombre)
}

// Trae todas las páginas de un endpoint paginado (limit máx. 1000 en el backend).
export async function traerTodo(fn, params, { pagina = 1000, max = 50000 } = {}) {
  const filas = []
  for (let offset = 0; offset < max; offset += pagina) {
    const res = await fn({ ...params, limit: pagina, offset })
    const lote = res?.data?.filas || []
    filas.push(...lote)
    const total = res?.data?.total_filas
    if (lote.length < pagina || (total !== undefined && filas.length >= total)) break
  }
  return filas
}
