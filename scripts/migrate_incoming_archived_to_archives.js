const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'databasepnda.db');
const BACKUP_PATH = DB_PATH + '.bak.' + Date.now();

console.log('DB path:', DB_PATH);

// Create a backup copy first
try {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('Backup created at', BACKUP_PATH);
} catch (err) {
  console.error('Failed to create DB backup:', err.message);
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);

// Query incoming_mails flagged as archived
const selectSql = `
  SELECT * FROM incoming_mails
  WHERE (statut_global = 'Archivé' OR status = 'Archivé' OR archived_at IS NOT NULL)
`;

db.all(selectSql, [], (err, rows) => {
  if (err) {
    console.error('Erreur lecture incoming_mails:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('Found', rows.length, 'incoming_mails marked archived.');
  if (!rows.length) {
    db.close();
    process.exit(0);
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const insertSql = `
      INSERT INTO archives (
        reference, category, description, classeur, archived_date, document_path, incoming_mail_id, is_copy, executed_task
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let inserted = 0;
    let skipped = 0;

    rows.forEach((r) => {
      try {
        const reference = r.ref_code || `IMPORT_${Date.now()}_${r.id}`;
        const description = r.subject || r.comment || '';
        const classeur = r.classeur || null;
        const archived_date = r.archived_at || r.created_at || new Date().toISOString();
        const document_path = r.document_path || r.file_path || '';
        const category = null;
        const is_copy = 0;
        const executed_task = null;

        db.run(insertSql, [reference, category, description, classeur, archived_date, document_path, r.id, is_copy, executed_task], function(insertErr) {
          if (insertErr) {
            // Unique constraint or other error: skip and log
            console.warn(`Skipping incoming_mail id=${r.id} (ref=${reference}) - insert error:`, insertErr.message);
            skipped += 1;
          } else {
            inserted += 1;
            console.log(`Inserted archive id=${this.lastID} from incoming_mail id=${r.id} (ref=${reference})`);
          }
        });
      } catch (e) {
        console.error('Unexpected error processing row id=', r.id, e.message);
        skipped += 1;
      }
    });

    // Wait briefly to ensure all async runs completed, then commit
    setTimeout(() => {
      db.run('COMMIT', (commitErr) => {
        if (commitErr) console.error('Commit error:', commitErr.message);
        console.log('Migration complete. Inserted:', inserted, 'Skipped:', skipped);
        console.log('If you want to revert, restore the backup file at', BACKUP_PATH);
        db.close();
      });
    }, 800);
  });
});
