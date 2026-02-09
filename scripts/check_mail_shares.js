const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('📊 Vérification des courriers partagés:\n');

// 1. Compter les partages
db.get(`SELECT COUNT(*) as total FROM mail_shares`, (err, row) => {
  if (err) {
    console.error('Erreur comptage mail_shares:', err);
  } else {
    console.log(`✅ Total partages dans mail_shares: ${row.total}\n`);
  }
  
  // 2. Afficher quelques partages avec détails
  db.all(`
    SELECT 
      ms.id as share_id,
      ms.incoming_mail_id,
      ms.shared_from_service,
      ms.shared_to_service,
      ms.share_type,
      ms.status,
      ms.created_at,
      im.ref_code,
      im.subject
    FROM mail_shares ms
    LEFT JOIN incoming_mails im ON ms.incoming_mail_id = im.id
    ORDER BY ms.created_at DESC
    LIMIT 10
  `, (err2, rows) => {
    if (err2) {
      console.error('Erreur récupération partages:', err2);
    } else {
      console.log('📋 Derniers partages:');
      console.table(rows);
    }
    
    // 3. Vérifier les services distincts
    db.all(`SELECT DISTINCT shared_to_service FROM mail_shares WHERE shared_to_service IS NOT NULL`, (err3, services) => {
      if (err3) {
        console.error('Erreur services:', err3);
      } else {
        console.log('\n📌 Services qui ont reçu des partages:');
        console.table(services);
      }
      db.close();
    });
  });
});
