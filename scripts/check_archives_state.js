const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

db.all(`
  SELECT 
    a.id, 
    a.reference, 
    a.service_code, 
    a.incoming_mail_id,
    i.assigned_service, 
    i.service_orientation_dg
  FROM archives a 
  LEFT JOIN incoming_mails i ON a.incoming_mail_id = i.id 
  WHERE a.reference LIKE 'ARCH-ACQ%' OR a.reference LIKE 'ARCH-TEST%'
  ORDER BY a.id DESC 
  LIMIT 10
`, (err, rows) => {
  if (err) {
    console.error('Erreur:', err);
  } else {
    console.table(rows);
  }
  db.close();
});
