// Adaptadores del CPP a los contratos existentes de Ventas/Márgenes.
// Cada una de las cuatro líneas comerciales conserva su fuente y su unidad.
const { obtenerReporte, metricas, DIMENSIONES } = require('./laminados');
const { LINEAS } = require('./cpp');
const trim = (v) => String(v ?? '').trim();
const sum = (rr, f) => rr.reduce((s, r) => s + Number(r[f] || 0), 0);
const grupos = (rr, fn) => {
  const m = new Map();
  for (const r of rr) { const k = fn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
};
const variacion = (a, b) => b > 0 ? (a / b - 1) * 100 : null;
const limit = (q, def = 200, max = 1000) => Math.max(1, Math.min(Number.parseInt(q.limit) || def, max));

function efectos(reporte, dim) {
  return reporte.items(dim).map((it) => {
    const a = grupos(reporte.actual.filter((r) => DIMENSIONES[dim](r) === it.clave), (r) => r.codigo_articulo);
    const h = grupos(reporte.anterior.filter((r) => DIMENSIONES[dim](r) === it.clave), (r) => r.codigo_articulo);
    let precio = 0, volumen = 0, nuevos = 0, perdidos = 0;
    for (const key of new Set([...a.keys(), ...h.keys()])) {
      const x = metricas(a.get(key) || []), y = metricas(h.get(key) || []);
      if (x.ventas_totales > 0 && y.ventas_totales > 0 && x.unidades > 0 && y.unidades > 0) {
        precio += (x.precio_promedio - y.precio_promedio) * x.unidades;
        volumen += (x.unidades - y.unidades) * y.precio_promedio;
      } else if (x.ventas_totales > 0 && y.ventas_totales <= 0) nuevos += x.ventas_totales;
      else if (y.ventas_totales > 0 && x.ventas_totales <= 0) perdidos -= y.ventas_totales;
    }
    return { ...it, efecto_precio: precio, efecto_volumen: volumen, efecto_nuevos: nuevos,
      efecto_perdidos: perdidos, efecto_otros: it.variacion - precio - volumen - nuevos - perdidos };
  });
}

function resumenVentas(r) {
  const a = r.metricas, h = r.metricas_previas;
  const mensual = [...grupos(r.actual, (v) => v.fec_emis.slice(0, 7))].map(([periodo, rr]) => {
    const s = metricas(rr);
    return { periodo, ventas: s.ventas_totales, costo: s.costo_mp, margen: s.margen_mp, margen_pct: s.margen_mp_pct, facturas: s.facturas };
  }).sort((a, b) => a.periodo.localeCompare(b.periodo));
  return { metodologia: r.meta, ventana: r.P.ventana(), ventas_sin_iva: a.ventas_totales,
    ventas_con_iva: sum(r.actual, 'total_con_iva'), ventas_prev: h.ventas_totales,
    variacion_pct: variacion(a.ventas_totales, h.ventas_totales), facturas_prev: h.facturas, clientes_prev: h.clientes,
    costo_total: a.costo_mp, margen_bruto: a.margen_mp, margen_bruto_pct: a.margen_mp_pct,
    margen_pct_prev: h.margen_mp_pct, pct_ventas_sin_costo: a.pct_sin_costo,
    ventas_con_cpp: a.ventas_con_cpp, ventas_sin_cpp: a.ventas_sin_cpp,
    iva_debito: sum(r.actual, 'iva'), facturas: a.facturas, clientes: a.clientes,
    vendedores: new Set(r.actual.map((r) => r.nombre_vendedor)).size, lineas: r.actual.length,
    ticket_promedio: a.facturas ? a.ventas_totales / a.facturas : null, serie_mensual: mensual };
}

function detalleVenta(r, q) {
  let rr = r.actual.filter((v) => (!q.codigo_cliente || trim(v.codigo_cliente) === q.codigo_cliente)
    && (!q.vendedor || trim(v.nombre_vendedor) === q.vendedor)
    && (!q.busqueda || [v.cliente,v.codigo_cliente,v.articulo,v.fact_num,v.fel].some((s) => trim(s).toLowerCase().includes(String(q.busqueda).toLowerCase()))));
  rr.sort((a, b) => b.fec_emis.localeCompare(a.fec_emis) || b.venta - a.venta);
  const offset = Math.max(0, Number.parseInt(q.offset) || 0);
  return { metodologia: r.meta, ventana: r.P.ventana(), total_filas: rr.length, suma_ventas: sum(rr, 'venta'),
    filas: rr.slice(offset, offset + limit(q)).map((v) => ({
      id: v.raw_id, fact_num: v.fact_num, tipo_doc: v.tipo_doc, fecha_emision: v.fec_emis,
      fel: v.fel, vendedor: v.nombre_vendedor, codigo_vendedor: v.codigo_vendedor,
      cliente: v.cliente, sucursal: v.sucursal, codigo_articulo: v.codigo_articulo,
      articulo: v.articulo, sublinea: v.sublinea, tipo_cliente: v.tipo_cliente,
      fuente_cpp: v.fuente_cpp, corte_cpp: v.corte_cpp,
      codigo_sucursal: trim(v.co_sucu), codigo_cliente: trim(v.codigo_cliente),
      linea_origen: v.linea, linea: v.categoria, total_sin_iva: v.venta, unidades: v.cantidad, cpp: v.cpp,
      total_con_iva: Number(v.total_con_iva || 0), iva: Number(v.iva || 0), saldo: Number(v.saldo || 0),
      costo_promedio_facturado: Number(v.costo_promedio_facturado || 0),
      costo_total_facturado: v.costo_mp, margen_bruto: v.margen_mp, margen_bruto_pct: v.margen_mp_pct,
      sin_costo: v.cpp === null,
    })) };
}

function serie(r, q, dim, conOtros) {
  const top = Math.max(1, Math.min(Number.parseInt(q.top || q.limit) || 6, 20));
  const ranking = r.items(dim).filter((i) => i.ventas > 0);
  const nombres = ranking.slice(0, top).map((i) => i.nombre);
  const porKey = new Map(ranking.slice(0, top).map((i) => [i.clave, i.nombre]));
  const meses = new Map();
  let hayOtros = false;
  for (const v of r.actual) {
    const nombre = porKey.get(DIMENSIONES[dim](v)) || (conOtros ? 'Otros' : null);
    if (!nombre) continue;
    if (nombre === 'Otros') hayOtros = true;
    const mes = v.fec_emis.slice(0, 7);
    if (!meses.has(mes)) meses.set(mes, Object.create(null));
    const row = meses.get(mes); row.periodo = mes; row[nombre] = (row[nombre] || 0) + v.venta;
  }
  return { metodologia: r.meta, ventana: r.P.ventana(), dim, series: [...nombres, ...(hayOtros ? ['Otros'] : [])],
    serie: [...meses.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)) };
}

function adaptarVentas(r, ruta, q) {
  if (ruta === '/') return resumenVentas(r);
  if (ruta === '/detalle') return detalleVenta(r, q);
  if (ruta === '/matriz') {
    const fd = DIMENSIONES[q.filas] ? q.filas : 'categoria', cd = DIMENSIONES[q.columnas] ? q.columnas : 'vendedor';
    if (fd === cd) throw Object.assign(new Error('Filas y columnas deben ser dimensiones distintas.'), { statusCode: 400 });
    const ff = r.items(fd).filter((i) => i.ventas > 0).slice(0, Math.max(1, Math.min(Number.parseInt(q.top_filas) || 30, 100)));
    const cc = r.items(cd).filter((i) => i.ventas > 0).slice(0, Math.max(1, Math.min(Number.parseInt(q.top_columnas) || 8, 15)));
    const fNombres = new Map(ff.map((i) => [i.clave, i.nombre])), cNombres = new Map(cc.map((i) => [i.clave, i.nombre]));
    const fg = grupos(r.actual, (v) => fNombres.get(DIMENSIONES[fd](v)) || 'Otros');
    const columnas = [...cc.map((i) => i.nombre)];
    const filas = [...fg].map(([nombre, rr]) => {
      const cg = grupos(rr, (v) => cNombres.get(DIMENSIONES[cd](v)) || 'Otros');
      if (cg.has('Otros') && !columnas.includes('Otros')) columnas.push('Otros');
      return { nombre, total: metricas(rr).ventas_totales, celdas: Object.fromEntries([...cg].map(([n, ss]) => {
        const m = metricas(ss); return [n, { ventas: m.ventas_totales, margen_pct: m.margen_mp_pct }];
      })) };
    }).sort((a, b) => b.total - a.total);
    return { metodologia: r.meta, ventana: r.P.ventana(), filas_dim: fd, columnas_dim: cd, columnas, filas,
      totales_columna: Object.fromEntries(columnas.map((c) => [c, filas.reduce((s, f) => s + (f.celdas[c]?.ventas || 0), 0)])), total: r.metricas.ventas_totales };
  }
  if (ruta === '/articulos') return { metodologia: r.meta, ventana: r.P.ventana(), articulos: r.items('articulo').filter((i) => i.ventas > 0).slice(0, limit(q, 15, 100)).map((i) => ({ ...i, codigo: i.clave, descripcion: i.nombre, linea: r.actual.find((v) => v.codigo_articulo === i.clave)?.categoria, sublinea: r.actual.find((v) => v.codigo_articulo === i.clave)?.sublinea })) };
  if (['/desglose-serie','/serie-vendedores','/serie-lineas'].includes(ruta)) {
    const dim = ruta === '/serie-vendedores' ? 'vendedor' : ruta === '/serie-lineas' ? 'subcategoria' : DIMENSIONES[q.dim] ? q.dim : 'categoria';
    const s = serie(r, q, dim, ruta === '/desglose-serie' && q.otros !== '0');
    return ruta === '/serie-vendedores' ? { ...s, vendedores: s.series } : ruta === '/serie-lineas' ? { ...s, lineas: s.series } : s;
  }
  const dim = ruta === '/vendedores' ? 'vendedor' : ruta === '/clientes' ? 'cliente' : ruta === '/lineas' ? 'subcategoria' : DIMENSIONES[q.dim] ? q.dim : 'categoria';
  const items = efectos(r, dim), a = r.metricas, h = r.metricas_previas;
  const perdidos = items.filter((i) => i.perdido).sort((a, b) => b.ventas_prev - a.ventas_prev).slice(0, 25);
  const puente = { anterior: h.ventas_totales, actual: a.ventas_totales };
  for (const [k, field] of Object.entries({ precio:'efecto_precio', volumen:'efecto_volumen', nuevos:'efecto_nuevos', perdidos:'efecto_perdidos', otros:'efecto_otros' })) puente[k] = sum(items, field);
  const base = { metodologia: r.meta, ventana: r.P.ventana(), total: a.ventas_totales, total_prev: h.ventas_totales,
    variacion_pct: variacion(a.ventas_totales, h.ventas_totales), puente, dim,
    n_items: items.filter((i) => i.ventas > 0).length, n_items_prev: items.filter((i) => i.ventas_prev > 0).length,
    items: items.filter((i) => !i.perdido).slice(0, limit(q)), perdidos,
    venta_perdida: sum(perdidos, 'ventas_prev') };
  if (ruta === '/vendedores') return { ...base, vendedores: items.filter((i) => i.ventas > 0 && i.clave !== 'Sin vendedor').map((i) => ({ ...i, vendedor: i.nombre, codigo: i.extra, porcentaje: i.participacion })) };
  if (ruta === '/clientes') return { ...base, n_clientes: base.n_items, n_clientes_prev: base.n_items_prev,
    n_nuevos: items.filter((i) => i.nuevo).length, venta_nuevos: sum(items.filter((i) => i.nuevo), 'ventas'),
    n_perdidos: items.filter((i) => i.perdido).length,
    clientes: items.filter((i) => i.ventas > 0).slice(0, limit(q, 15, 500)).map((i) => ({ ...i, codigo: i.clave, cliente: i.nombre, forma_pago: i.extra, porcentaje: i.participacion })) };
  if (ruta === '/lineas') return { ...base, lineas: items.filter((i) => i.ventas > 0).map((i) => ({ ...i, linea: i.nombre, costo: i.costo, porcentaje: i.participacion })) };
  return base;
}

function adaptarMargenes(r, ruta) {
  if (ruta === '/' || ruta === '/cpp-laminados') return r.data;
  const detalle = ruta.match(/^\/producto\/(\d+)\/detalle$/);
  if (detalle) {
    const codigo = [...r.ids].find(([, id]) => id === Number(detalle[1]))?.[0];
    const producto = r.data.productos.find((p) => p.id === Number(detalle[1]));
    if (!codigo || !producto) return null;
    const historial = [...grupos(r.filas.filter((v) => v.codigo_articulo === codigo), (v) => v.fec_emis.slice(0, 7))]
      .map(([mes, rr]) => { const m = metricas(rr); return { fecha: `${mes}-01`, precio_promedio_realizado: m.precio_promedio, costo_unitario: m.costo_unitario, margen_pct: m.margen_mp_pct, unidades: m.unidades, ventas: m.ventas_totales }; })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { metodologia: r.meta, producto, historial };
  }
  const dim = ruta === '/vendedores' ? 'vendedor' : ruta === '/clientes' ? 'cliente' : 'subcategoria';
  return r.items(dim).filter((i) => i.ventas >= (dim === 'cliente' ? 1000 : 0) && i.ventas > 0).slice(0, dim === 'cliente' ? 30 : Infinity).map((i) => ({
    id: i.clave, nombre: i.nombre, es_cpp: true, ventas_12m: i.ventas, unidades_12m: i.unidades,
    margen_pct_actual: i.margen_pct, margen_pct_historico: i.margen_pct_prev,
    delta_puntos: i.margen_pct !== null && i.margen_pct_prev !== null ? i.margen_pct - i.margen_pct_prev : null,
    semaforo: i.margen_pct === null || i.margen_pct_prev === null ? null : i.margen_pct - i.margen_pct_prev >= -1 ? 'verde' : i.margen_pct - i.margen_pct_prev >= -5 ? 'ambar' : 'rojo',
  }));
}

function middlewareLaminados(modulo, pool, cargar = obtenerReporte) {
  const permitidas = modulo === 'ventas' ? ['/', '/articulos', '/detalle', '/desglose', '/vendedores', '/clientes', '/lineas', '/desglose-serie', '/serie-vendedores', '/serie-lineas', '/matriz'] : ['/', '/vendedores', '/clientes', '/lineas', '/cpp-laminados'];
  return async (req, res, next) => {
    const ruta = req.path;
    const esDetalle = modulo === 'margenes' && /^\/producto\/\d+\/detalle$/.test(ruta);
    const preview = modulo === 'margenes' && ruta === '/cpp-laminados';
    if (req.method !== 'GET' || (!permitidas.includes(ruta) && !esDetalle)) return next();
    try {
      let categoria = preview ? 'Laminados' : req.query.categoria;
      if (esDetalle && !req.query.categoria && pool) {
        categoria = (await pool.query(`SELECT linea FROM (
          SELECT 'Laminados' AS linea,fecha_emision FROM thermoplastica.cpp_laminados_venta WHERE articulo_id=$1
          UNION ALL SELECT linea_cpp,fecha_emision FROM thermoplastica.cpp_articulos_venta WHERE articulo_id=$1
        ) x ORDER BY fecha_emision DESC LIMIT 1`,[Number(ruta.split('/')[2])])).rows[0]?.linea;
      }
      if (!LINEAS.includes(categoria)) return next();
      const reporte = await cargar({ query: { ...req.query, categoria } }, pool);
      const data = modulo === 'ventas' ? adaptarVentas(reporte, ruta, req.query) : adaptarMargenes(reporte, ruta);
      if (data === null) return res.status(404).json({ status: 'error', message: 'Artículo sin ventas en esta selección comercial.' });
      return res.json({ status: 'success', timestamp: new Date().toISOString(), metodologia: reporte.meta, data });
    } catch (e) { return res.status(e.statusCode || 500).json({ status: 'error', message: e.message }); }
  };
}

module.exports = { middlewareLaminados, adaptarVentas, adaptarMargenes, efectos };
