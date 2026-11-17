-- Estadísticas para el filtro de producto (Categoría › Subcategoría › Sublínea).
--
-- Las pantallas filtran con expresiones como
--   COALESCE(NULLIF(TRIM(a.marca), ''), 'Sin categoría') = $1
-- (helper `limpio` en routes/ventas, margenes, compras, inventario, analisis).
-- Postgres no tiene estadísticas de esas expresiones: estimaba 47 artículos por
-- categoría y 1 artículo con categoría + subcategoría (Liners › Inducción tiene
-- 2,335). Con esa estimación elegía nested loops que recalculan v_ventas_costeadas
-- por cada artículo y Ventas / Márgenes pasaban de 90 s al bajar de nivel.
--
-- Con estadísticas sobre las mismas expresiones (y su correlación, mcv) estima bien
-- cada nivel y la combinación. Deben coincidir EXACTAMENTE con el texto del helper
-- `limpio`: si se cambia el helper o el texto de "Sin ...", actualizar esto.
-- Se recalculan solas con cada ANALYZE (autovacuum) de dim_articulo.

CREATE STATISTICS IF NOT EXISTS thermoplastica.st_dim_articulo_jerarquia (mcv)
ON (COALESCE(NULLIF(TRIM(marca), ''), 'Sin categoría')),
   (COALESCE(NULLIF(TRIM(linea), ''), 'Sin subcategoría')),
   (COALESCE(NULLIF(TRIM(sublinea), ''), 'Sin sublínea'))
FROM thermoplastica.dim_articulo;

ALTER STATISTICS thermoplastica.st_dim_articulo_jerarquia SET STATISTICS 1000;

ANALYZE thermoplastica.dim_articulo;
