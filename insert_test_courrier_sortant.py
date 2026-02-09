import sqlite3
from datetime import datetime

db = sqlite3.connect('databasepnda.db')
c = db.cursor()

# Exemple d'insertion d'un courrier sortant de test
c.execute('''
INSERT INTO courriers_sortants (
    user_id, entete, courrier, pied, logo, statut,
    reference_unique, uuid, original_filename, preview_pdf, extracted_text, scanned_receipt_path, original_file_path,
    destinataire, objet, date_edition, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', (
    1,  # user_id
    '{"ministere": "Test Ministère"}',  # entete
    '{"contenu": "Ceci est un test de courrier sortant."}',  # courrier
    '{"adresse": "123 rue Test"}',  # pied
    None,  # logo
    'brouillon',
    'REF-TEST-001',
    'UUID-TEST-001',
    'testfile.docx',
    None, None, None, None,
    'Destinataire Test',
    'Objet test',
    datetime.now().strftime('%Y-%m-%d'),
    datetime.now().isoformat(),
    datetime.now().isoformat()
))

db.commit()
db.close()
print('Courrier sortant de test inséré.')
