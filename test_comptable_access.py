#!/usr/bin/env python3
import sqlite3
import requests
import json

# Test 1: Vérifier les utilisateurs COMPTABLE
db = sqlite3.connect('databasepnda.db')
c = db.cursor()
c.execute("SELECT id, email, role FROM users WHERE role='COMPTABLE' LIMIT 5")
rows = c.fetchall()

if rows:
    print("✅ Utilisateurs COMPTABLE trouvés:")
    for r in rows:
        print(f"   ID: {r[0]}, Email: {r[1]}, Role: {r[2]}")
    test_email = rows[0][1]
else:
    print("❌ Aucun utilisateur COMPTABLE trouvé")
    test_email = None

db.close()

# Test 2: Si un utilisateur COMPTABLE existe, essayer de se connecter
if test_email:
    base = 'http://localhost:4000'
    try:
        # On va essayer avec un mot de passe par défaut
        login_payload = {'email': test_email, 'password': 'comptablepass'}
        r = requests.post(f'{base}/api/login', json=login_payload, timeout=5)
        print(f"\n🔐 Tentative de connexion avec {test_email}:")
        print(f"   Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            token = data.get('token')
            if token:
                print(f"   ✅ Token obtenu: {token[:20]}...")
                # Test 3: Vérifier l'accès à /api/archives avec service=COMPTABLE
                headers = {'Authorization': f'Bearer {token}'}
                r2 = requests.get(f'{base}/api/archives?service=COMPTABLE&limit=5', headers=headers, timeout=5)
                print(f"\n📊 Accès /api/archives?service=COMPTABLE:")
                print(f"   Status: {r2.status_code}")
                if r2.status_code == 200:
                    data = r2.json()
                    archives = data.get('archives', [])
                    print(f"   ✅ Archives trouvées: {len(archives)}")
            else:
                print(f"   ❌ Pas de token dans la réponse: {r.text[:200]}")
        else:
            print(f"   ❌ Erreur login: {r.text[:200]}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
