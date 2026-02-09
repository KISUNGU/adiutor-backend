#!/usr/bin/env python3
"""
Script de validation que l'utilisateur COMPTABLE a accès à la page comptabilite
"""
import sqlite3
import sys

# Vérification 1: Vérifier le mapping des rôles
print("\n=== VÉRIFICATION 1: Mapping des rôles ===")
print("Lisant permissions.map.js...")

with open('rbac/permissions.map.js', 'r', encoding='utf-8') as f:
    content = f.read()
    if "4: 'COMPTABLE'" in content:
        print("✅ ID 4 → COMPTABLE (correct)")
    else:
        print("❌ ID 4 n'est pas mappé à COMPTABLE")
    
    if "5: 'CAISSE'" in content:
        print("✅ ID 5 → CAISSE (correct)")
    else:
        print("❌ ID 5 n'est pas mappé à CAISSE")
    
    if "6: 'TRESORERIE'" in content:
        print("✅ ID 6 → TRESORERIE (correct)")
    else:
        print("❌ ID 6 n'est pas mappé à TRESORERIE")

# Vérification 2: Vérifier les utilisateurs COMPTABLE dans la base
print("\n=== VÉRIFICATION 2: Utilisateurs COMPTABLE ===")
db = sqlite3.connect('databasepnda.db')
c = db.cursor()
c.execute('SELECT id FROM roles WHERE name = ?', ('comptable',))
comptable_role = c.fetchone()

if comptable_role:
    comptable_id = comptable_role[0]
    c.execute('SELECT id, email FROM users WHERE role_id = ?', (comptable_id,))
    users = c.fetchall()
    
    if users:
        for u in users:
            print(f"✅ Utilisateur COMPTABLE: {u[1]} (ID: {u[0]})")
    else:
        print("❌ Aucun utilisateur COMPTABLE trouvé")
else:
    print("❌ Rôle comptable non trouvé dans la base")

db.close()

# Vérification 3: Vérifier la route dans index.js
print("\n=== VÉRIFICATION 3: Route comptabilite ===")
with open('../frontend/src/router/index.js', 'r', encoding='utf-8') as f:
    content = f.read()
    if "path: 'comptabilite'" in content:
        print("✅ Route comptabilite existe")
        if "roles: ['COMPTABLE'" in content:
            print("✅ COMPTABLE est autorisé sur cette route")
        else:
            print("❌ COMPTABLE n'est pas autorisé sur la route")
    else:
        print("❌ Route comptabilite n'existe pas")

# Vérification 4: Vérifier le menu COMPTABLE
print("\n=== VÉRIFICATION 4: Menu COMPTABLE ===")
with open('../frontend/src/config/roleMenus.js', 'r', encoding='utf-8') as f:
    content = f.read()
    if "export const COMPTABLE_MENU" in content:
        print("✅ COMPTABLE_MENU défini")
        if "/finances-administration/comptabilite" in content:
            print("✅ Lien vers comptabilite dans le menu")
        else:
            print("❌ Lien vers comptabilite manquant du menu")
    else:
        print("❌ COMPTABLE_MENU n'existe pas")

# Vérification 5: Vérifier Comptabilite.vue
print("\n=== VÉRIFICATION 5: Page Comptabilite.vue ===")
with open('../frontend/src/views/courrier-adminfinance/Comptabilite.vue', 'r', encoding='utf-8') as f:
    content = f.read()
    if "service: 'COMPTABLE'" in content:
        print("✅ Page filtre par service COMPTABLE")
        if "type: 'Facture'" in content:
            print("⚠️  Page filtre aussi par type: 'Facture'")
            print("   (Ce filtre a été retiré lors de la dernière modification)")
        else:
            print("✅ Pas de filtre par type (affiche tous les documents)")
    else:
        print("❌ Page ne filtre pas par COMPTABLE")

print("\n=== RÉSUMÉ ===")
print("""
Pour tester l'accès COMPTABLE:
1. Lancer le backend: cd backend && node server.js
2. Aller sur http://localhost:5173
3. Se connecter avec: comptable@mail.com / comptablepass
4. Vérifier que le menu affiche "Factures" dans la section Archivage
5. Cliquer sur "Factures" pour voir http://localhost:5173/#/finances-administration/comptabilite
6. La page doit afficher un tableau d'archives avec service_code='COMPTABLE'
""")
