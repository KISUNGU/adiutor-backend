import sqlite3

conn = sqlite3.connect('c:\\wamp64\\www\\realcom\\adiutorai-mini\\backend\\databasepnda.db')
c = conn.cursor()
c.execute('DELETE FROM services WHERE code IN (?, ?)', ('TEST_SERVICE', 'COMMUNICATION'))
conn.commit()
print(f'{c.rowcount} services supprimes')
conn.close()
