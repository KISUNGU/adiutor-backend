const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./databasepnda.db');

db.serialize(() => {
  const alters = [
    "ALTER TABLE courriers_sortants ADD COLUMN entete TEXT",
    "ALTER TABLE courriers_sortants ADD COLUMN pied TEXT",
    "ALTER TABLE courriers_sortants ADD COLUMN logo TEXT",
    "ALTER TABLE courriers_sortants ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE courriers_sortants ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE courriers_sortants ADD COLUMN validated_by INTEGER",
    "ALTER TABLE courriers_sortants ADD COLUMN validated_at TIMESTAMP"
  ];

  alters.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.log(`ALTER ${index} failed:`, err.message);
      } else {
        console.log(`ALTER ${index} succeeded`);
      }
    });
  });

  db.close((err) => {
    if (err) console.error('Close error:', err);
    else console.log('Database closed');
  });
});