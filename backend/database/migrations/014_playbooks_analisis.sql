-- ============================================================================
-- 014_playbooks_analisis.sql
--
-- Playbooks del analista diario: cada fila es una vertical del negocio con las
-- instrucciones preescritas que el agente ejecuta cada dia. El cron
-- (scripts/correr-playbooks.js) lee las filas activas, corre el agente analista
-- (src/services/agenteAnalista.js) sobre las vistas de analitica, y escribe los
-- hallazgos en insights_historico (la misma tabla que ya muestra el dashboard).
--
-- El prompt guardado aqui es SOLO la parte especifica de la vertical. Las reglas
-- comunes (rol, no rellenar, GTQ, no inventar bancos/SAT, formato de salida) las
-- antepone el runner desde codigo, porque cambian poco y aplican a las cuatro.
--
-- Editar un prompt en esta tabla NO requiere redeploy: el cron lee el valor
-- vigente en cada corrida. El seed usa ON CONFLICT DO NOTHING, asi que reaplicar
-- la migracion no pisa ediciones hechas en la base.
--
-- Idempotente. No modifica datos del ERP.
-- ============================================================================

CREATE TABLE IF NOT EXISTS analisis_playbooks (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(50) UNIQUE NOT NULL,
  nombre        VARCHAR(120) NOT NULL,
  vertical      VARCHAR(50)  NOT NULL,
  prompt        TEXT         NOT NULL,
  max_insights  INTEGER      NOT NULL DEFAULT 4,
  orden         INTEGER      NOT NULL DEFAULT 0,
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP    DEFAULT NOW(),
  updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_activo ON analisis_playbooks(activo);

-- ---------------------------------------------------------------------------
-- Seed de las 4 verticales aprobadas. Solo el cuerpo especifico de cada una.
-- ---------------------------------------------------------------------------

INSERT INTO analisis_playbooks (slug, nombre, vertical, orden, prompt) VALUES
(
  'cartera', 'Cartera y cobranza', 'cartera', 1,
$prompt$Analiza la cartera por cobrar (vistas v_cxc). Recuerda: filtra saldo > 0 para lo pendiente (la mayoria de facturas ya estan CANCELADA). Cubre estos angulos y quedate con los de mayor impacto:

- Cartera pendiente total (sum(saldo) where saldo>0) y que % esta VENCIDA vs corriente. Si el % vencido es alto, es alerta.
- Los clientes con mas saldo vencido, sobre todo en buckets 61-90 y 90+: nombralos y di cuanto deben y hace cuantos dias.
- Facturas individuales grandes y vencidas que urge cobrar ya (di factura_num, cliente, monto, dias vencido).
- Concentracion de riesgo de credito: que % de la cartera pendiente esta en los 3-5 clientes mas grandes; menciona el sector (sector_cliente) si concentra.
- Deterioro: saldo que ya cruzo a 90+ (riesgo de incobrable).$prompt$
),
(
  'ventas', 'Ventas y crecimiento', 'ventas', 2,
$prompt$Analiza el desempeno de ventas. Usa v_ventas_mensuales para tendencia larga (desde ene-2024) y v_ventas para el detalle por cliente/vendedor. Cubre estos angulos y quedate con los de mayor impacto:

- Ventas del ultimo mes cerrado vs el mes anterior y vs el mismo mes del ano pasado (% de cambio). Crece o cae el negocio?
- Que lineas o categorias de producto estan creciendo o cayendo mas (cambio de mix): nombralas con su variacion.
- Top clientes por venta y su variacion reciente. Senala clientes grandes que estan comprando MENOS que antes (riesgo de fuga) - eso es alerta.
- Concentracion: que % de las ventas esta en el top 5 de clientes y en la linea principal. Alta dependencia = riesgo.
- Desempeno de vendedores: quien destaca y quien viene cayendo.$prompt$
),
(
  'margenes', 'Margenes y rentabilidad', 'margenes', 3,
$prompt$Analiza la rentabilidad (vista v_ventas). Regla clave: el margen % de cualquier grupo es sum(margen_bruto)/sum(ventas)*100, NUNCA el promedio de margen_bruto_pct. Cubre estos angulos y quedate con los de mayor impacto:

- Margen bruto global (GTQ y %) del ultimo mes y su tendencia vs meses previos. Se esta erosionando el margen?
- Clientes o lineas de ALTO VOLUMEN pero BAJO MARGEN: mucha venta que deja poco. Son la mayor oportunidad de repricing - nombralos con su venta y su margen %.
- Productos/articulos vendidos con margen negativo o muy bajo (estamos perdiendo o casi): nombralos.
- Donde estan los MEJORES margenes (cliente/linea/producto) para empujar ahi.
- Compara margen entre tipo_cliente (INDUSTRIA vs Clientes Almacen).$prompt$
),
(
  'compras', 'Compras y pagos', 'compras', 4,
$prompt$Analiza compras a proveedores y las cuentas por pagar (vistas v_compras y v_cxp). Para lo pendiente de pagar filtra saldo > 0 en v_cxp. Cubre estos angulos y quedate con los de mayor impacto:

- Compras del ultimo mes vs el anterior y en que proveedores subio mas el gasto.
- Concentracion de proveedores: que % de las compras depende de los 3 mas grandes (riesgo de suministro/negociacion). Nombralos.
- Cuentas por pagar pendientes (sum(saldo) where saldo>0) y que vence pronto (dias_para_vencer <= 15): lista lo que hay que pagar para cuidar liquidez.
- Facturas de proveedor YA vencidas (esta_vencida): riesgo de recargos o de danar la relacion. Nombralas.
- Evolucion del gasto operativo (es_gasto_operativo = true) vs compra de mercaderia: esta subiendo el gasto que no es inventario?$prompt$
)
ON CONFLICT (slug) DO NOTHING;
