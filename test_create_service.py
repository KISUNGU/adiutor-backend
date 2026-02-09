import requests
import json

base = 'http://localhost:4000'

# Login
print('=== TEST CREATION SERVICE DYNAMIQUE ===\n')
print('1. Login...')
r = requests.post(f'{base}/api/login', json={
    'email': 'admin@mail.com',
    'password': 'adminpassword'
}, timeout=10)
r.raise_for_status()
token = r.json().get('token')
headers = {'Authorization': f'Bearer {token}'}
print('   ✓ Login reussi\n')

# Get current services
print('2. Services actuels avec archivage:')
r2 = requests.get(f'{base}/api/services', headers=headers, params={'active': 'true'}, timeout=10)
services = r2.json()
archive_services = [s for s in services if s.get('has_archive_page') == 1]
for s in archive_services:
    print(f'   - {s["code"]}: {s["nom"]} ({s["archive_icon"]}, {s["archive_color"]})')
print(f'   Total: {len(archive_services)} services\n')

# Create new service
print('3. Creation nouveau service COMMUNICATION...')
new_service = {
    'code': 'COMMUNICATION',
    'nom': 'Communication',
    'description': 'Service de communication et relations publiques',
    'actif': 1,
    'ordre': 20,
    'has_archive_page': 1,
    'archive_icon': 'cilSpeech',
    'archive_color': 'danger'
}

r3 = requests.post(f'{base}/api/services', headers=headers, json=new_service, timeout=10)
if r3.status_code == 201:
    print('   ✓ Service cree avec succes!')
    print(f'   ID: {r3.json().get("id")}')
elif r3.status_code == 409:
    print('   ⚠ Service deja existant')
else:
    print(f'   ✗ Erreur {r3.status_code}: {r3.text}')

# Verify creation
print('\n4. Verification - Services avec archivage:')
r4 = requests.get(f'{base}/api/services', headers=headers, params={'active': 'true'}, timeout=10)
services_after = r4.json()
archive_services_after = [s for s in services_after if s.get('has_archive_page') == 1]
for s in archive_services_after:
    marker = '← NOUVEAU' if s['code'] == 'COMMUNICATION' else ''
    print(f'   - {s["code"]}: {s["nom"]} ({s["archive_icon"]}, {s["archive_color"]}) {marker}')
print(f'   Total: {len(archive_services_after)} services')

print('\n=== TEST TERMINE ===')
