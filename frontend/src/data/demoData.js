// Datos de DEMO / Fallback para desarrollo
// Centralizados aquí para evitar hardcodear en componentes

export const demoClientesConcentracion = [
  { id: 1, nombre: 'Constructora Metropolitana', ingresos: 8500000 },
  { id: 2, nombre: 'Grupo Industrial Centroamericano', ingresos: 6200000 },
  { id: 3, nombre: 'Inversiones del Norte', ingresos: 4100000 },
  { id: 4, nombre: 'Distribuidora del Sur', ingresos: 2800000 },
  { id: 5, nombre: 'Comercializadora Maya', ingresos: 1900000 },
  { id: 6, nombre: 'Importadora del Pacífico', ingresos: 1500000 },
  { id: 7, nombre: 'Suministros Industriales', ingresos: 1200000 },
  { id: 8, nombre: 'Ferretería La Unión', ingresos: 800000 },
  { id: 9, nombre: 'Materiales de Construcción XYZ', ingresos: 650000 },
  { id: 10, nombre: 'Otros clientes', ingresos: 1200000 }
];

export const demoLibroDiario = [
  { asiento_id: 1, fecha: '2026-03-01', cuenta_codigo: '1101', cuenta_nombre: 'Caja', descripcion: 'Fondo inicial de caja', debe: 5000, haber: 0, documento: 'FI-001' },
  { asiento_id: 2, fecha: '2026-03-05', cuenta_codigo: '1103', cuenta_nombre: 'Banco Industrial', descripcion: 'Depósito de ventas', debe: 125000, haber: 0, documento: 'DEP-102' },
  { asiento_id: 3, fecha: '2026-03-05', cuenta_codigo: '4101', cuenta_nombre: 'Ventas', descripcion: 'Ventas del día', debe: 0, haber: 125000, documento: 'VTA-001' },
  { asiento_id: 4, fecha: '2026-03-10', cuenta_codigo: '1201', cuenta_nombre: 'Inventarios', descripcion: 'Compra de mercadería', debe: 45000, haber: 0, documento: 'COM-203' },
  { asiento_id: 4, fecha: '2026-03-10', cuenta_codigo: '2101', cuenta_nombre: 'Proveedores', descripcion: 'Compra a crédito', debe: 0, haber: 45000, documento: 'COM-203' },
  { asiento_id: 5, fecha: '2026-03-15', cuenta_codigo: '1104', cuenta_nombre: 'Cuentas por Cobrar', descripcion: 'Venta a crédito - Cliente XYZ', debe: 100000, haber: 0, documento: 'F001-0023' },
  { asiento_id: 5, fecha: '2026-03-15', cuenta_codigo: '4101', cuenta_nombre: 'Ventas', descripcion: 'Venta a crédito', debe: 0, haber: 100000, documento: 'F001-0023' },
  { asiento_id: 6, fecha: '2026-03-18', cuenta_codigo: '1103', cuenta_nombre: 'Banco Industrial', descripcion: 'Pago a Proveedor Alfa', debe: 0, haber: 30000, documento: 'CH-045' },
  { asiento_id: 6, fecha: '2026-03-18', cuenta_codigo: '2101', cuenta_nombre: 'Proveedores', descripcion: 'Pago a Proveedor Alfa', debe: 30000, haber: 0, documento: 'CH-045' },
  { asiento_id: 7, fecha: '2026-03-20', cuenta_codigo: '5103', cuenta_nombre: 'Alquiler', descripcion: 'Pago alquiler local comercial', debe: 15000, haber: 0, documento: 'REC-0320' },
  { asiento_id: 7, fecha: '2026-03-20', cuenta_codigo: '1103', cuenta_nombre: 'Banco Industrial', descripcion: 'Pago alquiler local comercial', debe: 0, haber: 15000, documento: 'REC-0320' },
  { asiento_id: 8, fecha: '2026-03-22', cuenta_codigo: '1103', cuenta_nombre: 'Banco Industrial', descripcion: 'Cobro a Cliente XYZ', debe: 50000, haber: 0, documento: 'DEP-215' },
  { asiento_id: 8, fecha: '2026-03-22', cuenta_codigo: '1104', cuenta_nombre: 'Cuentas por Cobrar', descripcion: 'Cobro parcial Cliente XYZ', debe: 0, haber: 50000, documento: 'DEP-215' },
  { asiento_id: 9, fecha: '2026-03-25', cuenta_codigo: '5102', cuenta_nombre: 'Servicios', descripcion: 'Electricidad y agua marzo', debe: 3584, haber: 0, documento: 'EEGSA-445' },
  { asiento_id: 9, fecha: '2026-03-25', cuenta_codigo: '1103', cuenta_nombre: 'Banco Industrial', descripcion: 'Electricidad y agua marzo', debe: 0, haber: 3584, documento: 'EEGSA-445' }
];

export const demoBancosConciliacion = [
  { banco: 'Banco Industrial', cuenta: 'Cuenta Corriente', diferencia: 0, dias: 1 },
  { banco: 'Banco G&T', cuenta: 'Cuenta de Ahorros', diferencia: 0, dias: 2 },
  { banco: 'BAC', cuenta: 'Cuenta Corriente USD', diferencia: 1250, dias: 5 },
];

export const demoCierreMensual = {
  mesActual: { mes: 'Marzo', ventas: 2850000, gastos: 2100000, utilidad: 750000 },
  mesAnterior: { mes: 'Febrero', ventas: 2650000, gastos: 2050000, utilidad: 600000 }
};

export const demoMesesCierre = [
  { id: 1, mes: 'Abril', año: 2025, estado: 'abierto', fechaCierre: null, progreso: 0 },
  { id: 2, mes: 'Marzo', año: 2025, estado: 'cerrado', fechaCierre: '2025-04-05', progreso: 100 },
  { id: 3, mes: 'Febrero', año: 2025, estado: 'cerrado', fechaCierre: '2025-03-03', progreso: 100 },
  { id: 4, mes: 'Enero', año: 2025, estado: 'cerrado', fechaCierre: '2025-02-04', progreso: 100 },
  { id: 5, mes: 'Diciembre', año: 2024, estado: 'cerrado', fechaCierre: '2025-01-03', progreso: 100 },
  { id: 6, mes: 'Noviembre', año: 2024, estado: 'cerrado', fechaCierre: '2024-12-02', progreso: 100 },
  { id: 7, mes: 'Octubre', año: 2024, estado: 'cerrado', fechaCierre: '2024-11-04', progreso: 100 },
  { id: 8, mes: 'Septiembre', año: 2024, estado: 'cerrado', fechaCierre: '2024-10-03', progreso: 100 },
  { id: 9, mes: 'Agosto', año: 2024, estado: 'cerrado', fechaCierre: '2024-09-02', progreso: 100 },
  { id: 10, mes: 'Julio', año: 2024, estado: 'cerrado', fechaCierre: '2024-08-02', progreso: 100 },
  { id: 11, mes: 'Junio', año: 2024, estado: 'cerrado', fechaCierre: '2024-07-03', progreso: 100 },
  { id: 12, mes: 'Mayo', año: 2024, estado: 'cerrado', fechaCierre: '2024-06-03', progreso: 100 },
];

export const demoAlertasCierre = [
  { id: 1, tipo: 'warning', mensaje: 'Ajuste de inventario requerido - Diferencia Q12,450', fecha: '2025-04-08' },
  { id: 2, tipo: 'error', mensaje: 'Conciliación bancaria pendiente - Marzo', fecha: '2025-04-05' },
  { id: 3, tipo: 'info', mensaje: 'Nuevos asientos requieren aprobación', count: 12 },
];

// ============================================
// DATOS DE COMPRAS INTELIGENTES — THERMOPLASTICA
// ============================================

// Líneas de producto con historial de ventas (6 meses)
export const demoLineasProducto = [
  {
    id: 'RESI-001',
    nombre: 'Resinas',
    descripcion: 'Gránulos de PET, PE, PP, PS para inyección y soplado',
    stockActual: 12500,
    stockMinimo: 8000,
    costoUnitarioPromedio: 18.50,
    historialVentas: [9800, 10200, 9500, 11200, 12100, 12800],
    tendencia: 'up',
    margen: 35,
    proveedorPrincipal: 'Dow Chemical Centroamérica',
    tiempoEntregaDias: 14,
  },
  {
    id: 'ADIT-001',
    nombre: 'Aditivos',
    descripcion: 'Colorantes masterbatch, estabilizantes UV, plastificantes',
    stockActual: 3200,
    stockMinimo: 2000,
    costoUnitarioPromedio: 45.00,
    historialVentas: [2100, 2300, 2200, 2600, 2800, 3100],
    tendencia: 'up',
    margen: 42,
    proveedorPrincipal: 'Clariant Guatemala',
    tiempoEntregaDias: 10,
  },
  {
    id: 'MOLD-001',
    nombre: 'Moldes',
    descripcion: 'Moldes de inyección, soplado, termoformado',
    stockActual: 85,
    stockMinimo: 60,
    costoUnitarioPromedio: 8500,
    historialVentas: [8, 10, 7, 12, 11, 14],
    tendencia: 'up',
    margen: 28,
    proveedorPrincipal: 'MoldTech Industries',
    tiempoEntregaDias: 45,
  },
  {
    id: 'EMPA-001',
    nombre: 'Empaque',
    descripcion: 'Cajas cartón, película stretch, fleje, etiquetas',
    stockActual: 18500,
    stockMinimo: 10000,
    costoUnitarioPromedio: 2.80,
    historialVentas: [12000, 13500, 12800, 15200, 16800, 17500],
    tendencia: 'up',
    margen: 22,
    proveedorPrincipal: 'Smurfit Kappa CA',
    tiempoEntregaDias: 5,
  },
  {
    id: 'PROD-001',
    nombre: 'Producto Terminado',
    descripcion: 'Botellas, contenedores, tapas, piezas técnicas',
    stockActual: 45000,
    stockMinimo: 30000,
    costoUnitarioPromedio: 12.50,
    historialVentas: [32000, 35000, 31000, 38000, 42000, 45000],
    tendencia: 'up',
    margen: 38,
    proveedorPrincipal: 'Thermoplastica GT',
    tiempoEntregaDias: 2,
  },
  {
    id: 'REPU-001',
    nombre: 'Repuestos',
    descripcion: 'Partes maquinaria, tornillos, resistencias, sensores',
    stockActual: 1200,
    stockMinimo: 800,
    costoUnitarioPromedio: 180,
    historialVentas: [450, 520, 480, 580, 620, 700],
    tendencia: 'up',
    margen: 30,
    proveedorPrincipal: 'Husky Parts CA',
    tiempoEntregaDias: 21,
  },
];

// Productos individuales con estado de stock detallado
export const demoProductosStock = [
  // Resinas
  { id: 1, nombre: 'PET Grado Alimenticio (saco 25kg)', linea: 'Resinas', stock: 4200, stockMin: 2500, stockMax: 6000, costoUnitario: 22.50, ventaPromedioMensual: 1850, tendencia: 'up', proveedor: 'Dow Chemical CA', diasEntrega: 14 },
  { id: 2, nombre: 'PEAD Grado Inyección (saco 25kg)', linea: 'Resinas', stock: 3100, stockMin: 2000, stockMax: 5000, costoUnitario: 19.80, ventaPromedioMensual: 1620, tendencia: 'up', proveedor: 'Dow Chemical CA', diasEntrega: 14 },
  { id: 3, nombre: 'PP Grado Homopolímero (saco 25kg)', linea: 'Resinas', stock: 2800, stockMin: 1800, stockMax: 4500, costoUnitario: 17.20, ventaPromedioMensual: 1450, tendencia: 'stable', proveedor: 'Braskem Guatemala', diasEntrega: 21 },
  { id: 4, nombre: 'PS Cristal Grado General (saco 25kg)', linea: 'Resinas', stock: 950, stockMin: 800, stockMax: 2000, costoUnitario: 15.60, ventaPromedioMensual: 780, tendencia: 'down', proveedor: 'Braskem Guatemala', diasEntrega: 21 },
  { id: 5, nombre: 'PVC Suspensión K-65 (saco 25kg)', linea: 'Resinas', stock: 1550, stockMin: 1200, stockMax: 3000, costoUnitario: 14.80, ventaPromedioMensual: 920, tendencia: 'up', proveedor: 'Mexichem Guatemala', diasEntrega: 18 },
  { id: 6, nombre: 'PET Reciclado RPET (saco 25kg)', linea: 'Resinas', stock: 2200, stockMin: 1500, stockMax: 4000, costoUnitario: 12.50, ventaPromedioMensual: 1100, tendencia: 'up', proveedor: 'Repsol CA', diasEntrega: 12 },
  { id: 7, nombre: 'EVA Grado Flexible (saco 25kg)', linea: 'Resinas', stock: 850, stockMin: 600, stockMax: 1500, costoUnitario: 24.30, ventaPromedioMensual: 480, tendencia: 'stable', proveedor: 'Dow Chemical CA', diasEntrega: 14 },
  { id: 8, nombre: 'ABS Grado Alto Impacto (saco 25kg)', linea: 'Resinas', stock: 420, stockMin: 300, stockMax: 800, costoUnitario: 28.90, ventaPromedioMensual: 220, tendencia: 'up', proveedor: 'LG Chem CA', diasEntrega: 30 },
  // Aditivos
  { id: 9, nombre: 'Masterbatch Blanco 70% TiO2 (kg)', linea: 'Aditivos', stock: 480, stockMin: 300, stockMax: 800, costoUnitario: 65.00, ventaPromedioMensual: 260, tendencia: 'up', proveedor: 'Clariant Guatemala', diasEntrega: 10 },
  { id: 10, nombre: 'Masterbatch Negro Carbon (kg)', linea: 'Aditivos', stock: 320, stockMin: 200, stockMax: 500, costoUnitario: 58.50, ventaPromedioMensual: 165, tendencia: 'stable', proveedor: 'Clariant Guatemala', diasEntrega: 10 },
  { id: 11, nombre: 'Estabilizante UV (kg)', linea: 'Aditivos', stock: 180, stockMin: 150, stockMax: 400, costoUnitario: 85.00, ventaPromedioMensual: 95, tendencia: 'stable', proveedor: 'BASF Guatemala', diasEntrega: 15 },
  { id: 12, nombre: 'Plastificante DOP (kg)', linea: 'Aditivos', stock: 290, stockMin: 200, stockMax: 500, costoUnitario: 42.00, ventaPromedioMensual: 145, tendencia: 'up', proveedor: 'BASF Guatemala', diasEntrega: 15 },
  { id: 13, nombre: 'Antioxidante Primario (kg)', linea: 'Aditivos', stock: 150, stockMin: 100, stockMax: 300, costoUnitario: 95.00, ventaPromedioMensual: 85, tendencia: 'stable', proveedor: 'Clariant Guatemala', diasEntrega: 10 },
  { id: 14, nombre: 'Desmoldante Siliconado (litro)', linea: 'Aditivos', stock: 85, stockMin: 60, stockMax: 200, costoUnitario: 35.00, ventaPromedioMensual: 45, tendencia: 'up', proveedor: 'Dow Chemical CA', diasEntrega: 14 },
  { id: 15, nombre: 'Cargas Minerales Talco (kg)', linea: 'Aditivos', stock: 520, stockMin: 300, stockMax: 1000, costoUnitario: 8.50, ventaPromedioMensual: 280, tendencia: 'stable', proveedor: 'Materias Primas GT', diasEntrega: 7 },
  { id: 16, nombre: 'Agente Soplaante Químico (kg)', linea: 'Aditivos', stock: 45, stockMin: 30, stockMax: 100, costoUnitario: 120.00, ventaPromedioMensual: 22, tendencia: 'up', proveedor: 'Clariant Guatemala', diasEntrega: 10 },
  // Moldes
  { id: 17, nombre: 'Molde Botella 500ml (cavidades)', linea: 'Moldes', stock: 12, stockMin: 8, stockMax: 20, costoUnitario: 8500, ventaPromedioMensual: 3, tendencia: 'stable', proveedor: 'MoldTech Industries', diasEntrega: 45 },
  { id: 18, nombre: 'Molde Tapa Rosca 28mm (cavidades)', linea: 'Moldes', stock: 8, stockMin: 6, stockMax: 15, costoUnitario: 6200, ventaPromedioMensual: 2, tendencia: 'up', proveedor: 'MoldTech Industries', diasEntrega: 45 },
  { id: 19, nombre: 'Molde Contenedor 20L (cavidades)', linea: 'Moldes', stock: 5, stockMin: 3, stockMax: 10, costoUnitario: 12500, ventaPromedioMensual: 1, tendencia: 'stable', proveedor: 'StackTeck CA', diasEntrega: 60 },
  { id: 20, nombre: 'Molde Inyección Técnica (cavidades)', linea: 'Moldes', stock: 15, stockMin: 10, stockMax: 25, costoUnitario: 9800, ventaPromedioMensual: 4, tendencia: 'up', proveedor: 'Husky Injection', diasEntrega: 55 },
  { id: 21, nombre: 'Insertos Molde Repuesto (juego)', linea: 'Moldes', stock: 28, stockMin: 15, stockMax: 40, costoUnitario: 1850, ventaPromedioMensual: 6, tendencia: 'stable', proveedor: 'MoldTech Industries', diasEntrega: 30 },
  { id: 22, nombre: 'Sistema Hot Runner (unidad)', linea: 'Moldes', stock: 3, stockMin: 2, stockMax: 6, costoUnitario: 18500, ventaPromedioMensual: 1, tendencia: 'up', proveedor: 'Husky Injection', diasEntrega: 60 },
  { id: 23, nombre: 'Molde Preforma PET 25g (cavidades)', linea: 'Moldes', stock: 6, stockMin: 4, stockMax: 12, costoUnitario: 7200, ventaPromedioMensual: 2, tendencia: 'up', proveedor: 'SIPA Containers', diasEntrega: 50 },
  { id: 24, nombre: 'Molde Etiqueta IML (cavidades)', linea: 'Moldes', stock: 4, stockMin: 3, stockMax: 8, costoUnitario: 11500, ventaPromedioMensual: 1, tendencia: 'stable', proveedor: 'MCC Etiquetas', diasEntrega: 40 },
  // Empaque
  { id: 25, nombre: 'Caja Cartón Corrugado 40x30x25 (und)', linea: 'Empaque', stock: 8500, stockMin: 5000, stockMax: 12000, costoUnitario: 8.50, ventaPromedioMensual: 4200, tendencia: 'up', proveedor: 'Smurfit Kappa CA', diasEntrega: 5 },
  { id: 26, nombre: 'Película Stretch Manual (rollo)', linea: 'Empaque', stock: 320, stockMin: 200, stockMax: 600, costoUnitario: 185, ventaPromedioMensual: 150, tendencia: 'up', proveedor: 'Smurfit Kappa CA', diasEntrega: 5 },
  { id: 27, nombre: 'Fleje Plástico PP 12mm (rollo)', linea: 'Empaque', stock: 95, stockMin: 60, stockMax: 200, costoUnitario: 125, ventaPromedioMensual: 45, tendencia: 'stable', proveedor: 'Signode CA', diasEntrega: 7 },
  { id: 28, nombre: 'Etiqueta Adhesiva en Rollo (rollo)', linea: 'Empaque', stock: 420, stockMin: 250, stockMax: 700, costoUnitario: 65, ventaPromedioMensual: 220, tendencia: 'up', proveedor: 'MCC Etiquetas', diasEntrega: 8 },
  { id: 29, nombre: 'Bolsa Polietileno 20x30 (millar)', linea: 'Empaque', stock: 280, stockMin: 150, stockMax: 500, costoUnitario: 85, ventaPromedioMensual: 135, tendencia: 'stable', proveedor: 'Plastifar CA', diasEntrega: 5 },
  { id: 30, nombre: 'Pallet Plástico 1200x1000 (und)', linea: 'Empaque', stock: 180, stockMin: 100, stockMax: 300, costoUnitario: 145, ventaPromedioMensual: 55, tendencia: 'up', proveedor: 'Cabka CA', diasEntrega: 10 },
  { id: 31, nombre: 'Cinta Adhesiva Transparente (caja)', linea: 'Empaque', stock: 450, stockMin: 250, stockMax: 700, costoUnitario: 35, ventaPromedioMensual: 220, tendencia: 'stable', proveedor: '3M Guatemala', diasEntrega: 5 },
  { id: 32, nombre: 'Separadores Cartón Ondulado (millar)', linea: 'Empaque', stock: 1200, stockMin: 800, stockMax: 2000, costoUnitario: 18, ventaPromedioMensual: 650, tendencia: 'up', proveedor: 'Smurfit Kappa CA', diasEntrega: 5 },
  // Producto Terminado
  { id: 33, nombre: 'Botella PET 500ml Cuello 28mm (millar)', linea: 'Producto Terminado', stock: 12500, stockMin: 8000, stockMax: 20000, costoUnitario: 0.85, ventaPromedioMensual: 6500, tendencia: 'up', proveedor: 'Thermoplastica GT', diasEntrega: 2 },
  { id: 34, nombre: 'Botella PET 1L Cuello 28mm (millar)', linea: 'Producto Terminado', stock: 8200, stockMin: 5000, stockMax: 12000, costoUnitario: 1.20, ventaPromedioMensual: 4200, tendencia: 'up', proveedor: 'Thermoplastica GT', diasEntrega: 2 },
  { id: 35, nombre: 'Tapa Rosca 28mm Seguridad (millar)', linea: 'Producto Terminado', stock: 18500, stockMin: 12000, stockMax: 25000, costoUnitario: 0.35, ventaPromedioMensual: 9200, tendencia: 'up', proveedor: 'Thermoplastica GT', diasEntrega: 2 },
  { id: 36, nombre: 'Contenedor PEAD 20L con Tapa (und)', linea: 'Producto Terminado', stock: 3200, stockMin: 2000, stockMax: 5000, costoUnitario: 18.50, ventaPromedioMensual: 1450, tendencia: 'stable', proveedor: 'Thermoplastica GT', diasEntrega: 3 },
  { id: 37, nombre: 'Cubeta Plástica 5L (und)', linea: 'Producto Terminado', stock: 5800, stockMin: 3500, stockMax: 8000, costoUnitario: 8.90, ventaPromedioMensual: 2800, tendencia: 'up', proveedor: 'Thermoplastica GT', diasEntrega: 2 },
  { id: 38, nombre: 'Tubo PVC 1/2" Rígido (metro)', linea: 'Producto Terminado', stock: 12500, stockMin: 8000, stockMax: 18000, costoUnitario: 2.50, ventaPromedioMensual: 6200, tendencia: 'stable', proveedor: 'Thermoplastica GT', diasEntrega: 2 },
  { id: 39, nombre: 'Pieza Técnica Inyección PP (und)', linea: 'Producto Terminado', stock: 8500, stockMin: 5000, stockMax: 12000, costoUnitario: 4.20, ventaPromedioMensual: 3800, tendencia: 'up', proveedor: 'Thermoplastica GT', diasEntrega: 2 },
  { id: 40, nombre: 'Vaso Descartable 8oz PS (millar)', linea: 'Producto Terminado', stock: 22000, stockMin: 15000, stockMax: 30000, costoUnitario: 0.45, ventaPromedioMensual: 12000, tendencia: 'up', proveedor: 'Thermoplastica GT', diasEntrega: 2 },
  // Repuestos
  { id: 41, nombre: 'Resistencia Calefactora 220V (und)', linea: 'Repuestos', stock: 85, stockMin: 50, stockMax: 150, costoUnitario: 185, ventaPromedioMensual: 35, tendencia: 'stable', proveedor: 'Husky Parts CA', diasEntrega: 21 },
  { id: 42, nombre: 'Válvula Neumática 5/2 (und)', linea: 'Repuestos', stock: 42, stockMin: 25, stockMax: 80, costoUnitario: 125, ventaPromedioMensual: 18, tendencia: 'up', proveedor: 'Festo CA', diasEntrega: 14 },
  { id: 43, nombre: 'Tornillo Socket M8x25 Inox (millar)', linea: 'Repuestos', stock: 25, stockMin: 15, stockMax: 40, costoUnitario: 850, ventaPromedioMensual: 8, tendencia: 'stable', proveedor: 'Tornimundo CA', diasEntrega: 7 },
  { id: 44, nombre: 'Sensor Temperatura PT100 (und)', linea: 'Repuestos', stock: 35, stockMin: 20, stockMax: 60, costoUnitario: 145, ventaPromedioMensual: 12, tendencia: 'up', proveedor: 'Wika CA', diasEntrega: 18 },
  { id: 45, nombre: 'Filtro Hidráulico 10 Micras (und)', linea: 'Repuestos', stock: 28, stockMin: 15, stockMax: 40, costoUnitario: 95, ventaPromedioMensual: 10, tendencia: 'stable', proveedor: 'Parker Hannifin CA', diasEntrega: 21 },
  { id: 46, nombre: 'Junta Tórica Viton Kit (kit)', linea: 'Repuestos', stock: 65, stockMin: 30, stockMax: 100, costoUnitario: 65, ventaPromedioMensual: 22, tendencia: 'up', proveedor: 'Parker Hannifin CA', diasEntrega: 14 },
  { id: 47, nombre: 'Rodamiento SKF 6205 (und)', linea: 'Repuestos', stock: 45, stockMin: 25, stockMax: 70, costoUnitario: 85, ventaPromedioMensual: 15, tendencia: 'stable', proveedor: 'SKF Guatemala', diasEntrega: 10 },
  { id: 48, nombre: 'Manguera Hidráulica 3/8" (metro)', linea: 'Repuestos', stock: 120, stockMin: 80, stockMax: 200, costoUnitario: 28, ventaPromedioMensual: 55, tendencia: 'up', proveedor: 'Parker Hannifin CA', diasEntrega: 14 },
];

// ============================================
// HISTORIAL DE VENTAS POR PRODUCTO (6 meses)
// ============================================

// Generador consistente: usa ventaPromedioMensual como base
function generarHistorial(promedio, tendencia) {
  const factor = tendencia === 'up' ? [0.85, 0.88, 0.92, 1.0, 1.08, 1.18] :
                 tendencia === 'down' ? [1.15, 1.08, 1.0, 0.95, 0.88, 0.82] :
                 [0.92, 1.05, 0.95, 1.02, 1.08, 0.98]
  return factor.map(f => Math.max(1, Math.round(promedio * f)))
}

export const demoHistorialVentasProducto = [
  // Resinas
  { id: 1, nombre: 'PET Grado Alimenticio (saco 25kg)', linea: 'Resinas', precioVenta: 32, costoUnitario: 22.50, historial: generarHistorial(1850, 'up'), margen: 30, proveedor: 'Dow Chemical CA' },
  { id: 2, nombre: 'PEAD Grado Inyección (saco 25kg)', linea: 'Resinas', precioVenta: 28, costoUnitario: 19.80, historial: generarHistorial(1620, 'up'), margen: 29, proveedor: 'Dow Chemical CA' },
  { id: 3, nombre: 'PP Grado Homopolímero (saco 25kg)', linea: 'Resinas', precioVenta: 25, costoUnitario: 17.20, historial: generarHistorial(1450, 'stable'), margen: 31, proveedor: 'Braskem Guatemala' },
  { id: 4, nombre: 'PS Cristal Grado General (saco 25kg)', linea: 'Resinas', precioVenta: 22, costoUnitario: 15.60, historial: generarHistorial(780, 'down'), margen: 29, proveedor: 'Braskem Guatemala' },
  { id: 5, nombre: 'PVC Suspensión K-65 (saco 25kg)', linea: 'Resinas', precioVenta: 21, costoUnitario: 14.80, historial: generarHistorial(920, 'up'), margen: 30, proveedor: 'Mexichem Guatemala' },
  { id: 6, nombre: 'PET Reciclado RPET (saco 25kg)', linea: 'Resinas', precioVenta: 18, costoUnitario: 12.50, historial: generarHistorial(1100, 'up'), margen: 31, proveedor: 'Repsol CA' },
  { id: 7, nombre: 'EVA Grado Flexible (saco 25kg)', linea: 'Resinas', precioVenta: 35, costoUnitario: 24.30, historial: generarHistorial(480, 'stable'), margen: 31, proveedor: 'Dow Chemical CA' },
  { id: 8, nombre: 'ABS Grado Alto Impacto (saco 25kg)', linea: 'Resinas', precioVenta: 42, costoUnitario: 28.90, historial: generarHistorial(220, 'up'), margen: 31, proveedor: 'LG Chem CA' },
  // Aditivos
  { id: 9, nombre: 'Masterbatch Blanco 70% TiO2 (kg)', linea: 'Aditivos', precioVenta: 95, costoUnitario: 65.00, historial: generarHistorial(260, 'up'), margen: 32, proveedor: 'Clariant Guatemala' },
  { id: 10, nombre: 'Masterbatch Negro Carbon (kg)', linea: 'Aditivos', precioVenta: 88, costoUnitario: 58.50, historial: generarHistorial(165, 'stable'), margen: 34, proveedor: 'Clariant Guatemala' },
  { id: 11, nombre: 'Estabilizante UV (kg)', linea: 'Aditivos', precioVenta: 125, costoUnitario: 85.00, historial: generarHistorial(95, 'stable'), margen: 32, proveedor: 'BASF Guatemala' },
  { id: 12, nombre: 'Plastificante DOP (kg)', linea: 'Aditivos', precioVenta: 62, costoUnitario: 42.00, historial: generarHistorial(145, 'up'), margen: 32, proveedor: 'BASF Guatemala' },
  { id: 13, nombre: 'Antioxidante Primario (kg)', linea: 'Aditivos', precioVenta: 140, costoUnitario: 95.00, historial: generarHistorial(85, 'stable'), margen: 32, proveedor: 'Clariant Guatemala' },
  { id: 14, nombre: 'Desmoldante Siliconado (litro)', linea: 'Aditivos', precioVenta: 52, costoUnitario: 35.00, historial: generarHistorial(45, 'up'), margen: 33, proveedor: 'Dow Chemical CA' },
  { id: 15, nombre: 'Cargas Minerales Talco (kg)', linea: 'Aditivos', precioVenta: 12, costoUnitario: 8.50, historial: generarHistorial(280, 'stable'), margen: 29, proveedor: 'Materias Primas GT' },
  { id: 16, nombre: 'Agente Soplaante Químico (kg)', linea: 'Aditivos', precioVenta: 180, costoUnitario: 120.00, historial: generarHistorial(22, 'up'), margen: 33, proveedor: 'Clariant Guatemala' },
  // Moldes
  { id: 17, nombre: 'Molde Botella 500ml (cavidades)', linea: 'Moldes', precioVenta: 12000, costoUnitario: 8500, historial: generarHistorial(3, 'stable'), margen: 29, proveedor: 'MoldTech Industries' },
  { id: 18, nombre: 'Molde Tapa Rosca 28mm (cavidades)', linea: 'Moldes', precioVenta: 8800, costoUnitario: 6200, historial: generarHistorial(2, 'up'), margen: 30, proveedor: 'MoldTech Industries' },
  { id: 19, nombre: 'Molde Contenedor 20L (cavidades)', linea: 'Moldes', precioVenta: 18500, costoUnitario: 12500, historial: generarHistorial(1, 'stable'), margen: 32, proveedor: 'StackTeck CA' },
  { id: 20, nombre: 'Molde Inyección Técnica (cavidades)', linea: 'Moldes', precioVenta: 14500, costoUnitario: 9800, historial: generarHistorial(4, 'up'), margen: 32, proveedor: 'Husky Injection' },
  { id: 21, nombre: 'Insertos Molde Repuesto (juego)', linea: 'Moldes', precioVenta: 2800, costoUnitario: 1850, historial: generarHistorial(6, 'stable'), margen: 34, proveedor: 'MoldTech Industries' },
  { id: 22, nombre: 'Sistema Hot Runner (unidad)', linea: 'Moldes', precioVenta: 28000, costoUnitario: 18500, historial: generarHistorial(1, 'up'), margen: 34, proveedor: 'Husky Injection' },
  { id: 23, nombre: 'Molde Preforma PET 25g (cavidades)', linea: 'Moldes', precioVenta: 11000, costoUnitario: 7200, historial: generarHistorial(2, 'up'), margen: 35, proveedor: 'SIPA Containers' },
  { id: 24, nombre: 'Molde Etiqueta IML (cavidades)', linea: 'Moldes', precioVenta: 17500, costoUnitario: 11500, historial: generarHistorial(1, 'stable'), margen: 34, proveedor: 'MCC Etiquetas' },
  // Empaque
  { id: 25, nombre: 'Caja Cartón Corrugado 40x30x25 (und)', linea: 'Empaque', precioVenta: 12, costoUnitario: 8.50, historial: generarHistorial(4200, 'up'), margen: 29, proveedor: 'Smurfit Kappa CA' },
  { id: 26, nombre: 'Película Stretch Manual (rollo)', linea: 'Empaque', precioVenta: 265, costoUnitario: 185, historial: generarHistorial(150, 'up'), margen: 30, proveedor: 'Smurfit Kappa CA' },
  { id: 27, nombre: 'Fleje Plástico PP 12mm (rollo)', linea: 'Empaque', precioVenta: 185, costoUnitario: 125, historial: generarHistorial(45, 'stable'), margen: 32, proveedor: 'Signode CA' },
  { id: 28, nombre: 'Etiqueta Adhesiva en Rollo (rollo)', linea: 'Empaque', precioVenta: 98, costoUnitario: 65, historial: generarHistorial(220, 'up'), margen: 34, proveedor: 'MCC Etiquetas' },
  { id: 29, nombre: 'Bolsa Polietileno 20x30 (millar)', linea: 'Empaque', precioVenta: 128, costoUnitario: 85, historial: generarHistorial(135, 'stable'), margen: 34, proveedor: 'Plastifar CA' },
  { id: 30, nombre: 'Pallet Plástico 1200x1000 (und)', linea: 'Empaque', precioVenta: 220, costoUnitario: 145, historial: generarHistorial(55, 'up'), margen: 34, proveedor: 'Cabka CA' },
  { id: 31, nombre: 'Cinta Adhesiva Transparente (caja)', linea: 'Empaque', precioVenta: 52, costoUnitario: 35, historial: generarHistorial(220, 'stable'), margen: 33, proveedor: '3M Guatemala' },
  { id: 32, nombre: 'Separadores Cartón Ondulado (millar)', linea: 'Empaque', precioVenta: 28, costoUnitario: 18, historial: generarHistorial(650, 'up'), margen: 36, proveedor: 'Smurfit Kappa CA' },
  // Producto Terminado
  { id: 33, nombre: 'Botella PET 500ml Cuello 28mm (millar)', linea: 'Producto Terminado', precioVenta: 1.25, costoUnitario: 0.85, historial: generarHistorial(6500, 'up'), margen: 32, proveedor: 'Thermoplastica GT' },
  { id: 34, nombre: 'Botella PET 1L Cuello 28mm (millar)', linea: 'Producto Terminado', precioVenta: 1.80, costoUnitario: 1.20, historial: generarHistorial(4200, 'up'), margen: 33, proveedor: 'Thermoplastica GT' },
  { id: 35, nombre: 'Tapa Rosca 28mm Seguridad (millar)', linea: 'Producto Terminado', precioVenta: 0.55, costoUnitario: 0.35, historial: generarHistorial(9200, 'up'), margen: 36, proveedor: 'Thermoplastica GT' },
  { id: 36, nombre: 'Contenedor PEAD 20L con Tapa (und)', linea: 'Producto Terminado', precioVenta: 28, costoUnitario: 18.50, historial: generarHistorial(1450, 'stable'), margen: 34, proveedor: 'Thermoplastica GT' },
  { id: 37, nombre: 'Cubeta Plástica 5L (und)', linea: 'Producto Terminado', precioVenta: 13.50, costoUnitario: 8.90, historial: generarHistorial(2800, 'up'), margen: 34, proveedor: 'Thermoplastica GT' },
  { id: 38, nombre: 'Tubo PVC 1/2" Rígido (metro)', linea: 'Producto Terminado', precioVenta: 3.80, costoUnitario: 2.50, historial: generarHistorial(6200, 'stable'), margen: 34, proveedor: 'Thermoplastica GT' },
  { id: 39, nombre: 'Pieza Técnica Inyección PP (und)', linea: 'Producto Terminado', precioVenta: 6.50, costoUnitario: 4.20, historial: generarHistorial(3800, 'up'), margen: 35, proveedor: 'Thermoplastica GT' },
  { id: 40, nombre: 'Vaso Descartable 8oz PS (millar)', linea: 'Producto Terminado', precioVenta: 0.68, costoUnitario: 0.45, historial: generarHistorial(12000, 'up'), margen: 34, proveedor: 'Thermoplastica GT' },
  // Repuestos
  { id: 41, nombre: 'Resistencia Calefactora 220V (und)', linea: 'Repuestos', precioVenta: 275, costoUnitario: 185, historial: generarHistorial(35, 'stable'), margen: 33, proveedor: 'Husky Parts CA' },
  { id: 42, nombre: 'Válvula Neumática 5/2 (und)', linea: 'Repuestos', precioVenta: 185, costoUnitario: 125, historial: generarHistorial(18, 'up'), margen: 32, proveedor: 'Festo CA' },
  { id: 43, nombre: 'Tornillo Socket M8x25 Inox (millar)', linea: 'Repuestos', precioVenta: 1250, costoUnitario: 850, historial: generarHistorial(8, 'stable'), margen: 32, proveedor: 'Tornimundo CA' },
  { id: 44, nombre: 'Sensor Temperatura PT100 (und)', linea: 'Repuestos', precioVenta: 215, costoUnitario: 145, historial: generarHistorial(12, 'up'), margen: 33, proveedor: 'Wika CA' },
  { id: 45, nombre: 'Filtro Hidráulico 10 Micras (und)', linea: 'Repuestos', precioVenta: 142, costoUnitario: 95, historial: generarHistorial(10, 'stable'), margen: 33, proveedor: 'Parker Hannifin CA' },
  { id: 46, nombre: 'Junta Tórica Viton Kit (kit)', linea: 'Repuestos', precioVenta: 98, costoUnitario: 65, historial: generarHistorial(22, 'up'), margen: 34, proveedor: 'Parker Hannifin CA' },
  { id: 47, nombre: 'Rodamiento SKF 6205 (und)', linea: 'Repuestos', precioVenta: 128, costoUnitario: 85, historial: generarHistorial(15, 'stable'), margen: 34, proveedor: 'SKF Guatemala' },
  { id: 48, nombre: 'Manguera Hidráulica 3/8" (metro)', linea: 'Repuestos', precioVenta: 42, costoUnitario: 28, historial: generarHistorial(55, 'up'), margen: 33, proveedor: 'Parker Hannifin CA' },
];

// Meses para labels de historial
export const demoMesesHistorial = ['Dic 2025', 'Ene 2026', 'Feb 2026', 'Mar 2026', 'Abr 2026', 'May 2026'];
export const demoMesesProyeccion = ['Jun 2026', 'Jul 2026', 'Ago 2026'];
