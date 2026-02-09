import sqlite3

db = sqlite3.connect('databasepnda.db')
c = db.cursor()

# Vérifier les migrations déjà appliquées
print('=== Migrations déjà appliquées ===')
migrations = c.execute("SELECT filename, applied_at FROM schema_migrations ORDER BY id").fetchall()
for m in migrations:
    print(f'{m[0]:40} {m[1]}')

# Marquer la migration 001 comme appliquée (elle échoue car users_unified existe déjà)
print('\n=== Marquage migration 001 comme appliquée ===')
try:
    c.execute("INSERT INTO schema_migrations (filename) VALUES (?)", ('001_merge_users_personnel.sql',))
    db.commit()
    print('✅ Migration 001 marquée comme appliquée')
except sqlite3.IntegrityError:
    print('⚠️  Migration 001 déjà marquée')

# Créer la table refresh_tokens si elle n'existe pas
print('\n=== Création table refresh_tokens ===')
c.execute("""
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  replaced_by TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
""")

c.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)")
c.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)")

db.commit()
print('✅ Table refresh_tokens créée')

# Marquer la migration 003 comme appliquée
print('\n=== Marquage migration 003 comme appliquée ===')
try:
    c.execute("INSERT INTO schema_migrations (filename) VALUES (?)", ('003_refresh_tokens.sql',))
    db.commit()
    print('✅ Migration 003 marquée comme appliquée')
except sqlite3.IntegrityError:
    print('⚠️  Migration 003 déjà marquée')

# Vérifier
print('\n=== Vérification finale ===')
tables = c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='refresh_tokens'").fetchone()
print(f'refresh_tokens existe: {bool(tables)}')

db.close()
