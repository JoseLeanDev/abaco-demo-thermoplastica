// Las compras no son salidas. Sin trazabilidad de consumo no hay exceso medible.
export const excesoDe = (f, dias, objetivo) =>
  f.clase !== 'producto' || f.estado === 'por_validar'
    ? null
    : f.valor > 0 ? Math.max(0, f.valor - (f.salida / dias) * objetivo) : 0

export function resumir(rs, dias, objetivo) {
  let valor = 0, transito = 0, cogs = 0, salida = 0, inmovilizado = 0, lento = 0, por_validar = 0
  let exceso = 0, skus = 0, skus_evaluables = 0, valorEvaluable = 0, quiebres = 0, salidaQuiebres = 0, skusExceso = 0
  for (const f of rs) {
    valor += f.valor
    transito += f.valor_transito
    if (f.valor > 0) skus++
    if (f.estado === 'por_validar') por_validar += f.valor
    if (f.estado === 'lento') lento += f.valor
    if (f.estado === 'inmovilizado') inmovilizado += f.valor
    if (f.clase !== 'producto' || f.estado === 'por_validar') continue
    cogs += f.cogs
    salida += f.salida || 0
    valorEvaluable += f.valor
    if (f.valor > 0) skus_evaluables++
    const e = excesoDe(f, dias, objetivo)
    exceso += e
    if (e > 0) skusExceso++
    if (f.quiebre) { quiebres++; salidaQuiebres += f.salida }
  }
  const quieto = lento + inmovilizado
  const diasInv = cogs > 0 && valorEvaluable > 0 ? Math.round(valorEvaluable / (cogs / dias)) : null
  return {
    articulos: rs.length, skus, skus_evaluables, valor, transito, cogs, consumo: null, salida,
    base: cogs > 0 ? 'costo_ventas' : null,
    dias_inventario: diasInv,
    rotacion: diasInv ? Math.round(365 / diasInv * 10) / 10 : null,
    lento, inmovilizado, quieto, por_validar,
    pct_quieto: valor > 0 ? Math.round(quieto / valor * 1000) / 10 : 0,
    exceso, skus_exceso: skusExceso,
    pct_exceso: valor > 0 ? Math.round(exceso / valor * 1000) / 10 : 0,
    quiebres, salida_quiebres: salidaQuiebres,
  }
}
