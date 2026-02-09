import requests
import json

base = 'http://localhost:4000'

print('=' * 70)
print('TEST DE RAFRAICHISSEMENT AUTOMATIQUE APRES SUPPRESSION')
print('=' * 70)

# Login
r = requests.post(f'{base}/api/login', json={
    'email': 'admin@mail.com',
    'password': 'adminpassword'
}, timeout=10)
token = r.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Créer un service de test
print('\n1. CREATION D\'UN SERVICE TEST')
print('-' * 50)
new_service = {
    'code': 'SERVICE_TEST_AUTO',
    'nom': 'Service Test Auto-Refresh',
    'description': 'Service pour tester le rafraîchissement automatique',
    'actif': 1,
    'ordre': 99,
    'has_archive_page': 1,
    'archive_icon': 'cilBug',
    'archive_color': 'warning'
}

r2 = requests.post(f'{base}/api/services', headers=headers, json=new_service, timeout=10)
if r2.status_code == 201:
    service_id = r2.json().get('id')
    print(f'✓ Service créé avec ID: {service_id}')
else:
    print(f'✗ Erreur {r2.status_code}: {r2.text}')
    # Essayer de récupérer l'ID si le service existe déjà
    r3 = requests.get(f'{base}/api/services', headers=headers, params={'active': 'false'}, timeout=10)
    services = r3.json()
    existing = next((s for s in services if s['code'] == 'SERVICE_TEST_AUTO'), None)
    if existing:
        service_id = existing['id']
        print(f'⚠ Service existant trouvé avec ID: {service_id}')
    else:
        exit(1)

# Vérifier qu'il apparaît dans la liste
print('\n2. VERIFICATION PRESENCE DANS LA LISTE')
print('-' * 50)
r4 = requests.get(f'{base}/api/services', headers=headers, params={'active': 'true'}, timeout=10)
services = r4.json()
test_service = next((s for s in services if s.get('id') == service_id), None)

if test_service:
    print(f'✓ Service trouvé:')
    print(f'  Code: {test_service["code"]}')
    print(f'  Nom: {test_service["nom"]}')
    print(f'  has_archive_page: {test_service.get("has_archive_page")}')
    print(f'  archive_icon: {test_service.get("archive_icon")}')
else:
    print('✗ Service non trouvé dans la liste')
    exit(1)

# Attendre un peu
print('\n3. ATTENTE AVANT SUPPRESSION...')
import time
time.sleep(2)

# Supprimer le service
print('\n4. SUPPRESSION DU SERVICE')
print('-' * 50)
r5 = requests.delete(f'{base}/api/services/{service_id}', headers=headers, timeout=10)
if r5.status_code == 200:
    print(f'✓ Service supprimé avec succès')
    print(f'  Message: {r5.json().get("message")}')
else:
    print(f'✗ Erreur {r5.status_code}: {r5.text}')
    exit(1)

# Vérifier qu'il a disparu
print('\n5. VERIFICATION SUPPRESSION')
print('-' * 50)
r6 = requests.get(f'{base}/api/services', headers=headers, params={'active': 'true'}, timeout=10)
services_after = r6.json()
still_exists = next((s for s in services_after if s.get('id') == service_id), None)

if still_exists:
    print('✗ Le service existe encore (problème!)')
else:
    print('✓ Le service a bien été supprimé de la base')

print('\n' + '=' * 70)
print('TEST TERMINE')
print('=' * 70)
print('\nCOMPORTEMENT ATTENDU DANS L\'INTERFACE:')
print('1. Lors de la création d\'un service avec archivage:')
print('   → Alert "Service créé avec succès"')
print('   → Attente 500ms')
print('   → Rechargement automatique de la page')
print('   → Le service apparaît dans le menu "Par Services"')
print('')
print('2. Lors de la suppression d\'un service:')
print('   → Alert "Service supprimé avec succès"')
print('   → Attente 500ms')
print('   → Rechargement automatique de la page')
print('   → Le service disparaît du menu "Par Services"')
print('')
print('3. Lors de l\'activation/désactivation d\'un service avec archivage:')
print('   → Mise à jour de la liste')
print('   → Rechargement automatique de la page')
print('   → Le menu se met à jour en conséquence')
