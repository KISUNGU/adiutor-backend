import requests
import json

base = 'http://localhost:4000'

# Login
r = requests.post(base + '/api/login', json={'email': 'admin@mail.com', 'password': 'adminpassword'}, timeout=10)
r.raise_for_status()
token = r.json().get('token')
print('✅ Login OK, token:', token[:20] + '...')

h = {'Authorization': 'Bearer ' + token}

# Get mails from COMPTABLE
rr = requests.get(base + '/api/mails/incoming?assigned_service=COMPTABLE', headers=h, timeout=10)
rr.raise_for_status()
mails = rr.json()
print(f'📧 Mails COMPTABLE: {len(mails)}')

if mails:
    mail_id = mails[0].get('id')
    print(f'🎯 Premier mail ID: {mail_id}')
    
    # Share with TRESORERIE
    share_data = {
        'service_codes': ['TRESORERIE'],
        'message': 'Test partage depuis script Python',
        'share_type': 'info'
    }
    
    print(f'📤 Partage du mail {mail_id} avec TRESORERIE...')
    rrr = requests.post(base + f'/api/mails/{mail_id}/share', headers=h, json=share_data, timeout=10)
    print(f'Status: {rrr.status_code}')
    print(f'Response: {rrr.text[:500]}')
    
    if rrr.status_code == 200:
        print('✅ Partage réussi!')
        
        # Vérifier qu'il apparaît dans TRESORERIE
        check = requests.get(base + '/api/mails/shared?service=TRESORERIE', headers=h, timeout=10)
        check.raise_for_status()
        shared_mails = check.json()
        print(f'📨 Courriers partagés vers TRESORERIE: {len(shared_mails)}')
        if shared_mails:
            print('Premier courrier partagé:', shared_mails[0])
    else:
        print('❌ Erreur de partage')
else:
    print('❌ Aucun mail COMPTABLE trouvé')
