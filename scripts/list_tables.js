const sqlite3 = require('sqlite3').verbose();
const dbPath = './databasepnda.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Erreur ouverture DB:', err.message);
    process.exit(1);
  }
});

db.all("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name", [], (err, rows) => {
  if (err) {
    console.error('Erreur requete:', err.message);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
