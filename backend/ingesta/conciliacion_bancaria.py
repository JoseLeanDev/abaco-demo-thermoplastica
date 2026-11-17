"""dbo.vst_ConciliacionBancaria -> thermoplastica.fact_conciliacion_bancaria.

Reemplazo completo (~68k filas) en UNA transacción: DELETE + COPY. Quien lee la tabla ve la
foto anterior hasta el COMMIT. Si la extracción viene vacía o falla, se conserva la foto previa.
La llama POST /conciliacion-bancaria del worker (flujo n8n diario 06:00 America/Guatemala).
"""
from __future__ import annotations
import uuid
from datetime import date, datetime

COLS = ["id_movimiento", "rowguid", "cod_cta", "num_cta", "cod_banco", "banco",
        "moneda_cuenta", "moneda", "tasa", "co_sucu", "fecha", "doc_num", "origen",
        "modulo_origen", "tipo_op", "tipo_operacion", "forma_pag", "num_documento_origen",
        "cod_tercero", "tercero", "concepto", "descripcion", "entrada", "salida", "idb",
        "monto_neto", "anulado", "conciliado", "fecha_conciliacion", "estado_conciliacion",
        "fecha_fuera_de_rango", "moneda_distinta_cuenta", "sin_documento_origen",
        "fecha_creacion", "fecha_modificacion"]
TEXTO = {"cod_cta", "num_cta", "cod_banco", "banco", "moneda_cuenta", "moneda", "co_sucu",
         "doc_num", "origen", "modulo_origen", "tipo_op", "tipo_operacion", "forma_pag",
         "cod_tercero", "tercero", "concepto", "descripcion", "estado_conciliacion"}
FECHA = {"fecha", "fecha_conciliacion"}
BOOL = {"anulado", "conciliado", "fecha_fuera_de_rango", "moneda_distinta_cuenta", "sin_documento_origen"}


def _txt(v):
    if v is None: return None
    s = str(v).strip()
    return s or None


def cargar(pg, mssql, log_batch, finish_batch) -> dict:
    batch_id = uuid.uuid4()
    log_batch(pg, batch_id, "vst_ConciliacionBancaria", "fact_conciliacion_bancaria", None, None,
              "foto completa: DELETE + COPY en una transacción")
    pg.commit()
    try:
        cur = mssql.cursor()
        cur.execute("SELECT " + ", ".join(COLS) + " FROM dbo.vst_ConciliacionBancaria")
        filas = []
        for r in cur:
            fila = []
            for c, v in zip(COLS, r):
                if c in TEXTO: v = _txt(v)
                elif c in FECHA: v = v.date() if isinstance(v, datetime) else v
                elif c in BOOL: v = bool(v) if v is not None else False
                elif c == "rowguid": v = str(v)
                elif c in ("entrada", "salida", "idb", "monto_neto") and v is None: v = 0
                fila.append(v)
            filas.append(tuple(fila) + (str(batch_id),))
        if not filas:
            raise RuntimeError("vst_ConciliacionBancaria vino vacía: se conserva la foto previa.")
        with pg.cursor() as p:
            p.execute("DELETE FROM thermoplastica.fact_conciliacion_bancaria")
            with p.copy("COPY thermoplastica.fact_conciliacion_bancaria (" + ", ".join(COLS) +
                        ", batch_id) FROM STDIN") as cp:
                for f in filas: cp.write_row(f)
        finish_batch(pg, batch_id, len(filas))
        pg.commit()
    except Exception as e:
        pg.rollback()
        finish_batch(pg, batch_id, 0, status="failed", error=str(e)[:2000])
        pg.commit()
        raise
    pendientes = sum(1 for f in filas if not f[COLS.index("conciliado")] and not f[COLS.index("anulado")])
    return {"batch_id": str(batch_id), "filas": len(filas), "pendientes": pendientes,
            "fecha_max": str(max(f[COLS.index("fecha")] for f in filas if f[COLS.index("fecha")] <= date.today()))}
