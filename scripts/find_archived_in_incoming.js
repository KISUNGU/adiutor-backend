const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./databasepnda.db');

db.all("SELECT id, ref_code, subject, status, created_at, statut_global FROM incoming_mails WHERE statut_global = 'Archivé' OR status = 'Archivé' LIMIT 50", [], (err, rows) => {
  if (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
