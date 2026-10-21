// CPP comercial: Laminados según Jonathan; las otras tres líneas solo usan
// compras del mismo artículo, según la indicación del usuario (21-oct-2026).
// Cálculo puro: no consulta ni escribe en la base y todavía no sustituye margen.js.
// Las cantidades se conservan en la unidad del exporte. La compatibilidad entre
// compras/ventas y entre artículos agrupados debe validarse antes de publicar.

const LINEAS = Object.freeze([
  'Laminados', 'Empaques para alimentos', 'Tapas y Valvulas', 'Inyectables',
]);
const UNIDADES = Object.freeze({
  Laminados: { unidad: 'kg', estado: 'documentada_pdf' },
  'Empaques para alimentos': { unidad: 'unidad_erp', estado: 'pendiente_confirmacion' },
  'Tapas y Valvulas': { unidad: 'unidad_erp', estado: 'pendiente_confirmacion' },
  Inyectables: { unidad: 'unidad_erp', estado: 'pendiente_confirmacion' },
});
const MANUALES = Object.freeze({
  'Aluminio Impreso': 82,
  'Foil aluminio blister impreso': 70.4,
});
const limpiar = (s) => String(s ?? '').trim();
const normalizar = (s) => limpiar(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const numero = (v) => (!['string', 'number'].includes(typeof v) || limpiar(v) === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function fecha(v) {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : limpiar(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

function fleteCompra(r) {
  const n = normalizar(r.proveedor);
  const anio = Number(fecha(r.fec_emis)?.slice(0, 4));
  let porKg = 0;
  if (n.includes('BESEL') || n.includes('BASIM')) porKg = 3.9;
  else if (['MAXIMORE', 'MM PACK', 'M&M'].some((s) => n.includes(s))) porKg = anio <= 2025 ? 2.34 : 3.9;
  if (!porKg) return { por_unidad: 0, estado: 'no_aplica' };
  // El PDF acredita kilos para Laminados; no inferir kilos para otras líneas.
  if (limpiar(r.linea) !== 'Laminados') return { por_unidad: null, estado: 'unidad_flete_pendiente' };
  return { por_unidad: porKg, estado: 'flete_pdf' };
}

const llave = (r, nivel) => JSON.stringify(nivel === 'articulo'
  ? [limpiar(r.codigo_articulo)]
  : ['categoria', 'sublinea', 'color'].slice(0, nivel).map((k) => limpiar(r[k])));
const idTabla = (anio, ventana, nivel, key) => JSON.stringify([anio, ventana, nivel, key]);

function crearCalculador(compras, { corte } = {}) {
  corte = fecha(corte);
  if (!corte) throw new Error('Se requiere una fecha de corte válida para las compras.');
  const dia = new Date(`${corte}T00:00:00Z`);
  if (new Date(dia.getTime() + 86400000).getUTCDate() !== 1) {
    throw new Error('El corte de CPP debe corresponder al último día de un mes cerrado.');
  }
  const grupos = new Map();
  const aniosPorArticulo = new Map();
  const incidencias = [];
  let primeraCompra = null;
  for (const r of compras) {
    const f = fecha(r.fec_emis);
    if (!f || f > corte) continue;
    if (r.tipo_doc && !['FACT', 'NC'].includes(limpiar(r.tipo_doc))) {
      incidencias.push({ motivo: 'tipo_documento_compra_no_admitido', factura: r.fact_num });
      continue;
    }
    const cantidad = numero(r.unidades), importe = numero(r.total_sin_iva);
    const flete = fleteCompra(r);
    const error = cantidad === null || importe === null ? 'compra_incompleta' : flete.estado === 'unidad_flete_pendiente' ? flete.estado : null;
    if (error) {
      incidencias.push({ motivo: error, factura: r.fact_num, articulo: r.codigo_articulo });
    }
    const anio = Number(f.slice(0, 4)), mes = Number(f.slice(5, 7));
    const codigo = limpiar(r.codigo_articulo);
    if (codigo) {
      if (!aniosPorArticulo.has(codigo)) aniosPorArticulo.set(codigo, new Set());
      aniosPorArticulo.get(codigo).add(anio);
    }
    primeraCompra = primeraCompra === null || f < primeraCompra ? f : primeraCompra;
    for (const ventana of mes >= 7 ? ['full', 'h2'] : ['full']) {
      for (const nivel of [3, 2, 1, 'articulo']) {
        if (nivel === 'articulo' && !codigo) continue;
        const id = idTabla(anio, ventana, nivel, llave(r, nivel));
        if (!grupos.has(id)) grupos.set(id, { cantidad: 0, costo: 0, flete: 0, filas: 0, lineas: new Set(), errores: new Set(), desde: f, hasta: f });
        const g = grupos.get(id);
        g.filas += 1;
        g.lineas.add(limpiar(r.linea));
        if (f < g.desde) g.desde = f;
        if (f > g.hasta) g.hasta = f;
        if (error) { g.errores.add(error); continue; }
        const cargo = cantidad * flete.por_unidad;
        g.cantidad += cantidad;
        g.costo += importe + cargo;
        g.flete += cargo;
      }
    }
  }

  function buscar(r) {
    const f = fecha(r.fec_emis);
    if (!f || f > corte) return { cpp: null, fuente_cpp: 'fuera_de_corte' };
    const anio = Number(f.slice(0, 4));
    const porArticulo = LINEAS.includes(limpiar(r.linea)) && limpiar(r.linea) !== 'Laminados';
    if (porArticulo && !limpiar(r.codigo_articulo)) {
      return { cpp: null, fuente_cpp: 'articulo_sin_codigo', advertencias: [] };
    }
    if (!porArticulo && anio === 2026 && limpiar(r.categoria) === 'Foil de Aluminio' && limpiar(r.sublinea) === '25 micras' && limpiar(r.color) === 'Mate') {
      return { cpp: 75.99, fuente_cpp: 'manual_override', advertencias: [] };
    }
    // Para las tres líneas por artículo se recorre su historial disponible,
    // del año más reciente al más antiguo. Se conserva la preferencia H2/full
    // del documento dentro de cada año anterior; nunca se mezclan otros SKUs.
    const anteriores = porArticulo ? [...(aniosPorArticulo.get(limpiar(r.codigo_articulo)) || [])]
      .filter((a) => a < anio).sort((a, b) => b - a) : [];
    const orden = porArticulo ? [[anio, 'full', 'articulo'],
      ...anteriores.flatMap((a) => [[a, 'h2', 'articulo'], [a, 'full', 'articulo']])]
      : [[anio, 'full', 3], [anio, 'full', 2], [anio, 'full', 1],
      [anio - 1, 'h2', 3], [anio - 1, 'h2', 2], [anio - 1, 'h2', 1],
      [anio - 1, 'full', 3], [anio - 1, 'full', 2], [anio - 1, 'full', 1]];
    for (let i = 0; i < orden.length; i += 1) {
      const [a, v, n] = orden[i];
      const g = grupos.get(idTabla(a, v, n, llave(r, n)));
      if (!g) continue;
      // No sustituir un grupo incompleto por un promedio aparentemente válido.
      if (g.errores.size) return { cpp: null, fuente_cpp: 'datos_compra_pendientes', motivos: [...g.errores] };
      if (g.cantidad <= 0 || g.costo <= 0) continue;
      return {
        cpp: g.costo / g.cantidad,
        fuente_cpp: porArticulo ? (a === anio ? 'SKU_ANIO' : v === 'h2' ? 'SKU_H2_ANTERIOR' : 'SKU_ANIO_ANTERIOR') : `L${i + 1}`,
        fuente: { anio: a, ventana: v, nivel: n, llave: JSON.parse(llave(r, n)), cantidad_comprada: g.cantidad, costo_compras: g.costo, flete: g.flete, filas: g.filas, lineas: [...g.lineas].sort(), desde: g.desde, hasta: g.hasta },
        advertencias: g.lineas.size > 1 ? ['grupo_cpp_con_varias_lineas'] : [],
      };
    }
    if (!porArticulo && Object.hasOwn(MANUALES, limpiar(r.categoria))) {
      return { cpp: MANUALES[limpiar(r.categoria)], fuente_cpp: 'manual_cpp', advertencias: [] };
    }
    return { cpp: null, fuente_cpp: 'sin_cpp', advertencias: [] };
  }

  function calcularVenta(r) {
    const linea = limpiar(r.linea), cliente = normalizar(r.cliente);
    const base = { ...r, corte_cpp: corte, unidad: UNIDADES[linea]?.unidad ?? 'unidad_erp', estado_unidad: UNIDADES[linea]?.estado ?? 'fuera_de_alcance' };
    if (!LINEAS.includes(linea)) return { ...base, excluida: true, motivo: 'linea_fuera_de_alcance' };
    if (cliente.includes('THERMOPLASTICA') || cliente.includes('TERMOPLASTICA')) return { ...base, excluida: true, motivo: 'venta_interna' };
    const venta = numero(r.total_sin_iva), cantidad = numero(r.unidades);
    const cpp = buscar(r);
    if (cantidad === null || venta === null || (cantidad === 0 && venta !== 0)) {
      return { ...base, cpp: null, fuente_cpp: 'venta_incompleta', venta, cantidad, costo_mp: null, margen_mp: null, margen_mp_pct: null };
    }
    const costo = cpp.cpp === null ? null : cantidad * cpp.cpp;
    const margen = costo === null ? null : venta - costo;
    const advertencias = [...(cpp.advertencias || [])];
    if (linea === 'Laminados' && ['categoria', 'sublinea', 'color'].every((k) => ['', 'NO APLICA'].includes(normalizar(r[k])))) advertencias.push('clave_totalmente_generica');
    return {
      ...base, ...cpp, advertencias, es_provisional: base.estado_unidad !== 'documentada_pdf' || advertencias.length > 0,
      venta, cantidad, costo_mp: costo, margen_mp: margen,
      margen_mp_pct: venta > 0 && margen !== null ? margen / venta * 100 : null,
      nombre_vendedor: cliente.includes('COLGATE') ? 'Gerencia Laminados' : r.nombre_vendedor,
    };
  }
  return { buscar, calcularVenta, corte, primeraCompra, incidencias };
}

function resumir(ventas) {
  let ventaTotal = 0, ventaConCpp = 0, costo = 0, conCpp = 0, filas = 0, ventasSinImporte = 0;
  let filasRevision = 0, ventasRevision = 0;
  const fuentes = {}, alertas = {}, unidades = {};
  for (const r of ventas) {
    if (r.excluida) continue;
    filas += 1;
    if (r.venta !== null && r.venta !== undefined) ventaTotal += r.venta;
    else ventasSinImporte += 1;
    if (r.es_provisional) { filasRevision += 1; if (r.venta !== null && r.venta !== undefined) ventasRevision += r.venta; }
    fuentes[r.fuente_cpp] = (fuentes[r.fuente_cpp] || 0) + 1;
    unidades[r.estado_unidad] = (unidades[r.estado_unidad] || 0) + 1;
    for (const a of r.advertencias || []) alertas[a] = (alertas[a] || 0) + 1;
    if (r.costo_mp === null || r.costo_mp === undefined || r.venta === null) continue;
    conCpp += 1;
    ventaConCpp += r.venta;
    costo += r.costo_mp;
  }
  return {
    filas, filas_sin_importe: ventasSinImporte, filas_pendientes_revision: filasRevision, ventas_pendientes_revision: ventasRevision,
    ventas_totales: ventasSinImporte ? null : ventaTotal, ventas_con_cpp: ventaConCpp,
    ventas_sin_cpp: ventasSinImporte ? null : ventaTotal - ventaConCpp, costo_mp: conCpp ? costo : null,
    margen_mp: conCpp ? ventaConCpp - costo : null,
    margen_mp_pct: conCpp && ventaConCpp > 0 ? (ventaConCpp - costo) / ventaConCpp * 100 : null,
    cobertura_ventas_pct: !ventasSinImporte && ventaTotal > 0 ? ventaConCpp / ventaTotal * 100 : null,
    fuentes_cpp: fuentes, estado_unidades: unidades, alertas,
  };
}

module.exports = { LINEAS, UNIDADES, crearCalculador, resumir, fleteCompra };
