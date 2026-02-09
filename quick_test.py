#!/usr/bin/env python3
import requests
import json

base_url = 'http://localhost:4000'

# Test de santé
r = requests.get(f'{base_url}/health', timeout=5)
print(f'Health: {r.status_code}')

# Test de login
login_data = {'email': 'admin@mail.com', 'password': 'adminpassword'}
r = requests.post(f'{base_url}/api/login', json=login_data, timeout=10)
print(f'Login: {r.status_code}')
if r.status_code == 200:
    token = r.json().get('token')
    print(f'Token obtenu')
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # Test des stats avant création
    r = requests.get(f'{base_url}/api/dashboard/stats', headers=headers, timeout=10)
    print(f'Dashboard stats: {r.status_code}')
    initial_count = 'N/A'
    if r.status_code == 200:
        stats = r.json()
        if 'stats' in stats:
            for stat in stats['stats']:
                if stat.get('title') == 'Correspondances Internes':
                    initial_count = int(stat.get('value', '0'))
                    break
    print(f'Stats avant: internal_correspondence = {initial_count}')
    
    # Test de création d'une correspondance interne
    internal_data = {
        'reference': 'TEST001',
        'destinataire': 'Test User',
        'objet': 'Test de correspondance interne',
        'date': '2024-01-15',
        'fonction': 'Test',
        'type_document': 'Lettre',
        'metadata': json.dumps({'test': True})
    }
    r = requests.post(f'{base_url}/api/correspondances-internes', 
                     json=internal_data, headers=headers, timeout=10)
    print(f'Création correspondance interne: {r.status_code}')
    if r.status_code == 201:
        print('Correspondance créée avec succès')
    else:
        print(f'Échec création: {r.text}')
    
    # Test des stats après création
    r = requests.get(f'{base_url}/api/dashboard/stats', headers=headers, timeout=10)
    final_count = 'N/A'
    if r.status_code == 200:
        stats = r.json()
        if 'stats' in stats:
            for stat in stats['stats']:
                if stat.get('title') == 'Correspondances Internes':
                    final_count = int(stat.get('value', '0'))
                    break
    print(f'Stats après: internal_correspondence = {final_count}')
    
    if initial_count != 'N/A' and final_count != 'N/A':
        if final_count == initial_count + 1:
            print('✅ Test réussi: comptage mis à jour correctement')
        else:
            print(f'❌ Test échoué: comptage incorrect ({initial_count} -> {final_count})')
    
else:
    print(f'Login failed: {r.text}')