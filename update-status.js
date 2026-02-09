const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./databasepnda.db');

db.run(`UPDATE incoming_mails SET statut_global = 'Acquis' WHERE statut_global = 'acquis'`, function(err) {
  if (err) {
    console.error('❌ Erreur:', err.message);
  } else {
    console.log(`✅ Mise à jour: ${this.changes} ligne(s) modifiée(s)`);
  }
  db.close();
});
