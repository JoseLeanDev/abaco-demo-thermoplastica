"""Foto completa de productos terminados: ventas y compras de sus propios SKUs.
La lectura nunca convierte millares a piezas ni cambia costos del ERP.
"""
import json
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

LINEAS = ('Empaques para alimentos', 'Tapas y Valvulas', 'Inyectables')
LINEAS_ERP = (*LINEAS, 'tpFood')
COMUNES = '''fact_num,saldo,co_sucu,Sucursal AS sucursal,fec_emis,
  CodigoArticulo AS codigo_articulo,Articulo AS articulo,Unidades AS unidades,
  UnidadesDev AS unidades_dev,TotalSinIva AS total_sin_iva,TotalSinIvaDev AS total_sin_iva_dev,
  TotalConIva AS total_con_iva,TotalConIvaDev AS total_con_iva_dev,Iva AS iva,IvaDev AS iva_dev,
  Categoria AS categoria,Linea AS linea,Color AS color,Sublinea AS sublinea,
  TipoDoc AS tipo_doc,CostoPromedioFacturado AS costo_promedio_facturado,
  CostoUltimoFacturado AS costo_ultimo_facturado'''


def serializar(v):
    if isinstance(v, (date, datetime)):
        return v.isoformat()[:10]
    if isinstance(v, Decimal):
        return str(v)
    raise TypeError(type(v).__name__)


def extraer(mssql):
    desde_ventas = date(2024, 1, 1)
    hasta = datetime.now(ZoneInfo('America/Guatemala')).date()
    cur = mssql.cursor(as_dict=True)
    cur.execute('SELECT ' + COMUNES + ''',FEL AS fel,CodigoCliente AS codigo_cliente,
      Cliente AS cliente,NombreVendedor AS nombre_vendedor,CodigoVendedor AS codigo_vendedor,
      [Tipo Cliente] AS tipo_cliente_desc,TipoCliente AS tipo_cliente
      FROM dbo.vstFacturas_Devoluciones
      WHERE fec_emis >= %s AND fec_emis < DATEADD(day,1,%s)
      AND LTRIM(RTRIM(Linea)) IN (%s,%s,%s,%s)''', (desde_ventas, hasta, *LINEAS_ERP))
    ventas = cur.fetchall()
    for r in ventas:
        r['linea_erp_original'] = str(r['linea'] or '').strip()
        if r['linea_erp_original'] == 'tpFood':
            r['linea'] = 'Empaques para alimentos'
    if any(not any(str(r['linea'] or '').strip() == l for r in ventas) for l in LINEAS):
        raise RuntimeError('Falta una línea comercial en la extracción: no publicar carga parcial.')
    codigos = sorted({str(r['codigo_articulo'] or '').strip() for r in ventas})
    if not codigos or not all(codigos):
        raise RuntimeError('Venta sin código de artículo: conservar carga anterior.')
    compras = []
    # Sin límite A-1: incluye compras propias antiguas aunque cambió la línea.
    for i in range(0, len(codigos), 500):
        bloque = codigos[i:i + 500]
        cur.execute('SELECT ' + COMUNES + ''',Proveedor AS proveedor FROM dbo.vstCompras
          WHERE fec_emis >= %s AND fec_emis < DATEADD(day,1,%s)
          AND LTRIM(RTRIM(CodigoArticulo)) IN (''' + ','.join(['%s'] * len(bloque)) + ')',
          (date(1900, 1, 1), hasta, *bloque))
        compras.extend(cur.fetchall())
    if not compras:
        raise RuntimeError('Compras propias vacías: conservar carga anterior.')
    return dict(desde_ventas=desde_ventas,
                desde_compras=min(r['fec_emis'].date() if isinstance(r['fec_emis'], datetime)
                                  else r['fec_emis'] for r in compras),
                hasta=hasta, ventas=ventas, compras=compras)


def guardar(pg, datos):
    with pg.cursor() as p:
        p.execute('''INSERT INTO thermoplastica.cpp_articulos_importacion
          (desde_ventas,desde_compras,hasta,ventas,compras)
          VALUES(%s,%s,%s,%s::jsonb,%s::jsonb) RETURNING id''',
          (datos['desde_ventas'], datos['desde_compras'], datos['hasta'],
           json.dumps(datos['ventas'], default=serializar),
           json.dumps(datos['compras'], default=serializar)))
        id_ = p.fetchone()[0]
    pg.commit()
    return dict(importacion_id=id_, ventas=len(datos['ventas']), compras=len(datos['compras']),
                desde_ventas=str(datos['desde_ventas']), desde_compras=str(datos['desde_compras']),
                hasta=str(datos['hasta']))


def extraer_y_guardar(pg, mssql):
    return guardar(pg, extraer(mssql))


if __name__ == '__main__':
    # Diagnóstico desde el contenedor existente: solamente lee SQL Server.
    import etl
    db = etl.mssql_conn()
    try:
        print(json.dumps(extraer(db), ensure_ascii=False, default=serializar))
    finally:
        db.rollback()
        db.close()
