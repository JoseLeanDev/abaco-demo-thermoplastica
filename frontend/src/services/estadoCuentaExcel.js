// Estado de cuenta de un cliente en Excel, con el diseño de la plantilla que usa
// Créditos y Cobros de Thermoplástica (una hoja carta, lista para imprimir o guardar en PDF).
// exceljs se carga solo al exportar.

const AZUL = 'FF174A82'
const CELESTE = 'FF29A3DC'
const FONDO = 'FFEAF3FA'
const AMARILLO = 'FFFFF9DB'
const ROJO = 'FFC00000'
const GRIS = 'FF6B7280'
const LINEA = 'FFDCE3EA'
const FUENTE = 'Segoe UI'

const MONEDA = '#,##0.00'

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const font = (o = {}) => ({ name: FUENTE, size: 9, color: { argb: 'FF1F2937' }, ...o })
const fechaGT = (s) => {
  if (!s) return ''
  const [y, m, d] = String(s).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// "1092816" → "FACT-A092816": en el ERP el primer dígito es la serie (1 = A, 2 = B, ...)
export function etiquetaDocumento(tipo, doc) {
  const s = String(doc ?? '')
  const serie = /^[1-9]\d{6}$/.test(s) ? String.fromCharCode(64 + Number(s[0])) + s.slice(1) : s
  return `${tipo || 'DOC'}-${serie}`
}

// Nombre del cliente sin el código que el ERP le antepone ("4149262-Laboratorio...")
const nombreCliente = (c) => String(c.nombre || '').replace(new RegExp(`^${c.codigo}\\s*-\\s*`), '').toUpperCase()

async function logoBase64() {
  try {
    const res = await fetch('/logo-thermoplastica.png')
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    buf.forEach(b => { bin += String.fromCharCode(b) })
    return btoa(bin)
  } catch {
    return null
  }
}

export async function descargarEstadoCuentaExcel(d) {
  const { cliente: c, estado_cuenta: docs, saldo } = d
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Creditos y Cobros'
  const ws = wb.addWorksheet('Estado de cuenta', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 1, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.6, header: 0.2, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&C&"${FUENTE}"&8&K6B7280Thermoplástica, S.A.  ·  Departamento de Créditos y Cobros&R&"${FUENTE}"&8&K6B7280Página &P`,
    },
  })

  // A TIPO · B NO. FACTURA · C EMISIÓN · D VENCIMIENTO · E/F MONTO · G/H SALDO · I DÍAS
  ;[16, 22, 12, 13, 3, 13, 3, 13, 11].forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const celda = (ref, valor, estilo = {}) => {
    const cell = ws.getCell(ref)
    cell.value = valor
    cell.font = font(estilo.font)
    cell.alignment = { vertical: 'middle', ...estilo.alignment }
    if (estilo.fill) cell.fill = fill(estilo.fill)
    if (estilo.numFmt) cell.numFmt = estilo.numFmt
    if (estilo.border) cell.border = estilo.border
    return cell
  }
  const rango = (r, valor, estilo = {}) => {
    const [ini, fin] = r.split(':')
    if (ini !== fin) ws.mergeCells(r)
    // El relleno y los bordes van en todas las celdas del rango para que se vean completos
    if (estilo.fill || estilo.border) {
      const [a, b] = [ws.getCell(ini), ws.getCell(fin)]
      for (let row = a.row; row <= b.row; row++) {
        for (let col = a.col; col <= b.col; col++) {
          const cell = ws.getCell(row, col)
          if (estilo.fill) cell.fill = fill(estilo.fill)
          if (estilo.border) cell.border = estilo.border
        }
      }
    }
    return celda(ini, valor, estilo)
  }
  const alto = (row, h) => { ws.getRow(row).height = h }

  // ---- Encabezado ----
  const logo = await logoBase64()
  if (logo) {
    const id = wb.addImage({ base64: logo, extension: 'png' })
    ws.addImage(id, { tl: { col: 0.1, row: 0.4 }, ext: { width: 250, height: 50 } })
  }
  ;[22, 22, 16, 16].forEach((h, i) => alto(i + 1, h))
  rango('E1:I2', 'ESTADO DE CUENTA', { font: { size: 20, bold: true, color: { argb: AZUL } }, alignment: { horizontal: 'right' } })
  rango('E3:I3', 'Thermoplástica, Sociedad Anónima', { font: { bold: true, color: { argb: GRIS } }, alignment: { horizontal: 'right' } })
  rango('D4:I4', '32 Calle 5-60 Zona 3, Guatemala  ·  Tel. (502) 2317-3009', { font: { size: 8, color: { argb: GRIS } }, alignment: { horizontal: 'right' } })
  alto(5, 8)
  // Franja azul / celeste
  alto(6, 4)
  for (let col = 1; col <= 9; col++) ws.getCell(6, col).fill = fill(col <= 6 ? AZUL : CELESTE)
  alto(7, 10)

  // ---- Cliente ----
  const subrayado = { bottom: { style: 'thin', color: { argb: 'FFB8C4D0' } } }
  const etiqueta = { font: { size: 8, bold: true, color: { argb: AZUL } }, fill: FONDO, alignment: { indent: 1 } }
  ;[8, 9].forEach(r => alto(r, 24))
  rango('A8:A8', 'CLIENTE', etiqueta)
  rango('B8:E8', nombreCliente(c), { font: { size: 10, bold: true }, border: subrayado, alignment: { indent: 1 } })
  rango('F8:G8', 'CÓDIGO', { ...etiqueta, alignment: { horizontal: 'right', indent: 1 } })
  rango('H8:I8', String(c.codigo ?? ''), { font: { size: 10, bold: true }, fill: AMARILLO, border: subrayado, alignment: { indent: 1 } })
  rango('A9:A9', 'VENDEDOR', etiqueta)
  rango('B9:E9', String(c.vendedor || '—').toUpperCase(), { font: { size: 10, bold: true }, border: subrayado, alignment: { indent: 1 } })
  rango('F9:G9', 'FECHA', { ...etiqueta, alignment: { horizontal: 'right', indent: 1 } })
  rango('H9:I9', fechaGT(saldo.corte), { font: { size: 10, bold: true }, border: subrayado, alignment: { indent: 1 } })
  alto(10, 12)

  // ---- Saldos ----
  const separador = { left: { style: 'medium', color: { argb: 'FFFFFFFF' } }, right: { style: 'medium', color: { argb: 'FFFFFFFF' } } }
  alto(11, 20); alto(12, 26)
  const caja = (cols, titulo, valor, oscuro, rojo) => {
    const [a, b] = cols
    const tf = oscuro ? 'FFFFFFFF' : GRIS
    rango(`${a}11:${b}11`, titulo, { font: { size: 8, bold: true, color: { argb: tf } }, fill: oscuro ? AZUL : FONDO, border: separador, alignment: { horizontal: 'center', vertical: 'bottom' } })
    rango(`${a}12:${b}12`, valor, {
      font: { size: 13, bold: true, color: { argb: oscuro ? 'FFFFFFFF' : rojo ? ROJO : 'FF1F2937' } },
      fill: oscuro ? AZUL : FONDO, border: separador, numFmt: `"Q "${MONEDA}`, alignment: { horizontal: 'center', vertical: 'top' },
    })
  }
  caja(['A', 'B'], 'SALDO VENCIDO', saldo.vencido || 0, false, true)
  caja(['C', 'E'], 'SALDO POR VENCER', saldo.por_vencer || 0)
  caja(['F', 'I'], 'SALDO TOTAL', saldo.total || 0, true)
  alto(13, 14)

  // ---- Antigüedad ----
  alto(14, 20)
  rango('A14:D14', 'ANTIGÜEDAD DE SALDOS', { font: { size: 9, bold: true, color: { argb: AZUL } } })
  alto(15, 18); alto(16, 22)
  const ag = saldo.aging || {}
  ;[
    ['A', 'B', 'Por vencer', ag.por_vencer],
    ['C', 'C', '0 - 30 días', ag.d1_30],
    ['D', 'D', '31 - 60 días', ag.d31_60],
    ['E', 'F', '61 - 90 días', ag.d61_90],
    ['G', 'I', 'Más de 90 días', ag.d90_mas, true],
  ].forEach(([a, b, t, v, rojo]) => {
    rango(`${a}15:${b}15`, t, { font: { size: 8, color: { argb: GRIS } }, fill: FONDO, border: separador, alignment: { horizontal: 'center' } })
    rango(`${a}16:${b}16`, v || 0, {
      font: { size: 9.5, bold: true, color: { argb: rojo ? ROJO : 'FF1F2937' } }, fill: FONDO, border: separador,
      numFmt: `"Q "${MONEDA}`, alignment: { horizontal: 'center' },
    })
  })
  alto(17, 14)

  // ---- Documentos ----
  const H = 18
  alto(H, 30)
  const enc = { font: { size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }, fill: AZUL, alignment: { horizontal: 'center', wrapText: true } }
  rango(`A${H}:A${H}`, 'TIPO', enc)
  rango(`B${H}:B${H}`, 'NO. FACTURA', enc)
  rango(`C${H}:C${H}`, 'EMISIÓN', enc)
  rango(`D${H}:D${H}`, 'VENCIMIENTO', enc)
  rango(`E${H}:F${H}`, 'MONTO\nDOCUMENTO', enc)
  rango(`G${H}:H${H}`, 'SALDO', enc)
  rango(`I${H}:I${H}`, 'DÍAS\nVENCIDOS', enc)

  const linea = { bottom: { style: 'thin', color: { argb: LINEA } } }
  docs.forEach((x, i) => {
    const r = H + 1 + i
    alto(r, 18)
    const base = { border: linea, alignment: { horizontal: 'center' } }
    celda(`A${r}`, etiquetaDocumento(x.tipo_documento, x.documento), base)
    celda(`B${r}`, x.fel || String(x.documento), base)
    celda(`C${r}`, fechaGT(x.fecha_emision), base)
    celda(`D${r}`, fechaGT(x.fecha_vencimiento), base)
    celda(`E${r}`, 'Q', { border: linea, alignment: { horizontal: 'left', indent: 1 } })
    celda(`F${r}`, Number(x.valor ?? x.saldo) || 0, { border: linea, numFmt: MONEDA, alignment: { horizontal: 'right' } })
    celda(`G${r}`, 'Q', { border: linea, alignment: { horizontal: 'left', indent: 1 } })
    celda(`H${r}`, Number(x.saldo) || 0, { border: linea, numFmt: MONEDA, alignment: { horizontal: 'right' } })
    const vencido = Number(x.vencido) > 0 && x.dias_vencido > 0
    celda(`I${r}`, vencido ? x.dias_vencido : 'Por vencer', { ...base, font: vencido ? { color: { argb: ROJO } } : {} })
  })

  // Totales
  const T = H + 1 + docs.length
  alto(T, 22)
  for (let col = 1; col <= 9; col++) ws.getCell(T, col).fill = fill(FONDO)
  const sumaValor = docs.reduce((t, x) => t + (Number(x.valor ?? x.saldo) || 0), 0)
  celda(`A${T}`, `Documentos: ${docs.length}`, { fill: FONDO, font: { color: { argb: GRIS } }, alignment: { indent: 1 } })
  celda(`D${T}`, 'TOTALES', { fill: FONDO, font: { bold: true, color: { argb: AZUL } }, alignment: { horizontal: 'right' } })
  celda(`E${T}`, 'Q', { fill: FONDO, font: { bold: true }, alignment: { indent: 1 } })
  celda(`F${T}`, sumaValor, { fill: FONDO, font: { bold: true }, numFmt: MONEDA, alignment: { horizontal: 'right' } })
  celda(`G${T}`, 'Q', { fill: FONDO, font: { bold: true }, alignment: { indent: 1 } })
  celda(`H${T}`, saldo.total || 0, { fill: FONDO, font: { bold: true }, numFmt: MONEDA, alignment: { horizontal: 'right' } })

  // Nota al cliente
  alto(T + 1, 10)
  alto(T + 2, 34)
  rango(`A${T + 2}:I${T + 2}`,
    'Estimado cliente: le compartimos el detalle de sus documentos pendientes a la fecha indicada. Si ya realizó su pago, le agradeceremos enviarnos el comprobante y hacer caso omiso de este aviso. Para cualquier consulta, comuníquese con el Departamento de Créditos y Cobros al (502) 2317-3009.',
    { font: { size: 8, italic: true, color: { argb: GRIS } }, alignment: { wrapText: true, vertical: 'top' } })

  ws.pageSetup.printArea = `A1:I${T + 2}`
  ws.pageSetup.printTitlesRow = `${H}:${H}`

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Estado de cuenta ${c.codigo} - ${nombreCliente(c)} - ${saldo.corte || 'hoy'}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
