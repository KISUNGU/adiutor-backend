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

function getIncomingColumns() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info('incoming_mails')", [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.name));
    });
  });
}

(async () => {
  try {
    const cols = await getIncomingColumns();
    const hasStatus = cols.includes('status');
    const hasStatutGlobal = cols.includes('statut_global');
    const hasArchivedAt = cols.includes('archived_at');

    const whereParts = [];
    if (hasStatutGlobal) whereParts.push("statut_global = 'Archivé'");
    if (hasStatus) whereParts.push("status = 'Archivé'");
    if (hasArchivedAt) whereParts.push("archived_at IS NOT NULL");

    if (!whereParts.length) {
      console.log('No suitable archived indicators found on incoming_mails. Aborting.');
      db.close();
      return;
    }

    const selectSql = `SELECT * FROM incoming_mails WHERE (${whereParts.join(' OR ')})`;
    console.log('Select SQL:', selectSql);

    db.all(selectSql, [], (err, rows) => {
      if (err) {
        console.error('Error selecting incoming_mails:', err.message);
        db.close();
        process.exit(1);
      }

      console.log('Found', rows.length, 'rows to migrate.');
      if (!rows.length) {
        db.close();
        return;
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
        let pending = rows.length;

        rows.forEach((r) => {
          const reference = r.ref_code || `IMPORT_${Date.now()}_${r.id}`;
          const description = r.subject || r.comment || '';
          const classeur = r.classeur || null;
          const archived_date = (r.archived_at || r.treatment_completed_at || r.created_at) || new Date().toISOString();
          const document_path = r.document_path || r.file_path || '';
          const category = null;
          const is_copy = 0;
          const executed_task = null;

          db.run(insertSql, [reference, category, description, classeur, archived_date, document_path, r.id, is_copy, executed_task], function(insertErr) {
            if (insertErr) {
              console.warn(`Skip incoming_mail id=${r.id} ref=${reference} -> ${insertErr.message}`);
              skipped += 1;
            } else {
              inserted += 1;
              console.log(`Inserted archive id=${this.lastID} from incoming_mail id=${r.id}`);
            }

            pending -= 1;
            if (pending === 0) {
              db.run('COMMIT', (commitErr) => {
                if (commitErr) console.error('Commit failed:', commitErr.message);
                console.log('Migration finished. Inserted:', inserted, 'Skipped:', skipped);
                console.log('Backup is at', BACKUP_PATH);
                db.close();
              });
            }
          });
        });
      });
    });
  } catch (e) {
    console.error('Unexpected error:', e.message);
    db.close();
    process.exit(1);
  }
})();
