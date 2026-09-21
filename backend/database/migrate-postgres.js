/**
 * Script de migración de SQLite a PostgreSQL
 * Crea las tablas en PostgreSQL con el esquema correcto
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const schema = `
-- Empresas
CREATE TABLE IF NOT EXISTS empresas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nit VARCHAR(50),
  direccion TEXT,
  telefono VARCHAR(50),
  email VARCHAR(255),
  moneda_principal VARCHAR(10) DEFAULT 'GTQ',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cuentas contables
CREATE TABLE IF NOT EXISTS cuentas_contables (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  subtipo VARCHAR(50),
  nivel INTEGER DEFAULT 1,
  cuenta_padre_id INTEGER,
  saldo_actual DECIMAL(15,2) DEFAULT 0,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transacciones
CREATE TABLE IF NOT EXISTS transacciones (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  fecha DATE NOT NULL,
  cuenta_id INTEGER REFERENCES cuentas_contables(id),
  tipo VARCHAR(20) NOT NULL, -- debe o haber
  monto DECIMAL(15,2) NOT NULL,
  concepto TEXT,
  referencia VARCHAR(255),
  documento_soporte VARCHAR(255),
  usuario_id INTEGER,
  estado VARCHAR(20) DEFAULT 'activa',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Saldos de cuentas
CREATE TABLE IF NOT EXISTS saldos_cuentas (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  cuenta_id INTEGER REFERENCES cuentas_contables(id),
  periodo VARCHAR(7) NOT NULL, -- YYYY-MM
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  saldo_actual DECIMAL(15,2) DEFAULT 0,
  total_debe DECIMAL(15,2) DEFAULT 0,
  total_haber DECIMAL(15,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cuentas bancarias
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  banco VARCHAR(255) NOT NULL,
  tipo VARCHAR(50),
  numero_cuenta VARCHAR(100),
  saldo DECIMAL(15,2) DEFAULT 0,
  moneda VARCHAR(10) DEFAULT 'GTQ',
  ultima_conciliacion DATE,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Movimientos bancarios
CREATE TABLE IF NOT EXISTS movimientos_bancarios (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  cuenta_bancaria_id INTEGER REFERENCES cuentas_bancarias(id),
  fecha DATE NOT NULL,
  descripcion TEXT,
  monto DECIMAL(15,2) NOT NULL,
  tipo VARCHAR(20), -- ingreso, egreso
  referencia VARCHAR(255),
  estado_conciliacion VARCHAR(20) DEFAULT 'pendiente',
  transaccion_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cuentas por cobrar
CREATE TABLE IF NOT EXISTS cuentas_cobrar (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  cliente_id INTEGER,
  cliente_nombre VARCHAR(255),
  factura_numero VARCHAR(100),
  monto_total DECIMAL(15,2) NOT NULL,
  monto_pendiente DECIMAL(15,2) NOT NULL,
  fecha_emision DATE,
  fecha_vencimiento DATE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  dias_atraso INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cuentas por pagar
CREATE TABLE IF NOT EXISTS cuentas_pagar (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  proveedor_id INTEGER,
  proveedor_nombre VARCHAR(255),
  factura_numero VARCHAR(100),
  monto_total DECIMAL(15,2) NOT NULL,
  monto_pendiente DECIMAL(15,2) NOT NULL,
  fecha_emision DATE,
  fecha_vencimiento DATE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  dias_restantes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Logs de agentes
CREATE TABLE IF NOT EXISTS agentes_logs (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  agente_nombre VARCHAR(255) NOT NULL,
  agente_tipo VARCHAR(100) NOT NULL,
  agente_version VARCHAR(50),
  categoria VARCHAR(100),
  descripcion TEXT,
  detalles_json JSONB,
  entidad_tipo VARCHAR(100),
  entidad_id INTEGER,
  impacto_valor DECIMAL(15,2),
  impacto_moneda VARCHAR(10),
  resultado_status VARCHAR(50),
  duracion_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alertas financieras
CREATE TABLE IF NOT EXISTS alertas_financieras (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  tipo VARCHAR(100) NOT NULL,
  nivel VARCHAR(20) NOT NULL, -- info, advertencia, critica
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  datos_json JSONB,
  estado VARCHAR(50) DEFAULT 'activa',
  fecha_resolucion TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insights histórico
CREATE TABLE IF NOT EXISTS insights_historico (
  id SERIAL PRIMARY KEY,
  insight_id VARCHAR(255) UNIQUE,
  empresa_id INTEGER DEFAULT 1,
  type VARCHAR(100) NOT NULL,
  category VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  severity VARCHAR(20),
  impact DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'GTQ',
  action TEXT,
  action_label VARCHAR(255),
  change_percent DECIMAL(10,2),
  periodo_desde DATE,
  periodo_hasta DATE,
  agent_source VARCHAR(255),
  agent_version VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP,
  dismissed_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Asientos contables
CREATE TABLE IF NOT EXISTS asientos (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  fecha DATE NOT NULL,
  concepto TEXT,
  total_debe DECIMAL(15,2) DEFAULT 0,
  total_haber DECIMAL(15,2) DEFAULT 0,
  estado VARCHAR(20) DEFAULT 'pendiente',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Conciliaciones bancarias
CREATE TABLE IF NOT EXISTS conciliaciones (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  cuenta_bancaria_id INTEGER REFERENCES cuentas_bancarias(id),
  fecha_inicio DATE,
  fecha_fin DATE,
  saldo_banco DECIMAL(15,2),
  saldo_contable DECIMAL(15,2),
  diferencia DECIMAL(15,2),
  estado VARCHAR(50) DEFAULT 'pendiente',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cierres mensuales
CREATE TABLE IF NOT EXISTS cierres_mensuales (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  mes VARCHAR(7) NOT NULL, -- YYYY-MM
  fecha_cierre DATE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  observaciones TEXT,
  cerrado_por INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(50) DEFAULT 'usuario',
  avatar_url VARCHAR(500),
  activo BOOLEAN DEFAULT TRUE,
  ultimo_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Briefings diarios
CREATE TABLE IF NOT EXISTS briefings_diarios (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  fecha DATE UNIQUE NOT NULL,
  contenido TEXT,
  datos_json JSONB,
  enviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Snapshots financieros
CREATE TABLE IF NOT EXISTS snapshots_financieros (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  tipo VARCHAR(100),
  fecha DATE,
  metricas_json JSONB,
  datos_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Snapshots diarios
CREATE TABLE IF NOT EXISTS snapshots_diarios (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  fecha DATE,
  datos_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sugerencias de conciliación
CREATE TABLE IF NOT EXISTS sugerencias_conciliacion (
  id SERIAL PRIMARY KEY,
  movimiento_id INTEGER REFERENCES movimientos_bancarios(id),
  transaccion_id INTEGER REFERENCES transacciones(id),
  confianza VARCHAR(20), -- alta, media, baja
  razon TEXT,
  estado VARCHAR(50) DEFAULT 'pendiente',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Obligaciones SAT
CREATE TABLE IF NOT EXISTS obligaciones_sat (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER DEFAULT 1,
  tipo VARCHAR(100) NOT NULL,
  periodo VARCHAR(20),
  fecha_vencimiento DATE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  monto_estimado DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar empresa por defecto
INSERT INTO empresas (id, nombre, nit, moneda_principal)
VALUES (1, 'Empresa Demo', '1234567-8', 'GTQ')
ON CONFLICT DO NOTHING;

-- Usuario admin: crear manualmente con password fuerte via /api/auth/register o script seed.
-- (Se removió el usuario demo hardcoded por razones de seguridad; nunca commitear password_hash.)
`;

async function migrate() {
  console.log('🚀 Iniciando creación de tablas en PostgreSQL...\n');
  
  try {
    await pool.query(schema);
    console.log('✅ Tablas creadas exitosamente');
    console.log('\n📊 Tablas creadas:');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    tables.rows.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.table_name}`);
    });
    
    console.log('\n✅ Listo para usar PostgreSQL');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrate();
