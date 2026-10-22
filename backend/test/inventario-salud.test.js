const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resumirInv } = require('../src/services/inventarioSalud');
const fila = (clase, estado, valor, dias_cobertura = null) => ({ clase, estado, valor, dias_cobertura, stock_actual: 10 });

test('el insumo sin consumo no es capital quieto ni activo y conserva su valor', () => {
  const r = resumirInv([fila('materia_prima', 'por_validar', 1000), fila('sin_movimiento', 'por_validar', 500)]);
  assert.equal(r.total, 1500);
  assert.equal(r.por_validar, 1500);
  assert.equal(r.activo, 0);
  assert.equal(r.quieto, 0);
  assert.equal(r.articulos_quietos, 0);
  assert.equal(r.unidades_quietas, 0);
  assert.equal(r.dias_cobertura, null);
});

test('el inventario sin consumo no infla la cobertura ni se oculta del total', () => {
  const r = resumirInv([
    fila('materia_prima', 'por_validar', 1000000),
    fila('producto', 'activo', 1000, 100),
    fila('producto', 'lento', 2000, 200),
    fila('producto', 'inmovilizado', 500),
  ]);
  assert.equal(r.total, 1003500);
  assert.equal(r.activo, 1000);
  assert.equal(r.lento, 2000);
  assert.equal(r.inmovilizado, 500);
  assert.equal(r.quieto, 2500);
  assert.equal(r.por_validar, 1000000);
  assert.equal(r.valor_evaluable, 3500);
  assert.equal(r.dias_cobertura, 175);
  assert.equal(r.articulos_quietos, 2);
  assert.equal(r.unidades_quietas, 20);
});

test('las alertas de exceso y rotación no usan las compras como consumo', async () => {
  const { excesoDe, resumir } = await import('../../frontend/src/components/inventario/metricas.mjs');
  const insumo = { clase: 'materia_prima', estado: 'por_validar', valor: 1000000,
    valor_transito: 200, compras: 50000, salida: null, cogs: 0, consumo_mp: null, quiebre: false };
  const producto = { clase: 'producto', estado: 'activo', valor: 1000,
    valor_transito: 0, salida: 1000, cogs: 1000, quiebre: false };
  assert.equal(excesoDe(insumo, 100, 90), null);
  const solo = resumir([insumo], 100, 90);
  assert.equal(solo.valor, 1000000);
  assert.equal(solo.por_validar, 1000000);
  assert.equal(solo.exceso, 0);
  assert.equal(solo.rotacion, null);
  assert.equal(solo.dias_inventario, null);
  const mixto = resumir([insumo, producto], 100, 90);
  assert.equal(mixto.valor, 1001000);
  assert.equal(mixto.dias_inventario, 100);
  assert.equal(mixto.exceso, 100);
  assert.equal(mixto.quieto, 0);
});
