const express = require('express');
const router = express.Router();

// Helper para formatear
const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0';
  return 'Q ' + Math.round(value).toLocaleString('es-GT');
};

// ===== DATOS DUMMY =====
const PRODUCTOS_DUMMY = [
  { id: 1, nombre: 'Bolsa PE 30x40', sku: 'BPE-3040', precio_actual: 2.50, costo_actual: 1.80, margen_pct_actual: 28.0, margen_pct_historico: 35.0, delta_puntos: -7.0, quetzales_perdidos: 12500, semaforo: 'rojo', unidades_12m: 45000, precio_sugerido: 2.77 },
  { id: 2, nombre: 'Bolsa PE 40x50', sku: 'BPE-4050', precio_actual: 3.20, costo_actual: 2.10, margen_pct_actual: 34.4, margen_pct_historico: 38.0, delta_puntos: -3.6, quetzales_perdidos: 5800, semaforo: 'ambar', unidades_12m: 32000, precio_sugerido: 3.39 },
  { id: 3, nombre: 'Rollo Stretch 50cm', sku: 'RST-50', precio_actual: 85.00, costo_actual: 52.00, margen_pct_actual: 38.8, margen_pct_historico: 42.0, delta_puntos: -3.2, quetzales_perdidos: 4200, semaforo: 'ambar', unidades_12m: 1200, precio_sugerido: 89.66 },
  { id: 4, nombre: 'Cinta Adhesiva 48mm', sku: 'CAD-48', precio_actual: 12.50, costo_actual: 7.80, margen_pct_actual: 37.6, margen_pct_historico: 37.6, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde', unidades_12m: 8500, precio_sugerido: 12.50 },
  { id: 5, nombre: 'Pelicula Termoencogible 20mic', sku: 'PTE-20', precio_actual: 45.00, costo_actual: 28.50, margen_pct_actual: 36.7, margen_pct_historico: 40.0, delta_puntos: -3.3, quetzales_perdidos: 3100, semaforo: 'ambar', unidades_12m: 2100, precio_sugerido: 47.50 },
  { id: 6, nombre: 'Bolsa Biodegradable 35x45', sku: 'BBD-3545', precio_actual: 4.50, costo_actual: 3.20, margen_pct_actual: 28.9, margen_pct_historico: 32.0, delta_puntos: -3.1, quetzales_perdidos: 2800, semaforo: 'ambar', unidades_12m: 18000, precio_sugerido: 4.71 },
  { id: 7, nombre: 'Caja Carton 30x20x15', sku: 'CC-302015', precio_actual: 8.00, costo_actual: 4.80, margen_pct_actual: 40.0, margen_pct_historico: 40.0, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde', unidades_12m: 12000, precio_sugerido: 8.00 },
  { id: 8, nombre: 'Etiqueta Adhesiva 10x5', sku: 'EA-105', precio_actual: 0.85, costo_actual: 0.55, margen_pct_actual: 35.3, margen_pct_historico: 35.3, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde', unidades_12m: 50000, precio_sugerido: 0.85 },
  { id: 9, nombre: 'Sachet Laminado 15x20', sku: 'SL-1520', precio_actual: 1.20, costo_actual: 0.90, margen_pct_actual: 25.0, margen_pct_historico: 33.0, delta_puntos: -8.0, quetzales_perdidos: 18200, semaforo: 'rojo', unidades_12m: 38000, precio_sugerido: 1.34 },
  { id: 10, nombre: 'Rollo Polipropileno 60cm', sku: 'RPP-60', precio_actual: 65.00, costo_actual: 40.00, margen_pct_actual: 38.5, margen_pct_historico: 41.0, delta_puntos: -2.5, quetzales_perdidos: 1500, semaforo: 'ambar', unidades_12m: 800, precio_sugerido: 67.80 },
  { id: 11, nombre: 'Bolsa ZIP 10x15', sku: 'BZIP-1015', precio_actual: 1.80, costo_actual: 1.10, margen_pct_actual: 38.9, margen_pct_historico: 38.9, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde', unidades_12m: 25000, precio_sugerido: 1.80 },
  { id: 12, nombre: 'Film Stretch Manual 45cm', sku: 'FSM-45', precio_actual: 95.00, costo_actual: 62.00, margen_pct_actual: 34.7, margen_pct_historico: 38.0, delta_puntos: -3.3, quetzales_perdidos: 2800, semaforo: 'ambar', unidades_12m: 900, precio_sugerido: 100.00 },
];

const VENDEDORES_DUMMY = [
  { id: 1, nombre: 'Carlos Mendez', ventas_12m: 485000, margen_pct_actual: 32.5, margen_pct_historico: 36.0, delta_puntos: -3.5, quetzales_perdidos: 17000, semaforo: 'ambar' },
  { id: 2, nombre: 'Ana Rodriguez', ventas_12m: 620000, margen_pct_actual: 38.2, margen_pct_historico: 38.2, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde' },
  { id: 3, nombre: 'Luis Castillo', ventas_12m: 320000, margen_pct_actual: 28.0, margen_pct_historico: 35.0, delta_puntos: -7.0, quetzales_perdidos: 22400, semaforo: 'rojo' },
  { id: 4, nombre: 'Maria Lopez', ventas_12m: 510000, margen_pct_actual: 34.5, margen_pct_historico: 37.0, delta_puntos: -2.5, quetzales_perdidos: 12750, semaforo: 'ambar' },
  { id: 5, nombre: 'Pedro Sanchez', ventas_12m: 275000, margen_pct_actual: 30.0, margen_pct_historico: 33.0, delta_puntos: -3.0, quetzales_perdidos: 8250, semaforo: 'ambar' },
];

const CLIENTES_DUMMY = [
  { id: 1, nombre: 'Industrias del Valle', ventas_12m: 850000, margen_pct_actual: 29.0, margen_pct_historico: 35.0, delta_puntos: -6.0, quetzales_perdidos: 51000, semaforo: 'rojo' },
  { id: 2, nombre: 'Supermercados La Bodega', ventas_12m: 420000, margen_pct_actual: 33.0, margen_pct_historico: 35.0, delta_puntos: -2.0, quetzales_perdidos: 8400, semaforo: 'ambar' },
  { id: 3, nombre: 'Farmacias del Sur', ventas_12m: 280000, margen_pct_actual: 38.0, margen_pct_historico: 38.0, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde' },
  { id: 4, nombre: 'Distribuidora Central', ventas_12m: 680000, margen_pct_actual: 31.0, margen_pct_historico: 34.0, delta_puntos: -3.0, quetzales_perdidos: 20400, semaforo: 'ambar' },
  { id: 5, nombre: 'Textiles del Norte', ventas_12m: 195000, margen_pct_actual: 36.0, margen_pct_historico: 36.0, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde' },
  { id: 6, nombre: 'Empaques del Pacifico', ventas_12m: 320000, margen_pct_actual: 27.0, margen_pct_historico: 33.0, delta_puntos: -6.0, quetzales_perdidos: 19200, semaforo: 'rojo' },
];

const LINEAS_DUMMY = [
  { id: 1, nombre: 'Bolsas Plásticas', unidades_12m: 125000, ventas_12m: 385000, margen_pct_actual: 31.0, margen_pct_historico: 36.0, delta_puntos: -5.0, quetzales_perdidos: 19250, semaforo: 'rojo' },
  { id: 2, nombre: 'Rollos Stretch', unidades_12m: 3200, ventas_12m: 268000, margen_pct_actual: 36.5, margen_pct_historico: 39.0, delta_puntos: -2.5, quetzales_perdidos: 6700, semaforo: 'ambar' },
  { id: 3, nombre: 'Cajas de Cartón', unidades_12m: 18000, ventas_12m: 144000, margen_pct_actual: 38.0, margen_pct_historico: 38.0, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde' },
  { id: 4, nombre: 'Etiquetas', unidades_12m: 68000, ventas_12m: 57800, margen_pct_actual: 35.0, margen_pct_historico: 35.0, delta_puntos: 0, quetzales_perdidos: 0, semaforo: 'verde' },
  { id: 5, nombre: 'Películas Termoencogibles', unidades_12m: 4200, ventas_12m: 189000, margen_pct_actual: 33.0, margen_pct_historico: 37.0, delta_puntos: -4.0, quetzales_perdidos: 7560, semaforo: 'rojo' },
  { id: 6, nombre: 'Bolsas Biodegradables', unidades_12m: 28000, ventas_12m: 126000, margen_pct_actual: 29.0, margen_pct_historico: 32.0, delta_puntos: -3.0, quetzales_perdidos: 3780, semaforo: 'ambar' },
];

const HISTORIAL_DUMMY = {
  1: [
    { fecha: '2025-01-01', precio_promedio_realizado: 2.30, costo_unitario: 1.50, margen_pct: 34.8 },
    { fecha: '2025-02-01', precio_promedio_realizado: 2.35, costo_unitario: 1.55, margen_pct: 34.0 },
    { fecha: '2025-03-01', precio_promedio_realizado: 2.40, costo_unitario: 1.60, margen_pct: 33.3 },
    { fecha: '2025-04-01', precio_promedio_realizado: 2.45, costo_unitario: 1.65, margen_pct: 32.7 },
    { fecha: '2025-05-01', precio_promedio_realizado: 2.50, costo_unitario: 1.70, margen_pct: 32.0 },
    { fecha: '2025-06-01', precio_promedio_realizado: 2.50, costo_unitario: 1.75, margen_pct: 30.0 },
    { fecha: '2025-07-01', precio_promedio_realizado: 2.50, costo_unitario: 1.78, margen_pct: 28.8 },
    { fecha: '2025-08-01', precio_promedio_realizado: 2.50, costo_unitario: 1.80, margen_pct: 28.0 },
  ],
  9: [
    { fecha: '2025-01-01', precio_promedio_realizado: 1.10, costo_unitario: 0.74, margen_pct: 32.7 },
    { fecha: '2025-02-01', precio_promedio_realizado: 1.15, costo_unitario: 0.78, margen_pct: 32.2 },
    { fecha: '2025-03-01', precio_promedio_realizado: 1.18, costo_unitario: 0.80, margen_pct: 32.2 },
    { fecha: '2025-04-01', precio_promedio_realizado: 1.20, costo_unitario: 0.85, margen_pct: 29.2 },
    { fecha: '2025-05-01', precio_promedio_realizado: 1.20, costo_unitario: 0.88, margen_pct: 26.7 },
    { fecha: '2025-06-01', precio_promedio_realizado: 1.20, costo_unitario: 0.89, margen_pct: 25.8 },
    { fecha: '2025-07-01', precio_promedio_realizado: 1.20, costo_unitario: 0.90, margen_pct: 25.0 },
    { fecha: '2025-08-01', precio_promedio_realizado: 1.20, costo_unitario: 0.90, margen_pct: 25.0 },
  ],
};

// ===== ENDPOINTS =====

// GET /api/margenes - Resumen general
router.get('/', (req, res) => {
  const totalVentas = PRODUCTOS_DUMMY.reduce((sum, p) => sum + (p.precio_actual * p.unidades_12m), 0);
  const totalCosto = PRODUCTOS_DUMMY.reduce((sum, p) => sum + (p.costo_actual * p.unidades_12m), 0);
  const totalMargenBruto = totalVentas - totalCosto;
  const margenGlobalPct = totalVentas > 0 ? (totalMargenBruto / totalVentas) * 100 : 0;
  const totalMargenPerdido = PRODUCTOS_DUMMY.reduce((sum, p) => sum + (p.quetzales_perdidos || 0), 0);

  const resumen = {
    total_margen_bruto_q: totalMargenBruto,
    margen_global_pct: margenGlobalPct,
    total_margen_perdido_12m: totalMargenPerdido,
    total_ventas_q: totalVentas,
    productos_rojo: PRODUCTOS_DUMMY.filter(p => p.semaforo === 'rojo').length,
    productos_ambar: PRODUCTOS_DUMMY.filter(p => p.semaforo === 'ambar').length,
    productos_verde: PRODUCTOS_DUMMY.filter(p => p.semaforo === 'verde').length,
    total_productos: PRODUCTOS_DUMMY.length,
  };

  res.json({ status: 'success', data: { resumen, productos: PRODUCTOS_DUMMY } });
});

// GET /api/margenes/producto/:id/detalle
router.get('/producto/:id/detalle', (req, res) => {
  const id = parseInt(req.params.id);
  const producto = PRODUCTOS_DUMMY.find(p => p.id === id);
  if (!producto) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' });
  }

  const historial = HISTORIAL_DUMMY[id] || [
    { fecha: '2025-01-01', precio_promedio_realizado: producto.precio_actual * 0.95, costo_unitario: producto.costo_actual * 0.85, margen_pct: producto.margen_pct_historico },
    { fecha: '2025-04-01', precio_promedio_realizado: producto.precio_actual * 0.98, costo_unitario: producto.costo_actual * 0.92, margen_pct: producto.margen_pct_historico - 1 },
    { fecha: '2025-08-01', precio_promedio_realizado: producto.precio_actual, costo_unitario: producto.costo_actual, margen_pct: producto.margen_pct_actual },
  ];

  res.json({
    status: 'success',
    data: {
      producto,
      historial,
    }
  });
});

// GET /api/margenes/vendedores
router.get('/vendedores', (req, res) => {
  res.json({ status: 'success', data: VENDEDORES_DUMMY });
});

// GET /api/margenes/clientes
router.get('/clientes', (req, res) => {
  res.json({ status: 'success', data: CLIENTES_DUMMY });
});

// GET /api/margenes/lineas
router.get('/lineas', (req, res) => {
  res.json({ status: 'success', data: LINEAS_DUMMY });
});

module.exports = router;
