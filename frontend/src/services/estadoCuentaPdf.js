// Estado de cuenta de un cliente en PDF, con el diseño de la plantilla que usa
// Créditos y Cobros de Thermoplástica (hoja carta).
// jsPDF se carga solo al exportar para no engordar el bundle inicial.

const AZUL = [23, 74, 130]
const CELESTE = [41, 163, 220]
const FONDO = [234, 243, 250]
const AMARILLO = [255, 249, 219]
const ROJO = [192, 0, 0]
const GRIS = [107, 114, 128]
const TEXTO = [31, 41, 55]
const LINEA = [220, 227, 234]

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

async function logoDataUrl() {
  try {
    const res = await fetch('/logo-thermoplastica.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((ok) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = () => ok(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function descargarEstadoCuentaPdf(d) {
  const { cliente: c, estado_cuenta: docs, saldo } = d
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), logoDataUrl(),
  ])
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const X0 = 36
  const X1 = W - 36
  const ANCHO = X1 - X0

  const texto = (t, x, y, { size = 9, bold = false, italic = false, color = TEXTO, align = 'left' } = {}) => {
    pdf.setFont('helvetica', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    pdf.text(String(t), x, y, { align })
  }
  const caja = (x, y, w, h, color) => { pdf.setFillColor(...color); pdf.rect(x, y, w, h, 'F') }
  const subrayar = (x, y, w) => { pdf.setDrawColor(184, 196, 208); pdf.setLineWidth(0.6); pdf.line(x, y, x + w, y) }

  // ---- Encabezado ----
  if (logo) pdf.addImage(logo, 'PNG', X0, 28, 200, 40)
  texto('ESTADO DE CUENTA', X1, 52, { size: 20, bold: true, color: AZUL, align: 'right' })
  texto('Thermoplástica, Sociedad Anónima', X1, 68, { size: 8.5, bold: true, color: GRIS, align: 'right' })
  texto('32 Calle 5-60 Zona 3, Guatemala  ·  Tel. (502) 2317-3009', X1, 82, { size: 7.5, color: GRIS, align: 'right' })
  caja(X0, 94, ANCHO * 0.7, 3.5, AZUL)
  caja(X0 + ANCHO * 0.7, 94, ANCHO * 0.3, 3.5, CELESTE)

  // ---- Cliente ----
  let y = 110
  const fila = (etq, valor, etq2, valor2, amarillo) => {
    const h = 24
    caja(X0, y, 80, h, FONDO)
    texto(etq, X0 + 8, y + 15, { size: 7.5, bold: true, color: AZUL })
    // Nombres largos: se reduce la letra para que quepan en la línea
    pdf.setFont('helvetica', 'bold')
    let size = 9.5
    while (size > 6.5 && pdf.getStringUnitWidth(valor) * size > 268) size -= 0.5
    texto(valor, X0 + 88, y + 15.5, { size, bold: true })
    subrayar(X0 + 80, y + h, 280)
    caja(X0 + 364, y, 80, h, FONDO)
    texto(etq2, X0 + 436, y + 15, { size: 7.5, bold: true, color: AZUL, align: 'right' })
    if (amarillo) caja(X0 + 444, y, ANCHO - 444, h, AMARILLO)
    texto(valor2, X0 + 452, y + 15.5, { size: 9.5, bold: true })
    subrayar(X0 + 444, y + h, ANCHO - 444)
    y += h + 2
  }
  fila('CLIENTE', nombreCliente(c), 'CÓDIGO', String(c.codigo ?? ''), true)
  fila('VENDEDOR', String(c.vendedor || '—').toUpperCase(), 'FECHA', fechaGT(saldo.corte))

  // ---- Saldos ----
  y += 12
  const tercio = (ANCHO - 8) / 3
  ;[
    ['SALDO VENCIDO', saldo.vencido, FONDO, GRIS, ROJO],
    ['SALDO POR VENCER', saldo.por_vencer, FONDO, GRIS, TEXTO],
    ['SALDO TOTAL', saldo.total, AZUL, [255, 255, 255], [255, 255, 255]],
  ].forEach(([t, v, fondo, ct, cv], i) => {
    const x = X0 + i * (tercio + 4)
    caja(x, y, tercio, 46, fondo)
    texto(t, x + tercio / 2, y + 16, { size: 7, bold: true, color: ct, align: 'center' })
    texto(`Q ${fmt(v)}`, x + tercio / 2, y + 35, { size: 13, bold: true, color: cv, align: 'center' })
  })
  y += 46 + 20

  // ---- Antigüedad ----
  texto('ANTIGÜEDAD DE SALDOS', X0 + 2, y, { size: 8, bold: true, color: AZUL })
  y += 7
  const ag = saldo.aging || {}
  const tramos = [
    ['Por vencer', ag.por_vencer, 0.28],
    ['0 - 30 días', ag.d1_30, 0.15],
    ['31 - 60 días', ag.d31_60, 0.15],
    ['61 - 90 días', ag.d61_90, 0.15],
    ['Más de 90 días', ag.d90_mas, 0.27, true],
  ]
  let x = X0
  const util = ANCHO - 3 * (tramos.length - 1)
  tramos.forEach(([t, v, p, rojo]) => {
    const w = util * p
    caja(x, y, w, 38, FONDO)
    texto(t, x + w / 2, y + 13, { size: 7, color: GRIS, align: 'center' })
    texto(`Q ${fmt(v)}`, x + w / 2, y + 29, { size: 8.5, bold: true, color: rojo ? ROJO : TEXTO, align: 'center' })
    x += w + 3
  })
  y += 38 + 14

  // ---- Documentos ----
  const sumaValor = docs.reduce((t, r) => t + (Number(r.valor ?? r.saldo) || 0), 0)
  const MONEDA = [4, 5] // columnas con "Q" a la izquierda y el monto a la derecha
  autoTable(pdf, {
    startY: y,
    margin: { left: X0, right: W - X1, bottom: 50 },
    theme: 'plain',
    head: [['TIPO', 'NO. FACTURA', 'EMISIÓN', 'VENCIMIENTO', 'MONTO\nDOCUMENTO', 'SALDO', 'DÍAS\nVENCIDOS']],
    body: docs.map(r => {
      const vencido = Number(r.vencido) > 0 && r.dias_vencido > 0
      return [
        etiquetaDocumento(r.tipo_documento, r.documento),
        r.fel || String(r.documento),
        fechaGT(r.fecha_emision),
        fechaGT(r.fecha_vencimiento),
        fmt(r.valor ?? r.saldo),
        fmt(r.saldo),
        vencido ? String(r.dias_vencido) : 'Por vencer',
      ]
    }),
    foot: [[`Documentos: ${docs.length}`, '', '', 'TOTALES', fmt(sumaValor), fmt(saldo.total), '']],
    showFoot: 'lastPage',
    styles: { font: 'helvetica', fontSize: 7.8, textColor: TEXTO, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 }, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: FONDO, fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 82 }, 1: { cellWidth: 108 }, 2: { cellWidth: 62 }, 3: { cellWidth: 68 },
      4: { cellWidth: 82, halign: 'right' }, 5: { cellWidth: 82, halign: 'right' }, 6: { cellWidth: 56 },
    },
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 6 && h.cell.raw !== 'Por vencer') h.cell.styles.textColor = ROJO
      if (h.section === 'foot') {
        if (h.column.index === 0) Object.assign(h.cell.styles, { halign: 'left', fontStyle: 'normal', textColor: GRIS, fontSize: 7.8 })
        if (h.column.index === 3) Object.assign(h.cell.styles, { halign: 'right', textColor: AZUL })
        if (MONEDA.includes(h.column.index)) h.cell.styles.halign = 'right'
      }
    },
    didDrawCell: (h) => {
      if (h.section === 'body') {
        pdf.setDrawColor(...LINEA); pdf.setLineWidth(0.5)
        pdf.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height)
      }
      if ((h.section === 'body' || h.section === 'foot') && MONEDA.includes(h.column.index)) {
        const foot = h.section === 'foot'
        pdf.setFont('helvetica', foot ? 'bold' : 'normal'); pdf.setFontSize(foot ? 8.5 : 7.8); pdf.setTextColor(...TEXTO)
        pdf.text('Q', h.cell.x + 6, h.cell.y + h.cell.height / 2, { baseline: 'middle' })
      }
    },
  })

  // ---- Nota al cliente ----
  y = pdf.lastAutoTable.finalY + 18
  const nota = pdf.splitTextToSize(
    'Estimado cliente: le compartimos el detalle de sus documentos pendientes a la fecha indicada. Si ya realizó su pago, le agradeceremos enviarnos el comprobante y hacer caso omiso de este aviso. Para cualquier consulta, comuníquese con el Departamento de Créditos y Cobros al (502) 2317-3009.',
    ANCHO,
  )
  if (y + nota.length * 10 > H - 50) { pdf.addPage(); y = 50 }
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7.5); pdf.setTextColor(...GRIS)
  pdf.text(nota, X0, y, { lineHeightFactor: 1.5 })

  // ---- Pie en cada página ----
  const paginas = pdf.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i)
    texto('Thermoplástica, S.A.  ·  Departamento de Créditos y Cobros', W / 2, H - 24, { size: 7, color: GRIS, align: 'center' })
    texto(`Página ${i}`, X1, H - 24, { size: 7, color: GRIS, align: 'right' })
  }

  pdf.setProperties({ title: `Estado de cuenta ${c.codigo} - ${nombreCliente(c)}`, author: 'Creditos y Cobros' })
  pdf.save(`Estado de cuenta ${c.codigo} - ${nombreCliente(c)} - ${saldo.corte || 'hoy'}.pdf`)
}
