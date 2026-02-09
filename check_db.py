import sqlite3

conn = sqlite3.connect('databasepnda.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='courriers_sortants'")
tables = c.fetchall()
print('Table exists:', len(tables) > 0)
if tables:
    c.execute('SELECT COUNT(*) FROM courriers_sortants')
    count = c.fetchone()[0]
    print('Rows:', count)
    c.execute('PRAGMA table_info(courriers_sortants)')
    cols = c.fetchall()
    print('Columns:', [col[1] for col in cols])
conn.close()