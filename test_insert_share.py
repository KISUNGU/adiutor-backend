import sqlite3
from datetime import datetime

# Connexion à la base
conn = sqlite3.connect('databasepnda.db')
c = conn.cursor()

# Vérifier qu'il y a des incoming_mails
c.execute('SELECT id, ref_code, subject, sender, assigned_service FROM incoming_mails LIMIT 5')
mails = c.fetchall()
print('📧 Incoming mails disponibles:')
for m in mails:
    print(f'  ID: {m[0]}, Ref: {m[1]}, Service: {m[4]}')

if not mails:
    print('❌ Aucun mail trouvé')
    conn.close()
    exit()

# Prendre le premier mail
mail_id = mails[0][0]
mail_service = mails[0][4]
print(f'\n🎯 Utilisation du mail ID {mail_id} (service: {mail_service})')

# Vérifier les services disponibles
c.execute('SELECT code, nom FROM services WHERE code != ?', [mail_service])
services = c.fetchall()
print(f'\n📋 Services disponibles pour partage:')
for s in services:
    print(f'  {s[0]} - {s[1]}')

if not services:
    print('❌ Aucun service de destination')
    conn.close()
    exit()

# Choisir TRESORERIE ou le premier service disponible
target_service = 'TRESORERIE' if any(s[0] == 'TRESORERIE' for s in services) else services[0][0]
print(f'\n🎯 Service cible: {target_service}')

# Insérer un partage de test
c.execute('''
    INSERT INTO mail_shares 
    (incoming_mail_id, shared_by_user_id, shared_from_service, shared_to_service, 
     share_message, share_type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
''', [
    mail_id,
    9,  # user_id admin
    mail_service,
    target_service,
    'Test de partage automatique - Veuillez vérifier ce courrier',
    'info',
    'pending',
    datetime.now().isoformat()
])

share_id = c.lastrowid
conn.commit()

print(f'\n✅ Partage créé avec ID: {share_id}')

# Vérifier l'insertion
c.execute('''
    SELECT ms.id, ms.incoming_mail_id, ms.shared_from_service, ms.shared_to_service,
           ms.share_type, ms.status, im.ref_code, im.subject
    FROM mail_shares ms
    JOIN incoming_mails im ON im.id = ms.incoming_mail_id
    WHERE ms.id = ?
''', [share_id])

result = c.fetchone()
if result:
    print('\n📊 Détails du partage créé:')
    print(f'  Share ID: {result[0]}')
    print(f'  Mail ID: {result[1]}')
    print(f'  From: {result[2]} → To: {result[3]}')
    print(f'  Type: {result[4]}, Status: {result[5]}')
    print(f'  Mail: {result[6]} - {result[7]}')

conn.close()
print('\n🎉 Test terminé ! Vérifiez dans l\'interface web.')
