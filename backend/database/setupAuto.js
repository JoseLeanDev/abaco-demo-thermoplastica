require('dotenv').config();
const db = require('./connection');
const { seedData } = require('./seed');

async function setupDatabase() {
  console.log('\n🚀 Verificando schema de base de datos...');
  
  try {
    // Verificar si snapshots_diarios existe
    const snapshotsExists = await db.getAsync(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'snapshots_diarios'
      ) as exists
    `);
    
    if (!snapshotsExists?.exists) {
      console.log('📦 Creando tablas faltantes...');
      
      // Crear snapshots_diarios
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS snapshots_diarios (
          id SERIAL PRIMARY KEY,
          empresa_id INTEGER DEFAULT 1,
          fecha DATE,
          datos_json JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `, []);
      
      // Agregar metricas_json a snapshots_financieros si no existe
      await db.runAsync(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'snapshots_financieros' AND column_name = 'metricas_json'
          ) THEN
            ALTER TABLE snapshots_financieros ADD COLUMN metricas_json JSONB;
          END IF;
        END $$;
      `, []);
      
      console.log('✅ Tablas faltantes creadas');
    } else {
      console.log('✅ Schema completo');
    }
    
    // Índices de lectura para el análisis de ventas (filtros por artículo/categoría).
    // Sin índice por articulo_id, los filtros de producto recorrían el índice único
    // completo una vez por artículo (~7 s por consulta).
    try {
      await db.runAsync(`CREATE INDEX IF NOT EXISTS ix_fact_ventas_articulo_fecha
        ON thermoplastica.fact_ventas_linea (articulo_id, fecha_emision)`, []);
    } catch (e) {
      console.error('No se pudo crear índice de ventas por artículo:', e.message);
    }

    // Verificar si hay datos
    const empresaCount = await db.getAsync('SELECT COUNT(*) as count FROM empresas');
    
    if (parseInt(empresaCount?.count || 0) === 0) {
      console.log('🌱 Base de datos vacía. Ejecutando seed...');
      await seedData();
      console.log('✅ Datos demo cargados');
    } else {
      console.log(`✅ Base de datos ya tiene ${empresaCount.count} empresa(s)`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error en setup:', error.message);
    return false;
  }
}

module.exports = { setupDatabase };

// Si se ejecuta directamente
if (require.main === module) {
  setupDatabase().then(() => process.exit(0));
}
