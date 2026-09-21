require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

router.get('/', async (req, res) => {
  try {
    const empresaId = req.query.empresa_id || 1;
    
    // Verificar conexión a DB
    const testQuery = await db.getAsync('SELECT NOW() as now');
    
    // Verificar cuentas bancarias
    const cb = await db.getAsync('SELECT COUNT(*) as c, SUM(saldo) as total FROM cuentas_bancarias WHERE empresa_id = ? AND activa = TRUE', [empresaId]);
    
    // Verificar CxC
    const cxc = await db.getAsync('SELECT SUM(monto_total) as total FROM cuentas_cobrar WHERE empresa_id = ? AND estado != ?', [empresaId, 'cobrada']);
    
    // Verificar CxP
    const cxp = await db.getAsync('SELECT SUM(monto_total) as total FROM cuentas_pagar WHERE empresa_id = ? AND estado = ?', [empresaId, 'pendiente']);
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      db_connection: testQuery,
      cuentas_bancarias: cb,
      cxc: cxc,
      cxp: cxp,
      empresa_id: empresaId
    });
  } catch (error) {
    console.error('[DEBUG ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno'
    });
  }
});

module.exports = router;