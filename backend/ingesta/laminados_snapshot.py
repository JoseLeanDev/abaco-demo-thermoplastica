"""Extracción completa focalizada. Se llama al final del /daily existente.
No publica resultados parciales ni modifica raw/facts de otras líneas.
"""
import json
from datetime import date, datetime
from decimal import Decimal


def extraer_y_guardar(pg, mssql):
    desde_ventas, desde_compras, hasta = date(2024, 1, 1), date(2023, 1, 1), date.today()
    comunes = '''fact_num,saldo,co_sucu,Sucursal AS sucursal,fec_emis,
      CodigoArticulo AS codigo_articulo,Articulo AS articulo,Unidades AS unidades,
      UnidadesDev AS unidades_dev,TotalSinIva AS total_sin_iva,TotalSinIvaDev AS total_sin_iva_dev,
      TotalConIva AS total_con_iva,TotalConIvaDev AS total_con_iva_dev,Iva AS iva,IvaDev AS iva_dev,
      Categoria AS categoria,Linea AS linea,Color AS color,Sublinea AS sublinea,
      TipoDoc AS tipo_doc,CostoPromedioFacturado AS costo_promedio_facturado,
      CostoUltimoFacturado AS costo_ultimo_facturado'''
    cur = mssql.cursor(as_dict=True)
    cur.execute('SELECT ' + comunes + ''',FEL AS fel,CodigoCliente AS codigo_cliente,
      Cliente AS cliente,NombreVendedor AS nombre_vendedor,CodigoVendedor AS codigo_vendedor,
      [Tipo Cliente] AS tipo_cliente_desc,TipoCliente AS tipo_cliente
      FROM dbo.vstFacturas_Devoluciones WHERE fec_emis >= %s AND fec_emis < DATEADD(day,1,%s)
      AND LTRIM(RTRIM(Linea))='Laminados' ''', (desde_ventas, hasta))
    ventas = cur.fetchall()
    if not ventas:
        raise RuntimeError('Extracción vacía de Laminados: se conserva la publicación previa.')
    categorias = sorted({str(r['categoria'] or '').strip() for r in ventas})
    cur.execute('SELECT ' + comunes + ''',Proveedor AS proveedor FROM dbo.vstCompras
      WHERE fec_emis >= %s AND fec_emis < DATEADD(day,1,%s)
      AND LTRIM(RTRIM(COALESCE(Categoria,''))) IN (''' + ','.join(['%s'] * len(categorias)) + ')',
      (desde_compras, hasta, *categorias))
    compras = cur.fetchall()
    if not compras:
        raise RuntimeError('Compras vacías: se conserva la publicación previa.')
    def serializar(v):
        if isinstance(v, (date, datetime)): return v.isoformat()[:10]
        if isinstance(v, Decimal): return str(v)
        raise TypeError(type(v).__name__)
    with pg.cursor() as p:
        p.execute('''INSERT INTO thermoplastica.cpp_laminados_importacion
          (desde_ventas,desde_compras,hasta,ventas,compras) VALUES(%s,%s,%s,%s::jsonb,%s::jsonb) RETURNING id''',
          (desde_ventas, desde_compras, hasta, json.dumps(ventas, default=serializar), json.dumps(compras, default=serializar)))
        id_ = p.fetchone()[0]
    pg.commit()
    return {'importacion_id': id_, 'ventas': len(ventas), 'compras': len(compras), 'desde_ventas': str(desde_ventas), 'desde_compras': str(desde_compras), 'hasta': str(hasta)}
