"""
Script de validation du flux d'indexation avec services
Vérifie que indexed_function_id -> assigned_service -> provenance archive
"""
import requests
import json
import sys

BASE = 'http://localhost:4000'

def main():
    print("=" * 60)
    print("TEST: Indexation avec Services -> Archive Provenance")
    print("=" * 60)
    
    # 1. Login admin
    print("\n1️⃣ Login admin...")
    r = requests.post(f'{BASE}/api/login', json={
        'email': 'admin@mail.com',
        'password': 'adminpassword'
    }, timeout=10)
    r.raise_for_status()
    token = r.json().get('token')
    if not token:
        raise Exception("Pas de token")
    headers = {'Authorization': f'Bearer {token}'}
    print("✅ Login OK")
    
    # 2. Récupérer la liste des services actifs
    print("\n2️⃣ Récupération des services actifs...")
    r = requests.get(f'{BASE}/api/services', headers=headers, timeout=10)
    r.raise_for_status()
    services = r.json()
    active_services = [s for s in services if s.get('actif')]
    
    if not active_services:
        raise Exception("Aucun service actif trouvé")
    
    test_service = active_services[0]
    service_id = test_service['id']
    service_code = test_service['code']
    service_nom = test_service['nom']
    
    print(f"✅ Service de test: {service_nom} (ID={service_id}, CODE={service_code})")
    
    # 3. Trouver un courrier à indexer
    print("\n3️⃣ Récupération d'un courrier non indexé...")
    r = requests.get(f'{BASE}/api/mails/incoming', headers=headers, 
                    params={'status': 'Nouveau'}, timeout=10)
    r.raise_for_status()
    courriers = r.json()
    
    if not isinstance(courriers, list) or not courriers:
        raise Exception("Aucun courrier 'Nouveau' trouvé pour tester")
    
    courrier = courriers[0]
    mail_id = courrier['id']
    print(f"✅ Courrier trouvé: ID={mail_id}, Sujet='{courrier.get('subject', 'N/A')}'")
    
    # 4. Indexer le courrier avec le service
    print(f"\n4️⃣ Indexation du courrier avec service {service_nom}...")
    r = requests.put(f'{BASE}/api/mails/incoming/{mail_id}', headers=headers, json={
        'indexed_function_id': service_id,
        'ref_code': courrier.get('ref_code', f'TEST-{mail_id}'),
        'summary': f'Test indexation service {service_nom}',
        'status': 'Indexé',
        'urgent': 0,
        'response_required': 0
    }, timeout=10)
    
    if r.status_code != 200:
        print(f"❌ Erreur indexation: {r.status_code} - {r.text}")
        sys.exit(1)
    
    print("✅ Indexation OK")
    
    # 5. Vérifier que assigned_service a été mis à jour
    print("\n5️⃣ Vérification de assigned_service...")
    r = requests.get(f'{BASE}/api/mails/incoming/{mail_id}', headers=headers, timeout=10)
    r.raise_for_status()
    mail_data = r.json()
    
    mail_info = mail_data.get('mail', {})
    assigned_service = mail_info.get('assigned_service', '')
    indexed_function_id = mail_info.get('indexed_function_id')
    
    print(f"  • indexed_function_id: {indexed_function_id}")
    print(f"  • assigned_service: {assigned_service}")
    print(f"  • service_code attendu: {service_code}")
    
    if assigned_service != service_code:
        print(f"❌ ERREUR: assigned_service ({assigned_service}) != service_code ({service_code})")
        sys.exit(1)
    
    print("✅ assigned_service correspond au service indexé")
    
    # 6. Mettre en traitement
    print("\n6️⃣ Mise en traitement...")
    r = requests.put(f'{BASE}/api/mails/incoming/{mail_id}/disposition', 
                    headers=headers, json={
        'assigned_service': service_code,
        'comment': 'Test de flux indexation -> archive'
    }, timeout=10)
    
    if r.status_code != 200:
        print(f"❌ Erreur mise en traitement: {r.status_code} - {r.text}")
        sys.exit(1)
    
    print("✅ Mise en traitement OK")
    
    # 7. Marquer comme traité et archiver
    print("\n7️⃣ Archivage du courrier...")
    r = requests.post(f'{BASE}/api/archives', headers=headers, json={
        'incoming_mail_id': mail_id,
        'category': 'Courrier Entrant',
        'description': f'Test archive provenance {service_nom}',
        'classeur': f'TEST-{service_code}',
        'type': 'Courrier'
    }, timeout=10)
    
    if r.status_code not in [200, 201]:
        print(f"❌ Erreur archivage: {r.status_code} - {r.text}")
        sys.exit(1)
    
    archive_id = r.json().get('id') or r.json().get('archive_id')
    print(f"✅ Archive créée: ID={archive_id}")
    
    # 8. Vérifier la provenance dans les archives
    print("\n8️⃣ Vérification de la provenance dans l'archive...")
    r = requests.get(f'{BASE}/api/archives', headers=headers, 
                    params={'service': service_code}, timeout=10)
    r.raise_for_status()
    archives = r.json()
    
    matching_archive = None
    for arch in archives:
        if arch.get('incoming_mail_id') == mail_id:
            matching_archive = arch
            break
    
    if not matching_archive:
        print(f"❌ Archive non trouvée pour mail_id={mail_id}")
        sys.exit(1)
    
    archive_service = matching_archive.get('service_code', '')
    print(f"  • service_code dans archive: {archive_service}")
    print(f"  • service_code attendu: {service_code}")
    
    if archive_service != service_code:
        print(f"❌ ERREUR: Provenance archive ({archive_service}) != service indexé ({service_code})")
        sys.exit(1)
    
    print("✅ Provenance archive correspond au service indexé")
    
    print("\n" + "=" * 60)
    print("✅ TOUS LES TESTS RÉUSSIS!")
    print("=" * 60)
    print(f"\nRésumé:")
    print(f"  • Service: {service_nom} (ID={service_id}, CODE={service_code})")
    print(f"  • Courrier ID: {mail_id}")
    print(f"  • Archive ID: {archive_id}")
    print(f"  • indexed_function_id → assigned_service → provenance: {service_code}")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ ERREUR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
