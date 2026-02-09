const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('📊 Vérification des services:\n');

db.all(`SELECT code, nom, actif FROM services ORDER BY code`, (err, rows) => {
  if (err) {
    console.error('Erreur:', err);
  } else {
    console.log('Services dans la base:');
    console.table(rows);
    
    // Vérifier lesquels sont actifs
    const actifs = rows.filter(s => s.actif === 1 || s.actif === '1');
    console.log(`\n✅ Services actifs: ${actifs.length}`);
    console.table(actifs);
  }
  db.close();
});
