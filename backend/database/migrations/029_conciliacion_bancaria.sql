-- 029: Conciliación bancaria (vista del ERP dbo.vst_ConciliacionBancaria).
--
-- Una fila por movimiento bancario registrado en Profit (lado libros): depósitos, cobros,
-- pagos, órdenes de pago, notas, intereses. La vista NO trae el estado de cuenta del banco:
-- el saldo "según banco" se estima como la suma de los movimientos conciliados.
--
-- Carga: el worker de ingesta (VPS abaco-ingesta-01, conciliacion_bancaria.py) reemplaza la
-- tabla completa todos los días a las 06:00 America/Guatemala (DELETE + COPY en una sola transacción:
-- quien lee nunca la ve vacía). ~68k filas. Llave = id_movimiento (único en el ERP).
--
-- Se guarda tal cual viene del ERP, incluidas fechas mal digitadas (1922, 1932, 2067…):
-- la vista ya las marca con fecha_fuera_de_rango y la página las señala.
-- monto_neto = entrada - salida - idb, en la moneda de la cuenta; 0 si el movimiento está anulado.
-- Idempotente.

CREATE TABLE IF NOT EXISTS thermoplastica.fact_conciliacion_bancaria (
  id_movimiento          INTEGER       PRIMARY KEY,
  rowguid                UUID          NOT NULL,
  cod_cta                TEXT          NOT NULL,
  num_cta                TEXT,
  cod_banco              TEXT,
  banco                  TEXT,
  moneda_cuenta          TEXT,
  moneda                 TEXT,
  tasa                   NUMERIC(18,5),
  co_sucu                TEXT,
  fecha                  DATE          NOT NULL,
  doc_num                TEXT,
  origen                 TEXT,
  modulo_origen          TEXT,
  tipo_op                TEXT,
  tipo_operacion         TEXT,
  forma_pag              TEXT,
  num_documento_origen   INTEGER,
  cod_tercero            TEXT,
  tercero                TEXT,
  concepto               TEXT,
  descripcion            TEXT,
  entrada                NUMERIC(18,2) NOT NULL DEFAULT 0,
  salida                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  idb                    NUMERIC(18,2) NOT NULL DEFAULT 0,
  monto_neto             NUMERIC(20,2) NOT NULL DEFAULT 0,
  anulado                BOOLEAN       NOT NULL DEFAULT FALSE,
  conciliado             BOOLEAN       NOT NULL,
  fecha_conciliacion     DATE,
  estado_conciliacion    TEXT          NOT NULL,
  fecha_fuera_de_rango   BOOLEAN       NOT NULL DEFAULT FALSE,
  moneda_distinta_cuenta BOOLEAN       NOT NULL DEFAULT FALSE,
  sin_documento_origen   BOOLEAN       NOT NULL DEFAULT FALSE,
  fecha_creacion         TIMESTAMP,
  fecha_modificacion     TIMESTAMP,
  batch_id               UUID          NOT NULL,
  cargado_en             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE thermoplastica.fact_conciliacion_bancaria IS
  'Movimientos bancarios de Profit con su estado de conciliación (dbo.vst_ConciliacionBancaria). Reemplazo completo diario 06:00 GT.';
COMMENT ON COLUMN thermoplastica.fact_conciliacion_bancaria.monto_neto IS
  'entrada - salida - idb, en la moneda de la cuenta (moneda_cuenta). 0 si anulado.';
COMMENT ON COLUMN thermoplastica.fact_conciliacion_bancaria.estado_conciliacion IS
  'CONCILIADO | ANULADO | DEPOSITO_EN_TRANSITO | CREDITO_PENDIENTE | DEBITO_PENDIENTE (y CHEQUE_EN_CIRCULACION si el ERP lo usa)';

CREATE INDEX IF NOT EXISTS ix_fact_conc_banc_cuenta_fecha
  ON thermoplastica.fact_conciliacion_bancaria (cod_cta, fecha);
CREATE INDEX IF NOT EXISTS ix_fact_conc_banc_pendientes
  ON thermoplastica.fact_conciliacion_bancaria (cod_cta, fecha)
  WHERE NOT conciliado AND NOT anulado;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agente_ia') THEN
    EXECUTE 'GRANT SELECT ON thermoplastica.fact_conciliacion_bancaria TO agente_ia';
  END IF;
END $$;
