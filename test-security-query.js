const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'databasepnda.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

const sql = `
  SELECT id, type, title, message, severity, status, source, meta, created_at, updated_at
  FROM security_alerts
  ORDER BY created_at DESC
  LIMIT 50
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('Query failed:', err.message);
  } else {
    console.log('Query successful. Rows:', rows.length);
    console.log(rows);
  }
  db.close();
});
