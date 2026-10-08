"""Exports the previous local test database without password/session data."""
import sqlite3,sys,json
from pathlib import Path
if len(sys.argv)!=2:raise SystemExit('Uso: python scripts/exportar_sqlite.py CAMINHO_DO_BANCO')
path=Path(sys.argv[1]).resolve()
if not path.is_file():raise SystemExit('Banco não encontrado.')
db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
rows=db.execute('SELECT v.*,u.name,u.role FROM visits v JOIN users u ON u.id=v.user_id')
result=[{'id':r['id'],'code':r['code'],'date':r['date'],'note':r['note'],'author':('Regional ' if r['role']=='regional' else '')+r['name'],'deletedAt':r['deleted_at'],'deletedReason':r['deleted_reason'],'deletedNote':r['deleted_note'],'deletedBy':r['deleted_by']} for r in rows]
print(json.dumps(result,ensure_ascii=False));db.close()
