import requests

base = 'http://localhost:4000'

# Login
r = requests.post(f'{base}/api/login', json={
    'email': 'admin@mail.com',
    'password': 'adminpassword'
}, timeout=10)
r.raise_for_status()
token = r.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Test courriers-sortants stats
print('=== Test /api/courriers-sortants/stats ===')
r2 = requests.get(f'{base}/api/courriers-sortants/stats', headers=headers, params={
    'period': '7d',
    'startDate': '2026-01-24',
    'endDate': '2026-01-30'
}, timeout=10)

print(f'Status: {r2.status_code}')
if r2.status_code == 200:
    print('✅ Route fonctionne!')
    print(f'Response: {r2.text[:300]}')
else:
    print(f'❌ Erreur: {r2.text[:500]}')
