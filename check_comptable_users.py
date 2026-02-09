#!/usr/bin/env python3
import sqlite3

db = sqlite3.connect('databasepnda.db')
c = db.cursor()

# Lire les rôles
c.execute('SELECT id, name FROM roles LIMIT 10')
roles = c.fetchall()
print('Rôles disponibles:')
for r in roles:
    print(f'  ID: {r[0]}, Name: {r[1]}')

# Chercher les utilisateurs avec role_id pointing to comptable role (lowercase)
c.execute('SELECT id FROM roles WHERE name = ?', ('comptable',))
comptable_role = c.fetchone()
if comptable_role:
    comptable_id = comptable_role[0]
    print(f'\nRôle comptable ID: {comptable_id}')
    c.execute('SELECT id, email FROM users WHERE role_id = ?', (comptable_id,))
    users = c.fetchall()
    if users:
        print('Utilisateurs comptable:')
        for u in users:
            print(f'  ID: {u[0]}, Email: {u[1]}')
    else:
        print('❌ Aucun utilisateur comptable')
else:
    print('❌ Rôle comptable non trouvé')

db.close()
