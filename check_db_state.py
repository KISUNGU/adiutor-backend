import sqlite3

db = sqlite3.connect('databasepnda.db')
c = db.cursor()

print('=== TABLES ===')
tables = c.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name").fetchall()
for t in tables:
    print(f'{t[1]:5} {t[0]}')

print('\n=== users_unified ===')
info = c.execute("SELECT sql FROM sqlite_master WHERE name='users_unified'").fetchone()
print(info[0] if info else 'NOT FOUND')

print('\n=== refresh_tokens ===')
info = c.execute("SELECT sql FROM sqlite_master WHERE name='refresh_tokens'").fetchone()
print(info[0] if info else 'NOT FOUND')

db.close()
