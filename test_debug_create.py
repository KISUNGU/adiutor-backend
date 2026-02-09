import requests
import json

base = 'http://localhost:4000'

# Login
r = requests.post(f'{base}/api/login', json={
    'email': 'admin@mail.com',
    'password': 'adminpassword'
}, timeout=10)
token = r.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Test avec valeurs explicites
new_service = {
    'code': 'TEST_SERVICE',
    'nom': 'Test Service',
    'description': 'Service de test',
    'actif': 1,
    'ordre': 30,
    'has_archive_page': 1,
    'archive_icon': 'cilLeaf',
    'archive_color': 'success'
}

print('Payload envoye:')
print(json.dumps(new_service, indent=2))

r3 = requests.post(f'{base}/api/services', headers=headers, json=new_service, timeout=10)
print(f'\nStatus: {r3.status_code}')
print(f'Response: {r3.text}')

if r3.status_code in [200, 201]:
    # Verifier dans la DB
    import sqlite3
    conn = sqlite3.connect('c:\\wamp64\\www\\realcom\\adiutorai-mini\\backend\\databasepnda.db')
    c = conn.cursor()
    c.execute('SELECT code, has_archive_page, archive_icon, archive_color FROM services WHERE code=?', ('TEST_SERVICE',))
    r = c.fetchone()
    if r:
        print(f'\nDans la DB:')
        print(f'  code: {r[0]}')
        print(f'  has_archive_page: {r[1]} (type: {type(r[1])})')
        print(f'  archive_icon: {r[2]}')
        print(f'  archive_color: {r[3]}')
    conn.close()
