import requests

base = 'http://localhost:4000'

# Login
r = requests.post(base + '/api/login', json={'email': 'admin@mail.com', 'password': 'adminpassword'}, timeout=10)
r.raise_for_status()
token = r.json().get('token')
print('✅ Login OK')

h = {'Authorization': 'Bearer ' + token}

# Vérifier les courriers partagés pour TRESORERIE
print('\n📨 Courriers partagés vers TRESORERIE:')
r = requests.get(base + '/api/mails/shared?service=TRESORERIE', headers=h, timeout=10)
print(f'Status: {r.status_code}')
print(f'Response: {r.text[:500]}')

if r.status_code == 200:
    shares = r.json()
    print(f'\n✅ {len(shares)} courrier(s) partagé(s)')
    for share in shares:
        print(f'  - {share.get("ref_code")} partagé par {share.get("shared_by_name")} depuis {share.get("shared_from_service")}')
else:
    print('❌ Erreur')
