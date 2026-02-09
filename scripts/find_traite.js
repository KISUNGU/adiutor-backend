const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./databasepnda.db');

db.all("SELECT id, ref_code, statut_global FROM incoming_mails WHERE statut_global = 'Traité' LIMIT 1", [], (err, rows) => {
  if (err) {
    console.error('ERR', err.message);
    process.exit(2);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
