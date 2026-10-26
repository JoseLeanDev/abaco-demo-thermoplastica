import { useMemo } from 'react'
import { ExclamationTriangleIcon, LightBulbIcon, Squares2X2Icon, TableCellsIcon } from '@heroicons/react/24/outline'
import { Seccion, fmtInt, fmtM, td, th } from '../compras/comun'
import { ABCS, TRAMOS, fmtDias, resumir } from './datos'
import { colorDias } from './TabResumen'

// Análisis ABC por salida del período (Pareto) cruzado con la cobertura del stock.
export default function TabAbc({ filas, tot, dias, objetivo, setAbc, irDetalle }) {
  const clases = useMemo(() => {
    const totalSkus = filas.length || 1
    return ABCS.map(a => {
      const rs = filas.filter(f => f.abc === a.id)
      const r = resumir(rs, dias, objetivo)
      return {
        ...a, ...r,
        pct_skus: Math.round(rs.length / totalSkus * 1000) / 10,
        pct_salida: tot.salida > 0 ? Math.round(r.salida / tot.salida * 1000) / 10 : 0,
        pct_valor: tot.valor > 0 ? Math.round(r.valor / tot.valor * 1000) / 10 : 0,
      }
    })
  }, [filas, tot, dias, objetivo])

  // Matriz ABC × cobertura (valor en stock)
  const matriz = useMemo(() => {
    const m = {}
    for (const f of filas) {
      if (!f.tramo) continue
      const k = `${f.abc}|${f.tramo}`
      m[k] = m[k] || { valor: 0, skus: 0 }
      m[k].valor += f.valor
      m[k].skus++
    }
    return m
  }, [filas])
  const maxCelda = Math.max(1, ...Object.values(matriz).map(c => c.valor))

  // Listas de acción
  const aEnRiesgo = useMemo(() => filas
    .filter(f => f.abc === 'A' && (f.quiebre || (f.dias_cobertura !== null && f.dias_cobertura < 30)))
    .sort((a, b) => b.salida - a.salida).slice(0, 10), [filas])
  const colaPesada = useMemo(() => filas
    .filter(f => (f.abc === 'C' || f.abc === 'N') && f.valor > 0)
    .sort((a, b) => b.valor - a.valor).slice(0, 10), [filas])

  const A = clases[0], C = clases[2], N = clases[3]
  const colaValor = C.valor + N.valor
  const colaSkus = C.skus + N.skus

  return (
    <div className="space-y-6">
      {tot.salida > 0 && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex items-start gap-3">
          <LightBulbIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">{fmtInt(A.articulos)} artículos A</strong> ({A.pct_skus}% de los SKUs) generan el {A.pct_salida}% de la salida
            y ocupan {fmtM(A.valor)} ({A.pct_valor}%) del stock.
            {' '}Los artículos C y sin salida son {fmtInt(colaSkus)} SKUs con stock que retienen <strong className="text-[var(--text-primary)]">{fmtM(colaValor)}</strong>
            {' '}({tot.valor > 0 ? Math.round(colaValor / tot.valor * 100) : 0}% del inventario) y mueven apenas el {Math.round((C.pct_salida + N.pct_salida) * 10) / 10}% de la salida:
            ahí está el capital a liberar. En los A, el riesgo es quedarse sin stock.
          </p>
        </div>
      )}

      <Seccion icon={Squares2X2Icon} titulo="Clasificación ABC" leyenda="inv_abc" subtitulo="Por valor de salida del período (costo de ventas o consumo de materia prima)" sinPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
              <tr>
                <th className={`${th} text-left`}>Clase</th>
                <th className={`${th} text-right`}>Artículos</th>
                <th className={`${th} text-right`}>Salida del período</th>
                <th className={`${th} text-right`}>Valor en stock</th>
                <th className={`${th} text-right`}>Días inv.</th>
                <th className={`${th} text-right`}>Exceso</th>
                <th className={`${th} text-right`}>Quiebres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {clases.map(c => (
                <tr key={c.id} onClick={() => setAbc(c.id)} className="hover:bg-[var(--bg-secondary)] cursor-pointer" title="Filtrar toda la página por esta clase">
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                      <span className="font-semibold">{c.label}</span>
                      <span className="text-xs text-[var(--text-muted)]">{c.desc}</span>
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(c.articulos)} <span className="text-xs text-[var(--text-muted)]">· {c.pct_skus}%</span></td>
                  <td className={`${td} text-right tabular-nums`}>
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium">{fmtM(c.salida)}</span>
                      <span className="text-xs text-[var(--text-muted)] w-10">{c.pct_salida}%</span>
                    </div>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium">{fmtM(c.valor)}</span>
                      <span className="text-xs text-[var(--text-muted)] w-10">{c.pct_valor}%</span>
                    </div>
                  </td>
                  <td className={`${td} text-right tabular-nums font-medium ${colorDias(c.dias_inventario)}`}>{fmtDias(c.dias_inventario)}</td>
                  <td className={`${td} text-right tabular-nums`}>{c.exceso > 0 ? fmtM(c.exceso) : '—'}</td>
                  <td className={`${td} text-right tabular-nums ${c.quiebres > 0 ? 'text-[var(--danger)] font-semibold' : 'text-[var(--text-muted)]'}`}>{c.quiebres || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Peso en salida vs peso en stock */}
        <div className="p-5 space-y-2">
          {[['Salida', 'pct_salida'], ['Stock', 'pct_valor'], ['Artículos', 'pct_skus']].map(([label, k]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)] w-16">{label}</span>
              <div className="flex-1 h-4 rounded overflow-hidden flex bg-[var(--bg-tertiary)]">
                {clases.map(c => c[k] > 0 && (
                  <div key={c.id} style={{ width: `${c[k]}%`, background: c.color }} className="h-full text-[9px] text-white flex items-center justify-center overflow-hidden" title={`${c.label}: ${c[k]}%`}>
                    {c[k] >= 8 ? `${c.id === 'N' ? 'S/s' : c.id} ${Math.round(c[k])}%` : ''}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion icon={TableCellsIcon} titulo="Matriz ABC × cobertura" leyenda="inv_matriz_abc" subtitulo="Valor en stock. Lo sano: A con poca cobertura, nada de C o sin salida con mucha. Clic en una celda para ver los artículos." sinPadding>
        <div className="overflow-x-auto p-5 pt-2">
          <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th className="text-left text-xs text-[var(--text-muted)] font-semibold w-24" />
                {TRAMOS.map(t => <th key={t.id} className="text-xs text-[var(--text-muted)] font-semibold whitespace-nowrap px-1">{t.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {ABCS.map(a => (
                <tr key={a.id}>
                  <td className="text-xs font-semibold whitespace-nowrap pr-2">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: a.color }} />{a.label}</span>
                  </td>
                  {TRAMOS.map(t => {
                    const c = matriz[`${a.id}|${t.id}`]
                    // Alerta: A sin cobertura (riesgo) o C/N con mucha cobertura (exceso)
                    const mala = c && ((a.id === 'A' && t.id === 't30') || ((a.id === 'C' || a.id === 'N') && ['t365', 'tmas', 'tsin'].includes(t.id)))
                    const alpha = c ? 0.08 + 0.72 * Math.sqrt(c.valor / maxCelda) : 0
                    return (
                      <td key={t.id} className="p-0">
                        <button
                          disabled={!c}
                          onClick={() => { setAbc(a.id); irDetalle({ tramo: t.id }) }}
                          className={`w-full rounded px-2 py-2 text-center tabular-nums transition-transform ${c ? 'hover:scale-[1.03]' : 'cursor-default'} ${mala ? 'ring-2 ring-rose-400' : ''}`}
                          style={{ background: c ? `rgba(0, 22, 57, ${alpha})` : 'var(--bg-secondary)', color: alpha > 0.45 ? '#fff' : 'var(--text-primary)' }}
                        >
                          {c ? (
                            <>
                              <span className="block text-xs font-semibold">{fmtM(c.valor)}</span>
                              <span className={`block text-[10px] ${alpha > 0.45 ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{fmtInt(c.skus)} SKUs</span>
                            </>
                          ) : <span className="text-[10px] text-[var(--text-muted)]">—</span>}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListaCorta
          icon={ExclamationTriangleIcon}
          titulo="Artículos A en riesgo"
          subtitulo="Clase A sin stock o con menos de 30 días de cobertura"
          filas={aEnRiesgo}
          vacio="Ningún artículo A está por quedarse sin stock."
          dias={dias}
          col={(f) => (f.quiebre || f.valor <= 0
            ? <span className="text-[var(--danger)] font-semibold">sin stock</span>
            : <span className="text-[var(--warning)] font-semibold">{fmtDias(f.dias_cobertura)}</span>)}
          colTitulo="Cobertura"
        />
        <ListaCorta
          icon={Squares2X2Icon}
          titulo="Cola pesada: C y sin salida con más stock"
          subtitulo="Candidatos a liquidar, devolver al proveedor o dejar de reponer"
          filas={colaPesada}
          vacio="No hay artículos C o sin salida con stock."
          dias={dias}
          col={(f) => <span className="font-semibold">{fmtM(f.valor)}</span>}
          colTitulo="Valor"
        />
      </div>
    </div>
  )
}

function ListaCorta({ icon, titulo, subtitulo, filas, vacio, col, colTitulo, dias }) {
  return (
    <Seccion icon={icon} titulo={titulo} subtitulo={subtitulo} sinPadding>
      {filas.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-[var(--text-muted)]">{vacio}</p>
      ) : (
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
            <tr>
              <th className={`${th} text-left`}>Artículo</th>
              <th className={`${th} text-right`}>Salida/mes</th>
              <th className={`${th} text-right`}>{colTitulo}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {filas.map(f => (
              <tr key={f.codigo} className="hover:bg-[var(--bg-secondary)]">
                <td className={`${td} max-w-[260px]`}>
                  <p className="font-medium nombre-articulo">{f.descripcion}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{f.codigo} · {f.subcategoria}</p>
                </td>
                <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{f.salida > 0 ? fmtM(f.salida / dias * 30) : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{col(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  )
}
