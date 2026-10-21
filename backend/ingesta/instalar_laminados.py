"""Parche idempotente al worker existente. Ejecutar en su carpeta, antes de build.
Conserva la versión anterior fuera del checkout para reversión.
"""
from pathlib import Path
from datetime import datetime, timezone
import shutil
root=Path.cwd()
etl=root/'etl.py'
docker=root/'Dockerfile'
if not etl.exists() or not docker.exists(): raise SystemExit('Ejecutar en la carpeta del worker.')
s=etl.read_text()
if 'from laminados_snapshot import extraer_y_guardar' not in s:
    anchor='        populate_facts(pg)\n    results["elapsed_seconds"]'
    inicio=s.index('def run_daily()')
    if s[inicio:].count(anchor)!=1: raise SystemExit('La versión de run_daily cambió; revisar el parche.')
    backup=root.parent/('respaldo-cpp-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    backup.mkdir()
    for f in [etl,docker]: shutil.copy2(f,backup/f.name)
    prefijo=s[:inicio]
    s=prefijo+s[inicio:].replace(anchor,'''        populate_facts(pg)
        # Foto completa focalizada: el ERP sí cambia documentos históricos.
        from laminados_snapshot import extraer_y_guardar
        results["laminados_cpp"] = extraer_y_guardar(pg, mssql)
    results["elapsed_seconds"]''')
    etl.write_text(s)
    print('Respaldo:',backup)
# El healthcheck existente también vigila extracción/publicación de CPP.
s=etl.read_text()
if 'laminados_cpp_salud' not in s:
    anchor='        db_size = cur.fetchone()[0]'
    if s.count(anchor)!=1: raise SystemExit('No se reconoce run_healthcheck.')
    s=s.replace(anchor,anchor+'''
        cur.execute("""SELECT i.id, i.extraido_en,
          EXTRACT(epoch FROM now()-i.extraido_en)/3600 AS horas,
          i.publicado_en IS NOT NULL AS publicado
          FROM thermoplastica.cpp_laminados_importacion i ORDER BY id DESC LIMIT 1""")
        cpp = cur.fetchone()
        cpp_ok = bool(cpp and cpp[2] < 25 and (cpp[3] or cpp[2] < 0.25))
        laminados_cpp_salud = {"healthy": cpp_ok, "importacion_id": cpp[0] if cpp else None,
          "hours_since": float(cpp[2]) if cpp else None, "publicado": cpp[3] if cpp else False}
        healthy = healthy and cpp_ok''')
    s=s.replace('        "overall_healthy": healthy,','        "overall_healthy": healthy,\n        "laminados_cpp": laminados_cpp_salud,')
    etl.write_text(s)
d=docker.read_text()
if 'COPY laminados_snapshot.py' not in d:
    docker.write_text(d.replace('COPY etl.py worker.py ./','COPY etl.py worker.py ./\nCOPY laminados_snapshot.py ./'))
print('Worker preparado: snapshot Laminados al finalizar /daily, dentro del mismo lock.')
