-- 030: Moneda de los documentos de CxC (y CxP cuando el ERP la publique).
--
-- El ERP agregó a vstCuentaPorCobrar y vstAnalisisCxC: moneda ('Q' / 'US$'), tasa del documento
-- y montos en moneda original. Los montos de siempre (saldo_total, valor, saldo, tramos de
-- antigüedad) ya venían convertidos a quetzales con la tasa de cada documento y se mantienen así:
-- todo lo que suma cartera (Posición, Análisis, proyecciones, agente) sigue en Q.
--   saldo_total (Q) = saldo_moneda_original × tasa
-- vstAnalisisCxP todavía NO trae moneda (2026-11-17): las columnas de CxP quedan en NULL hasta que
-- la publiquen; el ETL las toma solo si la vista ya tiene la columna MONEDA.
-- moneda se guarda sin espacios, tal como la escribe Profit: 'Q' o 'US$'.
-- Idempotente.

ALTER TABLE raw_thermoplastica.cxc_estado_actual
  ADD COLUMN IF NOT EXISTS moneda                 TEXT,
  ADD COLUMN IF NOT EXISTS tasa                   NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS monto_moneda_original  NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original  NUMERIC(18,2);

ALTER TABLE raw_thermoplastica.cxc_facturas
  ADD COLUMN IF NOT EXISTS moneda                 TEXT,
  ADD COLUMN IF NOT EXISTS tasa                   NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS valor_moneda_original  NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original  NUMERIC(18,2);

ALTER TABLE raw_thermoplastica.cxp_facturas
  ADD COLUMN IF NOT EXISTS moneda                 TEXT,
  ADD COLUMN IF NOT EXISTS tasa                   NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS valor_moneda_original  NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original  NUMERIC(18,2);

ALTER TABLE thermoplastica.fact_cxc_snapshot_diario
  ADD COLUMN IF NOT EXISTS moneda                 TEXT,
  ADD COLUMN IF NOT EXISTS tasa                   NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS monto_moneda_original  NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original  NUMERIC(18,2);

ALTER TABLE thermoplastica.fact_cxc_factura
  ADD COLUMN IF NOT EXISTS moneda                 TEXT,
  ADD COLUMN IF NOT EXISTS tasa                   NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS valor_moneda_original  NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original  NUMERIC(18,2);

ALTER TABLE thermoplastica.fact_cxp_factura
  ADD COLUMN IF NOT EXISTS moneda                 TEXT,
  ADD COLUMN IF NOT EXISTS tasa                   NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS valor_moneda_original  NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original  NUMERIC(18,2);

COMMENT ON COLUMN thermoplastica.fact_cxc_snapshot_diario.moneda IS
  'Moneda del documento en Profit: Q o US$. saldo_total y tramos siguen en Q (convertidos con tasa).';
COMMENT ON COLUMN thermoplastica.fact_cxc_snapshot_diario.saldo_moneda_original IS
  'Saldo en la moneda del documento (US$ para documentos en dólares). saldo_total = esto × tasa.';
COMMENT ON COLUMN thermoplastica.fact_cxc_factura.moneda IS
  'Moneda de la factura en Profit: Q o US$. valor y saldo siguen en Q.';
COMMENT ON COLUMN thermoplastica.fact_cxp_factura.moneda IS
  'Moneda de la factura (NULL mientras vstAnalisisCxP no publique la columna).';

-- Filtrar por moneda sobre el último corte
CREATE INDEX IF NOT EXISTS idx_cxc_snapshot_fecha_moneda
  ON thermoplastica.fact_cxc_snapshot_diario (fecha_snapshot, moneda);
