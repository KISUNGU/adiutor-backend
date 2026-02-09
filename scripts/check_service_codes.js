const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('📊 Codes de service uniques dans archives:');
db.all(`SELECT DISTINCT service_code FROM archives WHERE service_code IS NOT NULL ORDER BY service_code`, (err, rows) => {
  if (err) console.error('Erreur archives:', err);
  else console.table(rows);
  
  console.log('\n📊 Codes de service depuis la table services:');
  db.all(`SELECT code, nom FROM services ORDER BY code`, (err2, rows2) => {
    if (err2) console.error('Erreur services:', err2);
    else console.table(rows2);
    db.close();
  });
});
