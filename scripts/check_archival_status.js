const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []){
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
}

(async function(){
  try{
    console.log('DB:', dbPath);

    const totalIncoming = (await all("SELECT COUNT(*) as c FROM incoming_mails"))[0].c;
    // Use the actual columns in this DB: 'statut_global', 'archived_at', 'date_archivage'
    const archivedIncoming = (await all("SELECT COUNT(*) as c FROM incoming_mails WHERE (statut_global='Archivé') OR (archived_at IS NOT NULL) OR (date_archivage IS NOT NULL)"))[0].c;
    const sampleArchivedIncoming = await all("SELECT id, ref_code, subject, sender, statut_global, archived_at, date_archivage FROM incoming_mails WHERE (statut_global='Archivé') OR (archived_at IS NOT NULL) OR (date_archivage IS NOT NULL) ORDER BY id DESC LIMIT 20");

    const totalArchives = (await all("SELECT COUNT(*) as c FROM archives"))[0].c;
    const sampleArchives = await all("SELECT id, reference, incoming_mail_id, type, status, date, classeur FROM archives ORDER BY id DESC LIMIT 20");

    // Find incoming mails that may have been validated recently (last 7 days)
    // Use 'treatment_completed_at' / 'date_archivage' as proxy for recent activity
    const recentValidated = await all("SELECT id, ref_code, subject, sender, statut_global, archived_at, date_archivage, treatment_completed_at FROM incoming_mails WHERE ((statut_global='Archivé') OR (archived_at IS NOT NULL) OR (date_archivage IS NOT NULL)) AND (datetime(treatment_completed_at) >= datetime('now','-30 days') OR datetime(date_archivage) >= datetime('now','-30 days')) ORDER BY id DESC LIMIT 50");

    console.log('\n--- Résumé ---');
    console.log('Total incoming_mails:', totalIncoming);
    console.log("Incoming marqués 'Archivé' (statut_global / archived_at / status):", archivedIncoming);
    console.log('Total archives rows:', totalArchives);

    console.log('\n--- Exemples (incoming_mails archivés) ---');
    console.table(sampleArchivedIncoming);

    console.log('\n--- Exemples (archives table) ---');
    console.table(sampleArchives);

    console.log('\n--- Recent validated incoming_mails (30 jours) ---');
    console.table(recentValidated);

    // For any recentValidated rows, check if an archive exists with incoming_mail_id mapping
    if (recentValidated.length > 0) {
      console.log('\n--- Vérification de correspondance incoming -> archives ---');
      for (let r of recentValidated) {
        const matches = await all('SELECT id, reference, incoming_mail_id, status FROM archives WHERE incoming_mail_id = ? OR reference = ? LIMIT 5', [r.id, r.ref_code || '']);
        console.log(`incoming id=${r.id} ref=${r.ref_code} matches in archives: ${matches.length}`);
        if (matches.length) console.table(matches);
      }
    }

    db.close();
  }catch(err){
    console.error('Erreur:', err.message || err);
    db.close();
    process.exit(1);
  }
})();
