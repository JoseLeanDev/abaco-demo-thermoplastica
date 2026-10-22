// La ausencia de compra/venta no acredita ausencia de consumo en producción.
const esQuieto = r => r.estado === 'lento' || r.estado === 'inmovilizado';

function resumirInv(filas) {
  const suma = f => filas.reduce((s, r) => s + (f(r) ? r.valor : 0), 0);
  const total = suma(() => true);
  const lento = suma(r => r.estado === 'lento');
  const inmovilizado = suma(r => r.estado === 'inmovilizado');
  const porValidar = suma(r => r.estado === 'por_validar');
  const evaluables = filas.filter(r => r.clase === 'producto' && r.estado !== 'por_validar');
  const valorEvaluable = evaluables.reduce((s, r) => s + r.valor, 0);
  const consumo = evaluables.reduce((s, r) => s + (r.dias_cobertura > 0 ? r.valor / r.dias_cobertura : 0), 0);
  const r1 = x => Math.round(x * 10) / 10;
  const uds = f => Math.round(filas.reduce((s, r) => s + (f(r) ? (r.stock_actual || 0) : 0), 0));
  return {
    articulos: filas.length,
    unidades: uds(() => true),
    unidades_quietas: uds(esQuieto),
    articulos_quietos: filas.filter(esQuieto).length,
    articulos_por_validar: filas.filter(r => r.estado === 'por_validar').length,
    total: Math.round(total),
    activo: Math.round(suma(r => r.estado === 'activo')),
    lento: Math.round(lento),
    inmovilizado: Math.round(inmovilizado),
    por_validar: Math.round(porValidar),
    quieto: Math.round(lento + inmovilizado),
    pct_quieto: total > 0 ? r1((lento + inmovilizado) / total * 100) : 0,
    pct_inmovilizado: total > 0 ? r1(inmovilizado / total * 100) : 0,
    pct_por_validar: total > 0 ? r1(porValidar / total * 100) : 0,
    dias_cobertura: consumo > 0 ? Math.round(valorEvaluable / consumo) : null,
    valor_evaluable: Math.round(valorEvaluable),
  };
}

module.exports = { resumirInv, esQuieto };
