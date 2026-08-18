const db = require('./connection');

// Detectar si estamos usando PostgreSQL
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

// ============================================
// CONFIGURACIÓN EMPRESARIAL - THERMOPLÁSTICA
// ============================================
const EMPRESA = {
  nombre: 'Thermoplástica, S.A.',
  nit: '1234567-8',
  direccion: '32 Calle 5-49, Zona 3, Guatemala, C.A.',
  telefono: '+502 2317-3000',
  email: 'info@thermoplastica.com',
  industria: 'Empaque y envase industrial',
  empleados: 120
};

// SUCURSALES
const SUCURSALES = [
  { nombre: 'Planta Central', direccion: '32 Calle 5-49, Zona 3, Guatemala', tipo: 'central', empleados: 45 },
  { nombre: 'Planta Zona 12', direccion: 'Calzada Aguilar Batres, Zona 12, Guatemala', tipo: 'sucursal', empleados: 35 },
  { nombre: 'Centro Distribución Petapa', direccion: 'Km. 14.5 Carretera a El Salvador, Guatemala', tipo: 'sucursal', empleados: 25 },
  { nombre: 'Oficinas Administrativas', direccion: 'Torre Reforma, Zona 9, Guatemala', tipo: 'administrativo', empleados: 15 },
];

// Catalogo de clientes - B2B (industria, retail, exportación) y B2C
const CLIENTES = [
  // B2B - Industria Alimenticia
  { nombre: 'Cervecería Centroamericana', credito: 450000, terminos: 30, tipo: 'B2B', segmento: 'alimenticia' },
  { nombre: 'Corporación Multi Inversiones', credito: 380000, terminos: 30, tipo: 'B2B', segmento: 'conglomerado' },
  { nombre: 'Grupo Hame', credito: 280000, terminos: 15, tipo: 'B2B', segmento: 'alimenticia' },
  { nombre: 'Industrias de la Galletera', credito: 195000, terminos: 15, tipo: 'B2B', segmento: 'alimenticia' },
  // B2B - Retail y Supermercados
  { nombre: 'La Bodegona (Walmart)', credito: 520000, terminos: 30, tipo: 'B2B', segmento: 'retail' },
  { nombre: 'Supermercados La Torre', credito: 310000, terminos: 15, tipo: 'B2B', segmento: 'retail' },
  { nombre: 'Paiz (Grupo La Fragua)', credito: 275000, terminos: 15, tipo: 'B2B', segmento: 'retail' },
  { nombre: 'Maxi Despensa', credito: 180000, terminos: 7, tipo: 'B2B', segmento: 'retail' },
  // B2B - Farmacéutica y Salud
  { nombre: 'Farmacéutica Centroamericana', credito: 220000, terminos: 30, tipo: 'B2B', segmento: 'farmaceutica' },
  { nombre: 'Laboratorios Bernabé', credito: 165000, terminos: 15, tipo: 'B2B', segmento: 'farmaceutica' },
  { nombre: 'Medical Center Supplies', credito: 95000, terminos: 15, tipo: 'B2B', segmento: 'salud' },
  // B2B - Exportación y Textil
  { nombre: 'Vestex (Grupo Hame)', credito: 180000, terminos: 30, tipo: 'B2B', segmento: 'textil' },
  { nombre: 'Textiles del Pacífico', credito: 145000, terminos: 30, tipo: 'B2B', segmento: 'textil' },
  { nombre: 'Exportaciones Agrícolas GT', credito: 320000, terminos: 30, tipo: 'B2B', segmento: 'agricola' },
  // B2C - Clientes individuales (sin crédito, pago al contado)
  { nombre: 'Cliente Particular (Varios)', credito: 0, terminos: 0, tipo: 'B2C', segmento: 'particular' },
];

// Catalogo de proveedores de Thermoplástica
const PROVEEDORES = [
  { nombre: 'Resinas Petróleos Mexicanos (PEMEX)', terminos: '2/10 n/30', descuento: '2%' },
  { nombre: 'Dow Chemical Centralamérica', terminos: 'n/30', descuento: null },
  { nombre: 'Basell Poliolefinas', terminos: '1/15 n/45', descuento: '1%' },
  { nombre: 'Equipos Termoformado INDUSTRIA', terminos: 'n/45', descuento: null },
  { nombre: 'Servicio Técnico Maquinaria Plástica', terminos: 'contado', descuento: null },
  { nombre: 'Empaques y Películas Centroamérica', terminos: 'n/15', descuento: null },
  { nombre: 'Agua y Saneamiento, S.A.', terminos: 'n/15', descuento: null },
  { nombre: 'Telefónica Guatemala, S.A.', terminos: 'n/15', descuento: null },
  { nombre: 'Alquileres Industriales Metropolitanos', terminos: 'n/5', descuento: null },
  { nombre: 'Seguros El Roble, S.A.', terminos: 'n/30', descuento: null },
  { nombre: 'Seguridad Privada Orion', terminos: 'n/15', descuento: null },
  { nombre: 'Mantenimiento Industrial GT', terminos: 'n/15', descuento: null },
  { nombre: 'Suministros de Oficina G&T', terminos: 'n/30', descuento: null },
  { nombre: 'Transporte de Carga Express', terminos: 'n/15', descuento: null },
  { nombre: 'Consultoría Financiera SIGMA', terminos: 'n/30', descuento: null },
];

// Cuentas bancarias (escenario realista PYME: 2-3 cuentas)
const CUENTAS_BANCARIAS = [
  { banco: 'Banco Industrial', tipo: 'monetaria', numero: '019-012345-6', saldo: 1250000, moneda: 'GTQ' },
  { banco: 'BAC Credomatic', tipo: 'monetaria', numero: '789-456123-0', saldo: 520000, moneda: 'GTQ' },
  { banco: 'Banco Agromercantil', tipo: 'ahorro', numero: '156-789234-1', saldo: 185000, moneda: 'USD' },
];

// Helper functions
const formatDate = (date) => date.toISOString().split('T')[0];
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const seedData = async () => {
  console.log('🌱 INICIANDO CARGA DE DATOS EMPRESARIALES...\n');
  const startTime = Date.now();

  // ============================================
  // 1. EMPRESA
  // ============================================
  console.log('🏢 Creando empresa...');
  let empresaId;
  
  // Verificar si la empresa ya existe
  const existingEmpresa = await db.getAsync('SELECT id FROM empresas WHERE nit = ?', [EMPRESA.nit]);
  if (existingEmpresa) {
    empresaId = existingEmpresa.id;
    console.log(`   ℹ️ Empresa ya existe (ID: ${empresaId}), usando existente`);
  } else {
    const empresaResult = await db.runAsync(`
      INSERT INTO empresas (nombre, nit, direccion, telefono, email)
      VALUES (?, ?, ?, ?, ?)
    `, [EMPRESA.nombre, EMPRESA.nit, EMPRESA.direccion, EMPRESA.telefono, EMPRESA.email]);
    empresaId = empresaResult.id;
    console.log(`   ✅ ${EMPRESA.nombre} (ID: ${empresaId})`);
  }

  // ============================================
  // 2. CUENTAS BANCARIAS
  // ============================================
  console.log('\n💳 Creando cuentas bancarias...');
  const hoy = new Date('2026-03-31');
  const fechaConciliacion = formatDate(addDays(hoy, -3));
  
  for (const cuenta of CUENTAS_BANCARIAS) {
    // PostgreSQL usa 'numero_cuenta', SQLite usa 'numero_cuenta' también ahora
    await db.runAsync(`
      INSERT INTO cuentas_bancarias 
      (empresa_id, banco, tipo, numero_cuenta, saldo, moneda, activa)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
    `, [empresaId, cuenta.banco, cuenta.tipo, cuenta.numero, cuenta.saldo, cuenta.moneda]);
    console.log(`   ✅ ${cuenta.banco} - ${cuenta.moneda} ${cuenta.saldo.toLocaleString()}`);
  }

  // ============================================
  // 3. CUENTAS POR COBRAR (CxC) - 45 documentos
  // ============================================
  console.log('\n📄 Creando Cuentas por Cobrar (45 documentos)...');
  
  let cxcStats = { total: 0, al_corriente: 0, atrasadas: 0, cobradas: 0 };
  
  // En PostgreSQL: cliente_nombre, factura_numero, monto_total, monto_pendiente
  // En SQLite: cliente, factura, monto
  const cxcColumns = isPostgres 
    ? '(empresa_id, cliente_nombre, factura_numero, monto_total, monto_pendiente, fecha_emision, fecha_vencimiento, dias_atraso, estado)'
    : '(empresa_id, cliente, factura, monto, fecha_emision, fecha_vencimiento, dias_atraso, estado)';
  
  // Documentos al corriente (15)
  for (let i = 0; i < 15; i++) {
    const cliente = CLIENTES[Math.floor(Math.random() * CLIENTES.length)];
    const monto = Math.floor(Math.random() * 45000) + 5000;
    const diasCredito = cliente.terminos;
    const fechaEmision = addDays(hoy, -Math.floor(Math.random() * (diasCredito - 5)));
    const fechaVencimiento = addDays(fechaEmision, diasCredito);
    const diasAtraso = Math.max(0, Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24)));
    const factura = `F-${2026}${String(Math.floor(Math.random() * 9000) + 1000)}`;
    
    const values = isPostgres
      ? [empresaId, cliente.nombre, factura, monto, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'al_corriente']
      : [empresaId, cliente.nombre, factura, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'al_corriente'];
    
    await db.runAsync(`INSERT INTO cuentas_cobrar ${cxcColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    cxcStats.total += monto;
    cxcStats.al_corriente += monto;
  }
  
  // Documentos atrasadas 1-30 días (12)
  for (let i = 0; i < 12; i++) {
    const cliente = CLIENTES[Math.floor(Math.random() * CLIENTES.length)];
    const monto = Math.floor(Math.random() * 65000) + 15000;
    const diasAtraso = Math.floor(Math.random() * 30) + 1;
    const fechaVencimiento = addDays(hoy, -diasAtraso);
    const fechaEmision = addDays(fechaVencimiento, -30);
    const factura = `F-${2026}${String(Math.floor(Math.random() * 9000) + 1000)}`;
    
    const values = isPostgres
      ? [empresaId, cliente.nombre, factura, monto, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'atrasada']
      : [empresaId, cliente.nombre, factura, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'atrasada'];
    
    await db.runAsync(`INSERT INTO cuentas_cobrar ${cxcColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    cxcStats.total += monto;
    cxcStats.atrasadas += monto;
  }
  
  // Documentos atrasadas 31-60 días (10)
  for (let i = 0; i < 10; i++) {
    const cliente = CLIENTES[Math.floor(Math.random() * CLIENTES.length)];
    const monto = Math.floor(Math.random() * 85000) + 25000;
    const diasAtraso = Math.floor(Math.random() * 30) + 31;
    const fechaVencimiento = addDays(hoy, -diasAtraso);
    const fechaEmision = addDays(fechaVencimiento, -30);
    const factura = `F-${2026}${String(Math.floor(Math.random() * 9000) + 1000)}`;
    
    const values = isPostgres
      ? [empresaId, cliente.nombre, factura, monto, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'atrasada']
      : [empresaId, cliente.nombre, factura, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'atrasada'];
    
    await db.runAsync(`INSERT INTO cuentas_cobrar ${cxcColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    cxcStats.total += monto;
    cxcStats.atrasadas += monto;
  }
  
  // Documentos atrasadas 60+ días (8)
  for (let i = 0; i < 8; i++) {
    const cliente = CLIENTES[Math.floor(Math.random() * CLIENTES.length)];
    const monto = Math.floor(Math.random() * 120000) + 40000;
    const diasAtraso = Math.floor(Math.random() * 60) + 61;
    const fechaVencimiento = addDays(hoy, -diasAtraso);
    const fechaEmision = addDays(fechaVencimiento, -30);
    const factura = `F-${2026}${String(Math.floor(Math.random() * 9000) + 1000)}`;
    
    const values = isPostgres
      ? [empresaId, cliente.nombre, factura, monto, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'atrasada']
      : [empresaId, cliente.nombre, factura, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), diasAtraso, 'atrasada'];
    
    await db.runAsync(`INSERT INTO cuentas_cobrar ${cxcColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    cxcStats.total += monto;
    cxcStats.atrasadas += monto;
  }
  
  console.log(`   ✅ Total CxC: Q${cxcStats.total.toLocaleString()}`);
  console.log(`      • Al corriente: Q${cxcStats.al_corriente.toLocaleString()}`);
  console.log(`      • Atrasadas: Q${cxcStats.atrasadas.toLocaleString()}`);

  // ============================================
  // 4. CUENTAS POR PAGAR (CxP) - 35 documentos
  // ============================================
  console.log('\n📑 Creando Cuentas por Pagar (35 documentos)...');
  
  let cxpStats = { total: 0, pendientes: 0, proximos: 0 };
  
  const cxpColumns = isPostgres
    ? '(empresa_id, proveedor_nombre, factura_numero, monto_total, monto_pendiente, fecha_emision, fecha_vencimiento, estado)'
    : '(empresa_id, proveedor, factura, monto, fecha_emision, fecha_vencimiento, descuento_pronto_pago, estado)';
  
  // Documentos vencidos (5)
  for (let i = 0; i < 5; i++) {
    const proveedor = PROVEEDORES[Math.floor(Math.random() * PROVEEDORES.length)];
    const monto = Math.floor(Math.random() * 80000) + 20000;
    const diasVencido = Math.floor(Math.random() * 20) + 5;
    const fechaVencimiento = addDays(hoy, -diasVencido);
    const fechaEmision = addDays(fechaVencimiento, -30);
    const factura = `NC-${2026}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    
    const values = isPostgres
      ? [empresaId, proveedor.nombre, factura, monto, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), 'pendiente']
      : [empresaId, proveedor.nombre, factura, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), proveedor.descuento, 'pendiente'];
    
    await db.runAsync(`INSERT INTO cuentas_pagar ${cxpColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    cxpStats.total += monto;
    cxpStats.pendientes += monto;
  }
  
  // Documentos próximos a vencer 1-15 días (15)
  for (let i = 0; i < 15; i++) {
    const proveedor = PROVEEDORES[Math.floor(Math.random() * PROVEEDORES.length)];
    const monto = Math.floor(Math.random() * 120000) + 30000;
    const diasRestantes = Math.floor(Math.random() * 15) + 1;
    const fechaVencimiento = addDays(hoy, diasRestantes);
    const fechaEmision = addDays(fechaVencimiento, -30);
    const factura = `NC-${2026}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    
    const values = isPostgres
      ? [empresaId, proveedor.nombre, factura, monto, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), 'pendiente']
      : [empresaId, proveedor.nombre, factura, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), proveedor.descuento, 'pendiente'];
    
    await db.runAsync(`INSERT INTO cuentas_pagar ${cxpColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    cxpStats.total += monto;
    cxpStats.pendientes += monto;
    cxpStats.proximos += monto;
  }
  
  // Documentos vencen en 16-45 días (15)
  for (let i = 0; i < 15; i++) {
    const proveedor = PROVEEDORES[Math.floor(Math.random() * PROVEEDORES.length)];
    const monto = Math.floor(Math.random() * 250000) + 50000;
    const diasRestantes = Math.floor(Math.random() * 30) + 16;
    const fechaVencimiento = addDays(hoy, diasRestantes);
    const fechaEmision = addDays(fechaVencimiento, -30);
    const factura = `NC-${2026}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    
    const values = isPostgres
      ? [empresaId, proveedor.nombre, factura, monto, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), 'pendiente']
      : [empresaId, proveedor.nombre, factura, monto, formatDate(fechaEmision), formatDate(fechaVencimiento), proveedor.descuento, 'pendiente'];
    
    await db.runAsync(`INSERT INTO cuentas_pagar ${cxpColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    cxpStats.total += monto;
    cxpStats.pendientes += monto;
  }
  
  console.log(`   ✅ Total CxP: Q${cxpStats.total.toLocaleString()}`);
  console.log(`      • Próximos 15 días: Q${cxpStats.proximos.toLocaleString()}`);

  // ============================================
  // 5. TRANSACCIONES (6 meses de historia)
  // ============================================
  console.log('\n💰 Creando historial de transacciones (6 meses)...');
  
  const categoriasEntrada = [
    { cat: 'Venta termoformados B2B', prob: 0.6, min: 25000, max: 125000 },
    { cat: 'Venta envases y tapas', prob: 0.5, min: 15000, max: 95000 },
    { cat: 'Venta liners y sellos de seguridad', prob: 0.4, min: 10000, max: 65000 },
    { cat: 'Venta laminaciones', prob: 0.3, min: 8000, max: 45000 },
    { cat: 'Servicios de maquila', prob: 0.25, min: 5000, max: 35000 },
    { cat: 'Cobros CxC', prob: 0.5, min: 25000, max: 125000 },
    { cat: 'Intereses bancarios', prob: 0.1, min: 1500, max: 8500 },
    { cat: 'Otros ingresos', prob: 0.05, min: 2500, max: 25000 },
  ];
  
  const categoriasSalida = [
    { cat: 'Compra resinas plásticas', prob: 0.5, min: 45000, max: 185000 },
    { cat: 'Nómina', prob: 0.25, min: 185000, max: 215000 },
    { cat: 'Servicios públicos (electricidad, agua)', prob: 0.2, min: 35000, max: 75000 },
    { cat: 'Alquiler planta industrial', prob: 0.08, min: 85000, max: 85000 },
    { cat: 'Mantenimiento maquinaria termoformado', prob: 0.15, min: 15000, max: 55000 },
    { cat: 'Transporte y logística', prob: 0.15, min: 8000, max: 35000 },
    { cat: 'Marketing y publicidad', prob: 0.1, min: 8000, max: 45000 },
    { cat: 'Impuestos', prob: 0.05, min: 45000, max: 185000 },
    { cat: 'Seguros', prob: 0.03, min: 25000, max: 75000 },
    { cat: 'Pagos CxP', prob: 0.4, min: 25000, max: 125000 },
  ];
  
  let totalTransacciones = 0;
  let totalEntradas = 0;
  let totalSalidas = 0;
  
  // PostgreSQL usa: fecha, tipo, monto, cuenta_id, etc.
  // No tiene categoria, descripcion, cliente_id como tenía SQLite
  // Voy a usar solo las columnas que existen en ambos
  
  // Para simplificar, voy a insertar solo datos básicos
  const transColumns = isPostgres
    ? '(empresa_id, fecha, tipo, monto, estado, concepto)'
    : '(empresa_id, fecha, tipo, categoria, descripcion, monto, cliente_id, nombre_cliente)';
  
  // Generar 6 meses de transacciones
  for (let mes = 5; mes >= 0; mes--) {
    const mesBase = addMonths(hoy, -mes);
    const diasEnMes = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0).getDate();
    
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(mesBase.getFullYear(), mesBase.getMonth(), dia);
      if (fecha > hoy) continue;
      
      // Días hábiles tienen más actividad
      const esDiaHabil = fecha.getDay() !== 0 && fecha.getDay() !== 6;
      const numTrans = esDiaHabil ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 2);
      
      for (let t = 0; t < numTrans; t++) {
        const esEntrada = Math.random() > 0.45; // 55% entradas
        
        if (esEntrada) {
          const cat = categoriasEntrada[Math.floor(Math.random() * categoriasEntrada.length)];
          if (Math.random() > cat.prob) continue;
          
          const monto = Math.floor(Math.random() * (cat.max - cat.min)) + cat.min;
          const descripcion = `${cat.cat} - ${formatDate(fecha)}`;
          const cliente = CLIENTES[Math.floor(Math.random() * CLIENTES.length)];
          
          if (isPostgres) {
            await db.runAsync(`
              INSERT INTO transacciones (empresa_id, fecha, tipo, monto, estado, concepto)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [empresaId, formatDate(fecha), 'entrada', monto, 'activa', descripcion]);
          } else {
            await db.runAsync(`
              INSERT INTO transacciones (empresa_id, fecha, tipo, categoria, descripcion, monto, cliente_id, nombre_cliente)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [empresaId, formatDate(fecha), 'entrada', cat.cat, descripcion, monto, CLIENTES.indexOf(cliente) + 1, cliente.nombre]);
          }
          
          totalEntradas += monto;
        } else {
          const cat = categoriasSalida[Math.floor(Math.random() * categoriasSalida.length)];
          if (Math.random() > cat.prob) continue;
          
          const monto = Math.floor(Math.random() * (cat.max - cat.min)) + cat.min;
          const descripcion = `${cat.cat} - ${formatDate(fecha)}`;
          
          if (isPostgres) {
            await db.runAsync(`
              INSERT INTO transacciones (empresa_id, fecha, tipo, monto, estado, concepto)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [empresaId, formatDate(fecha), 'salida', monto, 'activa', descripcion]);
          } else {
            await db.runAsync(`
              INSERT INTO transacciones (empresa_id, fecha, tipo, categoria, descripcion, monto)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [empresaId, formatDate(fecha), 'salida', cat.cat, descripcion, monto]);
          }
          
          totalSalidas += monto;
        }
        
        totalTransacciones++;
      }
    }
  }
  
  console.log(`   ✅ ${totalTransacciones.toLocaleString()} transacciones creadas`);
  console.log(`      • Entradas: Q${totalEntradas.toLocaleString()}`);
  console.log(`      • Salidas: Q${totalSalidas.toLocaleString()}`);
  console.log(`      • Neto: Q${(totalEntradas - totalSalidas).toLocaleString()}`);

  // ============================================
  // 6. OBLIGACIONES SAT (2026)
  // ============================================
  console.log('\n📋 Creando obligaciones SAT 2026...');
  
  const obligacionesSAT = [
    // IVA Mensual
    { obligacion: 'Declaración IVA Enero 2026', formulario: 'SAT-2231', fecha: '2026-02-15', monto: 78500 },
    { obligacion: 'Declaración IVA Febrero 2026', formulario: 'SAT-2231', fecha: '2026-03-15', monto: 92300 },
    { obligacion: 'Declaración IVA Marzo 2026', formulario: 'SAT-2231', fecha: '2026-04-15', monto: 87500 },
    { obligacion: 'Declaración IVA Abril 2026', formulario: 'SAT-2231', fecha: '2026-05-15', monto: 0 },
    { obligacion: 'Declaración IVA Mayo 2026', formulario: 'SAT-2231', fecha: '2026-06-15', monto: 0 },
    { obligacion: 'Declaración IVA Junio 2026', formulario: 'SAT-2231', fecha: '2026-07-15', monto: 0 },
    
    // ISR Trimestral
    { obligacion: '1ra. Cuota ISR 2026 (Ene-Mar)', formulario: 'SAT-2221', fecha: '2026-03-31', monto: 125000 },
    { obligacion: '2da. Cuota ISR 2026 (Abr-Jun)', formulario: 'SAT-2221', fecha: '2026-06-30', monto: 0 },
    { obligacion: '3ra. Cuota ISR 2026 (Jul-Sep)', formulario: 'SAT-2221', fecha: '2026-09-30', monto: 0 },
    { obligacion: '4ta. Cuota ISR 2026 (Oct-Dic)', formulario: 'SAT-2221', fecha: '2026-12-31', monto: 0 },
    
    // IETU (si aplica)
    { obligacion: 'IETU 1er. Trimestre 2026', formulario: 'SAT-2225', fecha: '2026-03-31', monto: 0 },
    { obligacion: 'IETU 2do. Trimestre 2026', formulario: 'SAT-2225', fecha: '2026-06-30', monto: 0 },
    
    // Anual
    { obligacion: 'Declaración Anual ISR 2025', formulario: 'SAT-2101', fecha: '2026-03-31', monto: 245000 },
    { obligacion: 'Formulario Anual de Beneficiarios', formulario: 'SAT-2201', fecha: '2026-03-31', monto: 0 },
  ];
  
  // PostgreSQL usa: tipo, periodo en lugar de obligacion, formulario
  const oblColumns = isPostgres
    ? '(empresa_id, tipo, periodo, fecha_vencimiento, monto_estimado, estado)'
    : '(empresa_id, obligacion, formulario, fecha_vencimiento, monto_estimado, estado)';
  
  let totalObligaciones = 0;
  for (const obl of obligacionesSAT) {
    const fechaVenc = new Date(obl.fecha);
    const estado = fechaVenc < hoy ? (obl.monto > 0 ? 'atrasada' : 'presentada') : 'pendiente';
    
    const values = isPostgres
      ? [empresaId, obl.obligacion, '2026', obl.fecha, obl.monto, estado]
      : [empresaId, obl.obligacion, obl.formulario, obl.fecha, obl.monto, estado];
    
    await db.runAsync(`INSERT INTO obligaciones_sat ${oblColumns} VALUES (${values.map(() => '?').join(',')})`, values);
    
    if (estado !== 'presentada') totalObligaciones += obl.monto;
  }
  
  console.log(`   ✅ ${obligacionesSAT.length} obligaciones creadas`);
  console.log(`      • Monto pendiente: Q${totalObligaciones.toLocaleString()}`);

  // ============================================
  // 7. ASIENTOS CONTABLES (último mes + histórico)
  // ============================================
  console.log('\n📒 Creando asientos contables...');
  
  // PostgreSQL tiene un esquema muy diferente para asientos
  // Voy a simplificar y solo crear algunos registros básicos
  
  console.log(`   ℹ️ Asientos contables omitidos (esquema diferente en PostgreSQL)`);

  // ============================================
  // LOGS DE AGENTES IA
  // ============================================
  console.log('\n🤖 Creando logs de actividades de Agentes IA...');
  
  const agentesLogs = [
    { agente: 'Caja', tipo: 'caja', categoria: 'proyeccion_cashflow', descripcion: 'Proyección 13 semanas: runway 4.2 meses, burn rate Q32,500/semana', status: 'exito', duracion: 145 },
    { agente: 'Análisis', tipo: 'analisis', categoria: 'kpis_diarios', descripcion: 'KPIs diarios: Margen bruto 42.1%, Ocupación máquinas 78%, Ticket promedio B2B Q2,450', status: 'exito' },
    { agente: 'Cobranza', tipo: 'cobranza', categoria: 'aging_cartera', descripcion: 'Aging CxC: 72% current, 12% 31-60 días, 10% 61-90 días, 6% >90 días', status: 'advertencia', impacto: 85000 },
    { agente: 'Contabilidad', tipo: 'contabilidad', categoria: 'conciliacion_bancaria', descripcion: 'Conciliación bancaria completada: 3 cuentas, 1 discrepancia Q850', status: 'advertencia', impacto: 850 },
    { agente: 'CFO AI Core', tipo: 'orchestrator', categoria: 'briefing_diario', descripcion: 'Briefing diario generado: 4 insights, 2 alertas, 1 acción recomendada', status: 'exito', duracion: 890 },
    { agente: 'Caja', tipo: 'caja', categoria: 'posicion_caja', descripcion: 'Posición caja actual: Q1.85M disponible, Q620K comprometido, Q1.23M libre', status: 'exito' },
    { agente: 'Análisis', tipo: 'analisis', categoria: 'analisis_semanal', descripcion: 'Análisis semanal: Cliente "Hotel Real Intercontinental" redujo servicios 25% este mes', status: 'warning', impacto: -65000 },
    { agente: 'Contabilidad', tipo: 'contabilidad', categoria: 'calculos_fiscales', descripcion: 'Cálculo IVA mensual: Débito Q94,500 - Crédito Q72,300 = Q22,200 a pagar', status: 'exito', impacto: 35200 },
    { agente: 'Cobranza', tipo: 'cobranza', categoria: 'metricas_cobranza', descripcion: 'DSO subió a 26 días (+2 vs mes anterior). Clientes B2B promedio: 18 días', status: 'advertencia' },
    { agente: 'Caja', tipo: 'caja', categoria: 'alerta_runway', descripcion: 'ALERTA: Runway bajó a 3.1 meses. Burn rate aumentó 12% esta semana por reparación equipos.', status: 'error', impacto: -280000 },
    { agente: 'Análisis', tipo: 'analisis', categoria: 'analisis_mensual', descripcion: 'Análisis mensual: Rentabilidad por segmento actualizada - B2B 45% vs B2C 28%', status: 'exito', duracion: 2340 },
    { agente: 'Contabilidad', tipo: 'contabilidad', categoria: 'cierre_mensual', descripcion: 'Cierre mensual automatizado: Asientos de depreciación y provisiones generados', status: 'exito' },
  ];
  
  const logsColumns = isPostgres
    ? '(empresa_id, agente_nombre, agente_tipo, categoria, descripcion, resultado_status, impacto_valor, duracion_ms, created_at)'
    : '(empresa_id, agente_nombre, agente_tipo, categoria, descripcion, resultado_status, impacto_valor, duracion_ms, created_at)';
  
  for (const log of agentesLogs) {
    const fecha = new Date(hoy);
    fecha.setHours(fecha.getHours() - Math.floor(Math.random() * 48)); // Últimas 48 horas
    
    await db.runAsync(`
      INSERT INTO agentes_logs ${logsColumns}
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empresaId,
      log.agente,
      log.tipo,
      log.categoria,
      log.descripcion,
      log.status,
      log.impacto || 0,
      log.duracion || Math.floor(Math.random() * 500) + 50,
      fecha.toISOString()
    ]);
  }
  
  console.log(`   ✅ ${agentesLogs.length} logs de agentes creados`);
  console.log(`      • Insights generados: ${agentesLogs.filter(l => l.categoria === 'insight_generado').length}`);
  console.log(`      • Alertas: ${agentesLogs.filter(l => l.categoria === 'alerta_detectada').length}`);
  console.log(`      • Análisis ejecutados: ${agentesLogs.filter(l => l.categoria === 'analisis_ejecutado').length}`);

  // ============================================
  // RESUMEN FINAL
  // ============================================
  const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);
  
  const totalCuentasGTQ = CUENTAS_BANCARIAS.filter(c => c.moneda === 'GTQ').reduce((a, c) => a + c.saldo, 0);
  const totalCuentasUSD = CUENTAS_BANCARIAS.filter(c => c.moneda === 'USD').reduce((a, c) => a + c.saldo, 0);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ CARGA DE DATOS COMPLETADA EXITOSAMENTE');
  console.log('='.repeat(50));
  console.log(`\n📊 RESUMEN EJECUTIVO:`);
  console.log(`   Empresa: ${EMPRESA.nombre}`);
  console.log(`   NIT: ${EMPRESA.nit}`);
  console.log(`\n💰 POSICIÓN FINANCIERA:`);
  console.log(`   • Cuentas bancarias: ${CUENTAS_BANCARIAS.length} (GTQ: ${CUENTAS_BANCARIAS.filter(c => c.moneda === 'GTQ').length}, USD: ${CUENTAS_BANCARIAS.filter(c => c.moneda === 'USD').length})`);
  console.log(`   • Disponible GTQ: Q${totalCuentasGTQ.toLocaleString()}`);
  console.log(`   • Disponible USD: $${totalCuentasUSD.toLocaleString()} (≈Q${(totalCuentasUSD * 7.75).toLocaleString()})`);
  console.log(`   • Total consolidado: Q${(totalCuentasGTQ + totalCuentasUSD * 7.75).toLocaleString()}`);
  console.log(`   • CxC Total: Q${cxcStats.total.toLocaleString()}`);
  console.log(`   • CxP Total: Q${cxpStats.total.toLocaleString()}`);
  console.log(`   • Working Capital: Q${(cxcStats.total - cxpStats.total).toLocaleString()}`);
  console.log(`\n📈 OPERACIÓN 6 MESES:`);
  console.log(`   • Ingresos: Q${totalEntradas.toLocaleString()}`);
  console.log(`   • Egresos: Q${totalSalidas.toLocaleString()}`);
  console.log(`   • Margen operativo: ${((totalEntradas - totalSalidas) / totalEntradas * 100).toFixed(1)}%`);
  console.log(`\n⚠️  ALERTAS ACTIVAS:`);
  console.log(`   • CxC vencido: Q${cxcStats.atrasadas.toLocaleString()} (${((cxcStats.atrasadas/cxcStats.total)*100).toFixed(1)}%)`);
  console.log(`   • Obligaciones SAT pendientes: ${obligacionesSAT.filter(o => o.monto > 0 && new Date(o.fecha) >= hoy).length}`);
  console.log(`\n⏱️  Tiempo total: ${tiempoTotal}s`);
  console.log('='.repeat(50));
};

// Ejecutar
if (require.main === module) {
  seedData()
    .then(() => {
      console.log('\n🎉 DEMO LISTO PARA PRESENTACIÓN A CLIENTES\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Error en seed:', err);
      process.exit(1);
    });
}

module.exports = { seedData };
