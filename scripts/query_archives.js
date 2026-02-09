const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('databasepnda.db', sqlite3.OPEN_READONLY, (err) => {
  if (err) return console.error('DB open error:', err.message);
});

db.all('SELECT id, reference, date, incoming_mail_id FROM archives ORDER BY id DESC LIMIT 10', [], (err, rows) => {
  if (err) { console.error('Query error:', err.message); process.exit(1); }
  console.log('LATEST ARCHIVES:');
  console.log(rows);
  db.get('SELECT COUNT(*) as c FROM archives', [], (e, r) => {
    if (e) console.error('Count error:', e.message);
    else console.log('TOTAL ARCHIVES:', r.c);
    db.close();
  });
});
