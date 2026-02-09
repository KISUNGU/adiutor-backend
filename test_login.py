import requests
import json

base = 'http://localhost:4000'

# Test login
print('=== Test Login ===')
try:
    r = requests.post(f'{base}/api/login', json={
        'email': 'admin@mail.com',
        'password': 'adminpassword'
    }, timeout=10)
    
    print(f'Status: {r.status_code}')
    
    if r.status_code == 200:
        data = r.json()
        print(f'✅ Login réussi!')
        print(f'Token reçu: {data.get("token")[:50]}...' if data.get("token") else 'Pas de token')
        print(f'User: {data.get("user", {}).get("username")}')
        print(f'Role: {data.get("user", {}).get("role_name")}')
    else:
        print(f'❌ Login échoué')
        print(f'Response: {r.text[:500]}')
        
except Exception as e:
    print(f'❌ Erreur: {e}')
