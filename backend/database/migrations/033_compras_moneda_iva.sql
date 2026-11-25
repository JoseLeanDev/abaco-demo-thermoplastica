-- 033: Moneda en compras y saldo de CxP en moneda original después de la depuración.
--
-- 2026-11-24 Profit corrigió dbo.vstCompras:
--   TotalSinIva = valor del artículo tal como está en Profit (antes venía en TotalConIva y a
--                 TotalSinIva se le volvía a restar el IVA: el IVA se descontaba dos veces).
--   Iva         = IVA del documento repartido entre los artículos.
--   TotalConIva = TotalSinIva + Iva, cuadra con la factura del proveedor.
-- y agregó moneda ('Q' / 'US$' / 'EU'), tasa y montos en moneda original. Igual que en CxC, los
-- montos de siempre ya vienen en Q (convertidos con la tasa de cada documento).
-- Los datos de compras cargados antes de esta fecha tienen las columnas de IVA invertidas:
-- después de aplicar esta migración hay que recargar compras completas desde el ERP.
--
-- vstAnalisisCxP ya publica MONEDA / TASA / [SALDO MONEDA ORIGINAL]. La depuración de CxP
-- (021/022) baja `saldo` en Q pero no tocaba el saldo en moneda original, así que una factura
-- de importación depurada seguía debiendo sus dólares. saldo_moneda_original_neto aplica a la
-- moneda original la misma proporción que la depuración aplicó en Q. Es columna generada: se
-- calcula después del trigger de depuración y no se puede escalar dos veces.
-- Idempotente.

ALTER TABLE raw_thermoplastica.compras_lineas
  ADD COLUMN IF NOT EXISTS moneda                        TEXT,
  ADD COLUMN IF NOT EXISTS tasa                          NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS total_sin_iva_moneda_original NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS total_con_iva_moneda_original NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original         NUMERIC(18,2);

ALTER TABLE thermoplastica.fact_compras_linea
  ADD COLUMN IF NOT EXISTS moneda                        TEXT,
  ADD COLUMN IF NOT EXISTS tasa                          NUMERIC(18,5),
  ADD COLUMN IF NOT EXISTS total_sin_iva_moneda_original NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS total_con_iva_moneda_original NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS saldo_moneda_original         NUMERIC(18,2);

COMMENT ON COLUMN thermoplastica.fact_compras_linea.total_sin_iva IS
  'Valor del artículo en Q sin IVA (vstCompras.TotalSinIva, corregido por Profit el 2026-11-24).';
COMMENT ON COLUMN thermoplastica.fact_compras_linea.moneda IS
  'Moneda del documento de compra en Profit: Q, US$ o EU. Los montos sin sufijo siguen en Q.';

ALTER TABLE thermoplastica.fact_cxp_factura
  ADD COLUMN IF NOT EXISTS saldo_moneda_original_neto NUMERIC(18,2)
  GENERATED ALWAYS AS (
    CASE WHEN saldo_moneda_original IS NULL THEN NULL
         WHEN COALESCE(saldo_erp, 0) <= 0  THEN saldo_moneda_original
         ELSE ROUND(saldo_moneda_original * saldo / saldo_erp, 2)
    END) STORED;

COMMENT ON COLUMN thermoplastica.fact_cxp_factura.moneda IS
  'Moneda de la factura en Profit: Q, US$ o EU. valor y saldo siguen en Q.';
COMMENT ON COLUMN thermoplastica.fact_cxp_factura.saldo_moneda_original_neto IS
  'Saldo en la moneda de la factura después de la depuración de CxP (misma proporción que saldo/saldo_erp).';
