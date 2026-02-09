const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/databasepnda.db', (err) => {
  if (err) {
    console.error('❌ Erreur connexion DB:', err);
    process.exit(1);
  }
});

db.all(`PRAGMA table_info(audit_logs)`, [], (err, rows) => {
  if (err) {
    console.error('❌ Erreur lecture schéma:', err);
    process.exit(1);
  }
  console.log('📋 Schéma audit_logs:');
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
