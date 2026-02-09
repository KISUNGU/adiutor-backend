import requests
import json

base = 'http://localhost:4000'

# Login
print('Login...')
r = requests.post(f'{base}/api/login', json={
    'email': 'admin@mail.com',
    'password': 'adminpassword'
}, timeout=10)
r.raise_for_status()
token = r.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Get services
print('\nRecuperation des services...')
r2 = requests.get(f'{base}/api/services', headers=headers, params={'active': 'true'}, timeout=10)
print(f'Status: {r2.status_code}')

services = r2.json()
print(f'\nTotal services actifs: {len(services)}')

# Filter services with archive pages
archive_services = [s for s in services if s.get('has_archive_page') == 1]
print(f'\nServices avec page archivage: {len(archive_services)}')

for service in archive_services:
    print(f"  - {service['code']}: {service['nom']}")
    print(f"    Icon: {service.get('archive_icon', 'N/A')}, Color: {service.get('archive_color', 'N/A')}")

