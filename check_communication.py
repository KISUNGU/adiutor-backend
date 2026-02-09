import sqlite3

conn = sqlite3.connect('c:\\wamp64\\www\\realcom\\adiutorai-mini\\backend\\databasepnda.db')
c = conn.cursor()

c.execute('SELECT id, code, nom, actif, has_archive_page, archive_icon, archive_color FROM services WHERE code=?', ('COMMUNICATION',))
r = c.fetchone()

if r:
    print('Service COMMUNICATION trouve:')
    print(f'  ID: {r[0]}')
    print(f'  Code: {r[1]}')
    print(f'  Nom: {r[2]}')
    print(f'  Actif: {r[3]}')
    print(f'  has_archive_page: {r[4]}')
    print(f'  archive_icon: {r[5]}')
    print(f'  archive_color: {r[6]}')
else:
    print('Service COMMUNICATION non trouve')

print('\nTous les services:')
c.execute('SELECT id, code, nom, actif, has_archive_page FROM services ORDER BY id')
for row in c.fetchall():
    print(f'  {row[0]}: {row[1]} - {row[2]} (actif={row[3]}, archive={row[4]})')

conn.close()
