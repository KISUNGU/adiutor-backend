const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./adiutorai.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS courriers_sortants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entete TEXT,
      courrier TEXT,
      pied TEXT,
      logo TEXT,
      statut TEXT DEFAULT 'brouillon',
      original_filename TEXT,
      original_file_path TEXT,
      preview_pdf TEXT,
      extracted_text TEXT,
      scanned_receipt_path TEXT,
      archived_at TIMESTAMP,
      archived_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      validated_by INTEGER,
      validated_at TIMESTAMP,
      destinataire TEXT,
      objet TEXT,
      date_edition TEXT,
      reference_unique TEXT,
      uuid TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (validated_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error("Erreur création table:", err.message);
    } else {
      console.log("Table créée.");
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database closed successfully.');
  }
});