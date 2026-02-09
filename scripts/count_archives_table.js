const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./databasepnda.db');

db.get('SELECT COUNT(*) AS cnt FROM archives', (err, row) => {
  if (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  }
  console.log('archives table count ->', row.cnt);
  db.close();
});
