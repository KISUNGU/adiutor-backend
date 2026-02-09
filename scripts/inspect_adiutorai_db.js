const sqlite3 = require('sqlite3').verbose();
const dbPath = './adiutorai.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) { console.error('Erreur ouverture', dbPath, err.message); process.exit(1); }
});

db.all("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name", [], (err, rows) => {
  if (err) { console.error('Err:', err.message); process.exit(1); }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
