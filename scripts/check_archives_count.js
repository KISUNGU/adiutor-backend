const sqlite3 = require('sqlite3').verbose();
const dbPath = './databasepnda.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Erreur ouverture DB:', err.message);
    process.exit(1);
  }
});

const query = `SELECT COUNT(*) as cnt FROM archives_general`;

db.get(query, [], (err, row) => {
  if (err) {
    console.error('Erreur requete:', err.message);
    process.exit(1);
  }
  console.log(JSON.stringify(row, null, 2));
  db.close();
});
