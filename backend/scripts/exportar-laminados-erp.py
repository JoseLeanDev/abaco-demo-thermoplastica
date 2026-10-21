"""Exportación de solo lectura. Ejecutar dentro de ingesta-worker, donde existe etl.
No invoca cargas, backfills, populate_facts ni conexiones a Postgres.
"""
import argparse
import json
from datetime import date, datetime, timedelta, timezone

parser = argparse.ArgumentParser()
parser.add_argument('--desde-ventas', required=True, type=date.fromisoformat)
parser.add_argument('--desde-compras', required=True, type=date.fromisoformat)
parser.add_argument('--hasta', required=True, type=date.fromisoformat)
args = parser.parse_args()
if args.desde_ventas > args.hasta or args.desde_compras > args.hasta:
    parser.error('El inicio debe ser anterior al cierre.')

import etl

comunes = """fact_num,fec_emis,TipoDoc AS tipo_doc,CodigoArticulo AS codigo_articulo,
Articulo AS articulo,Linea AS linea,Categoria AS categoria,Sublinea AS sublinea,
Color AS color,Unidades AS unidades,TotalSinIva AS total_sin_iva"""
queries = {
    'compras': ('SELECT ' + comunes + ',Proveedor AS proveedor FROM dbo.vstCompras '
                'WHERE fec_emis >= %s AND fec_emis < %s', args.desde_compras),
    'ventas': ('SELECT ' + comunes + ",Cliente AS cliente,CodigoCliente AS codigo_cliente,"
               'NombreVendedor AS nombre_vendedor,CodigoVendedor AS codigo_vendedor,co_sucu, '
               'CostoPromedioFacturado AS costo_promedio_facturado,CostoUltimoFacturado AS costo_ultimo_facturado '
               'FROM dbo.vstFacturas_Devoluciones WHERE fec_emis >= %s AND fec_emis < %s '
               "AND LTRIM(RTRIM(Linea)) IN ('Laminados','Almacén General','Flexografía')", args.desde_ventas),
}
connection = etl.mssql_conn()
try:
    output = {'metadata': {'fuente': 'SQL Server TP_A', 'extraido_en': datetime.now(timezone.utc).isoformat(),
                           'desde_ventas': str(args.desde_ventas), 'desde_compras': str(args.desde_compras), 'hasta': str(args.hasta)}}
    for nombre, (sql, desde) in queries.items():
        cursor = connection.cursor(as_dict=True)
        cursor.execute(sql, (desde, args.hasta + timedelta(days=1)))
        output[nombre] = cursor.fetchall()
    print(json.dumps(output, ensure_ascii=False, default=str))
finally:
    connection.rollback()
    connection.close()
