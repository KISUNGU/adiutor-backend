#!/usr/bin/env python3
"""
Script de diagnostic pour les erreurs 401 (Unauthorized)
"""

print("=" * 60)
print("DIAGNOSTIC DES ERREURS 401 (Unauthorized)")
print("=" * 60)

print("\n📋 SYMPTÔMES:")
print("  - Toutes les requêtes API retournent 401")
print("  - Messages 'Failed to load resource: 401 Unauthorized'")
print("  - Le dashboard ne charge aucune donnée")

print("\n🔍 CAUSES POSSIBLES:")
print("  1. Utilisateur non connecté")
print("  2. Token expiré ou invalide")
print("  3. Token non envoyé dans les requêtes")
print("  4. Backend ne reconnaît pas le token")

print("\n✅ SOLUTIONS:")
print("\n1. RECONNEXION (Solution recommandée)")
print("   a) Ouvrir http://localhost:5173")
print("   b) Si vous voyez la page de login, connectez-vous avec:")
print("      - Admin: admin@mail.com / adminpassword")
print("      - Comptable: comptable@mail.com / comptablepass")
print("   c) Si vous êtes déjà connecté, déconnectez-vous et reconnectez-vous")

print("\n2. VÉRIFICATION CONSOLE NAVIGATEUR")
print("   a) Ouvrir DevTools (F12)")
print("   b) Aller dans l'onglet 'Application' ou 'Stockage'")
print("   c) Vérifier localStorage:")
print("      - 'token' doit contenir un JWT (longue chaîne)")
print("      - 'user' doit contenir les infos utilisateur en JSON")
print("   d) Si absent ou corrompu, supprimer et se reconnecter")

print("\n3. VÉRIFICATION BACKEND")
print("   a) Backend tourne sur http://localhost:4000")
print("   b) Test login:")

import requests
import json

try:
    print("\n      Test connexion admin...")
    resp = requests.post(
        'http://localhost:4000/api/login',
        json={'email': 'admin@mail.com', 'password': 'adminpassword'},
        timeout=5
    )
    if resp.status_code == 200:
        data = resp.json()
        token = data.get('token', '')
        print(f"      ✅ Login réussi! Token: {token[:20]}...")
        print(f"      ✅ Rôle: {data.get('role')}")
        
        # Test d'une requête protégée
        headers = {'Authorization': f'Bearer {token}'}
        resp2 = requests.get('http://localhost:4000/api/rbac/me', headers=headers, timeout=5)
        if resp2.status_code == 200:
            print(f"      ✅ Token valide! API protégée accessible")
        else:
            print(f"      ❌ Token invalide ou API inaccessible: {resp2.status_code}")
    else:
        print(f"      ❌ Login échoué: {resp.status_code}")
        print(f"      Réponse: {resp.text[:200]}")
except Exception as e:
    print(f"      ❌ Erreur: {e}")

print("\n4. NETTOYER LE CACHE NAVIGATEUR")
print("   a) Ouvrir DevTools (F12)")
print("   b) Clic droit sur le bouton de rafraîchissement")
print("   c) Sélectionner 'Vider le cache et actualiser'")

print("\n" + "=" * 60)
print("RÉSUMÉ DES ACTIONS:")
print("=" * 60)
print("1. ⚠️  Se déconnecter du frontend (si connecté)")
print("2. ⚠️  Effacer localStorage (DevTools > Application > localStorage)")
print("3. ✅ Se reconnecter avec identifiants valides")
print("4. ✅ Vérifier que le token est stocké dans localStorage")
print("5. ✅ Recharger la page (Ctrl+F5)")
print("\n" + "=" * 60)
