import requests
import json

base = 'http://localhost:4000'

print('=' * 60)
print('VALIDATION COMPLETE DU SYSTEME DE SERVICES DYNAMIQUES')
print('=' * 60)

# Login
print('\n1. AUTHENTIFICATION')
print('-' * 40)
r = requests.post(f'{base}/api/login', json={
    'email': 'admin@mail.com',
    'password': 'adminpassword'
}, timeout=10)
r.raise_for_status()
token = r.json().get('token')
headers = {'Authorization': f'Bearer {token}'}
print('✓ Login reussi (ADMIN)')

# Get services
print('\n2. RECUPERATION DES SERVICES')
print('-' * 40)
r2 = requests.get(f'{base}/api/services', headers=headers, params={'active': 'true'}, timeout=10)
print(f'Status: {r2.status_code}')
services = r2.json()
print(f'Total services actifs: {len(services)}')

# Filter with archive
archive_services = [s for s in services if s.get('has_archive_page') == 1]
print(f'\nServices avec page archivage: {len(archive_services)}')

if archive_services:
    print('\nLISTE DES SERVICES AVEC ARCHIVAGE:')
    print('Code'.ljust(20), 'Nom'.ljust(25), 'Icone'.ljust(20), 'Couleur')
    print('-' * 85)
    for s in sorted(archive_services, key=lambda x: x['nom']):
        code = s['code'].ljust(20)
        nom = s['nom'].ljust(25)
        icon = s.get('archive_icon', 'N/A').ljust(20)
        color = s.get('archive_color', 'N/A')
        print(f'{code} {nom} {icon} {color}')
else:
    print('\n⚠ Aucun service avec archivage active')

# Expected menu structure
print('\n3. STRUCTURE DE MENU ATTENDUE')
print('-' * 40)
print('Section: "Par Services"')
for s in sorted(archive_services, key=lambda x: x['nom']):
    route = f"/finances-administration/archive-{s['code'].lower().replace('_', '-')}"
    print(f'  → {s["nom"]} ({s["archive_icon"]})')
    print(f'    Route: {route}')

# Verification API endpoints
print('\n4. VERIFICATION DES ENDPOINTS')
print('-' * 40)
for service in archive_services[:3]:  # Test first 3
    route = f"/api/archives?service={service['code']}&limit=10"
    try:
        r3 = requests.get(f'{base}{route}', headers=headers, timeout=10)
        status = '✓' if r3.status_code == 200 else '✗'
        print(f'{status} {route} - Status: {r3.status_code}')
    except Exception as e:
        print(f'✗ {route} - Error: {str(e)}')

print('\n' + '=' * 60)
print('VALIDATION TERMINEE')
print('=' * 60)
print('\nPROCHAINES ETAPES:')
print('1. Ouvrez http://localhost:5173')
print('2. Connectez-vous en tant qu\'ADMIN')
print('3. Verifiez la section "Par Services" dans le menu')
print('4. Les services ci-dessus devraient etre visibles')
print('\nPour ajouter un nouveau service:')
print('→ Administration > Gestion des Services > Nouveau Service')
print('→ Cochez "Creer automatiquement une page d\'archivage"')
print('→ Le service apparaitra automatiquement dans le menu')
