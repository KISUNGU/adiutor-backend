const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('📊 Types de documents dans la base de données:\n');
db.all(`SELECT id_type_document, nom_type FROM type_documents ORDER BY id_type_document`, (err, rows) => {
  if (err) {
    console.error('Erreur:', err);
  } else {
    console.table(rows);
  }
  db.close();
});
