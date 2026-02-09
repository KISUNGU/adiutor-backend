import sqlite3

db = sqlite3.connect('databasepnda.db')
c = db.cursor()

try:
    c.execute("INSERT INTO schema_migrations (filename) VALUES ('002_consolidate_archives.sql')")
    db.commit()
    print('✅ Migration 002 marquée comme appliquée')
except sqlite3.IntegrityError:
    print('⚠️  Migration 002 déjà marquée')

db.close()
