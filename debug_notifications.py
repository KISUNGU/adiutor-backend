import sqlite3

conn = sqlite3.connect('databasepnda.db')
cursor = conn.cursor()

# Utilisateurs
cursor.execute('SELECT id, username, email, role_id FROM users')
users = cursor.fetchall()
print('=== Utilisateurs dans la base ===')
for u in users:
    print(f'  ID={u[0]}, username={u[1]}, email={u[2]}, role_id={u[3]}')

# Rôles
cursor.execute('SELECT id, name FROM roles')
roles = cursor.fetchall()
print('\n=== Rôles dans la base ===')
for r in roles:
    print(f'  ID={r[0]}, role={r[1]}')

# Notifications récentes
cursor.execute('''
    SELECT n.id, n.user_id, u.username, n.type, n.titre, n.created_at, n.mail_id
    FROM notifications n
    LEFT JOIN users u ON n.user_id = u.id
    ORDER BY n.created_at DESC
    LIMIT 20
''')
notifs = cursor.fetchall()
print('\n=== 20 dernières notifications ===')
for n in notifs:
    print(f'  ID={n[0]}, user={n[2]} (ID={n[1]}), type={n[3]}, titre={n[4]}, mail_id={n[6]}')

conn.close()
