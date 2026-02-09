const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./databasepnda.db');

db.all("PRAGMA table_info('incoming_mails')", [], (err, rows) => {
  if (err) { console.error('Erreur:', err.message); process.exit(1); }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
