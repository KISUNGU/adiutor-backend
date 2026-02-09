const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath);

const sql = `SELECT id, reference, type, description, category, classeur, status, date FROM archives ORDER BY id DESC LIMIT 10`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('Error querying archives:', err.message);
    process.exit(1);
  }
  console.log('Latest archives (up to 10):');
  console.table(rows);
  db.close();
});
