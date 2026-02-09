import sqlite3
import os

print('DB exists:', os.path.exists('adiutorai.db'))
conn = sqlite3.connect('adiutorai.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='courriers_sortants'")
tables = c.fetchall()
print('Table exists:', len(tables) > 0)
if tables:
    c.execute('PRAGMA table_info(courriers_sortants)')
    cols = c.fetchall()
    print('Columns:', [col[1] for col in cols])
conn.close()