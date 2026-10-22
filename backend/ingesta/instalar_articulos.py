"""Agrega snapshot de tres líneas al /daily y healthcheck existentes, con respaldo."""
from pathlib import Path
from datetime import datetime, timezone
import shutil

root = Path.cwd()
etl, docker = root/'etl.py', root/'Dockerfile'
s, d = etl.read_text(), docker.read_text()
if 'from articulos_snapshot import extraer_y_guardar as extraer_articulos' not in s:
    anchor = '        results["laminados_cpp"] = extraer_y_guardar(pg, mssql)'
    if s.count(anchor) != 1:
        raise SystemExit('No se reconoce la integración de Laminados; no modificar.')
    s = s.replace(anchor, anchor + '\n        from articulos_snapshot import extraer_y_guardar as extraer_articulos\n        results["articulos_cpp"] = extraer_articulos(pg, mssql)')
if 'articulos_cpp_salud' not in s:
    anchor = '        healthy = healthy and cpp_ok'
    if s.count(anchor) != 1:
        raise SystemExit('No se reconoce el healthcheck; no modificar.')
    s = s.replace(anchor, anchor + '''
        cur.execute("""SELECT i.id,EXTRACT(epoch FROM now()-i.extraido_en)/3600,
          i.publicado_en IS NOT NULL FROM thermoplastica.cpp_articulos_importacion i
          ORDER BY id DESC LIMIT 1""")
        art = cur.fetchone()
        articulos_cpp_salud = {"healthy": bool(art and art[1] < 25 and (art[2] or art[1] < 0.25)),
          "importacion_id": art[0] if art else None, "hours_since": float(art[1]) if art else None,
          "publicado": art[2] if art else False}
        healthy = healthy and articulos_cpp_salud["healthy"]''')
    s = s.replace('        "laminados_cpp": laminados_cpp_salud,',
                  '        "laminados_cpp": laminados_cpp_salud,\n        "articulos_cpp": articulos_cpp_salud,')
if 'COPY articulos_snapshot.py' not in d:
    anchor = 'COPY laminados_snapshot.py ./'
    if d.count(anchor) != 1:
        raise SystemExit('Dockerfile no reconocido; no modificar.')
    d = d.replace(anchor, anchor + '\nCOPY articulos_snapshot.py ./')
if s != etl.read_text() or d != docker.read_text():
    backup = root.parent/('respaldo-cpp-articulos-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    backup.mkdir()
    for p in (etl, docker):
        shutil.copy2(p, backup/p.name)
    etl.write_text(s)
    docker.write_text(d)
    print('Respaldo:', backup)
print('Snapshot de artículos integrado al daily y healthcheck existentes.')
