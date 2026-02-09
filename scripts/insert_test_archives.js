/*
Script: insert_test_archives.js
- Creates a timestamped backup of ../databasepnda.db
- Ensures a minimal `archives_general` view exists (maps to `archives` table)
- Inserts 4 test rows into `archives` table using only columns that exist
- Prints inserted rows and totals

Run: node backend/scripts/insert_test_archives.js
*/

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

(async function main() {
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const dbPath = path.join(repoRoot, 'databasepnda.db');

    if (!fs.existsSync(dbPath)) {
      console.error('Database file not found at', dbPath);
      process.exit(1);
    }

    // 1) Backup
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(repoRoot, `databasepnda.db.bak.${stamp}`);
    fs.copyFileSync(dbPath, backupPath);
    console.log('Backup created at', backupPath);

    const db = new sqlite3.Database(dbPath);

    // Helper to run SQL returning a Promise
    function run(sql, params=[]) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) return reject(err);
          resolve(this);
        });
      });
    }

    function all(sql, params=[]) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    }

    // 2) Ensure view archives_general exists; if not, create minimal view
    const viewCheck = await all("SELECT name, type FROM sqlite_master WHERE type IN ('view','table') AND name = 'archives_general'");
    if (viewCheck.length === 0) {
      // If archives table exists, create view as SELECT * FROM archives
      const archivesTable = await all("SELECT name FROM sqlite_master WHERE type='table' AND name='archives'");
      if (archivesTable.length === 0) {
        console.warn("No 'archives' table found in DB. Aborting view creation and inserts.");
      } else {
        try {
          await run("CREATE VIEW IF NOT EXISTS archives_general AS SELECT * FROM archives;");
          console.log("Created view 'archives_general' as a simple mapping to 'archives'.");
        } catch (e) {
          console.warn('Failed to create view archives_general:', e.message);
        }
      }
    } else {
      console.log("View or object 'archives_general' already exists. Skipping view creation.");
    }

    // 3) Inspect columns of archives table
    const pragma = await all("PRAGMA table_info('archives');");
    if (!pragma || pragma.length === 0) {
      console.warn("Table 'archives' has no columns or does not exist. Aborting inserts.");
      db.close();
      process.exit(1);
    }

    const cols = pragma.map(c => c.name);
    console.log('Detected columns in archives table:', cols.join(', '));

    // We'll choose a set of candidate columns to populate if they exist.
    const candidateCols = [
      'reference','service_code','type','description','category','classeur','date','date_indexation','sender','coordo_annotation','annex_count','status','created_at'
    ];

    const insertCols = candidateCols.filter(c => cols.includes(c));
    if (insertCols.length === 0) {
      console.warn('No known columns found to insert test rows. Aborting.');
      db.close();
      process.exit(1);
    }

    // 4) Prepare test rows
    const nowiso = new Date().toISOString();
    const rows = [
      {
        reference: `REF-CAISSE-${stamp}`,
        service_code: 'CAISSE',
        type: 'Courrier Entrant',
        description: 'Test Entrant - document de la Caisse',
        category: 'Finance',
        classeur: 'CL-CAISSE-2025',
        date: nowiso,
        date_indexation: nowiso,
        sender: 'Fournisseur Test',
        coordo_annotation: JSON.stringify({note:'Test Entrant'}),
        annex_count: 1,
        status: 'Archivé',
        created_at: nowiso
      },
      {
        reference: `REF-COMPTABLE-${stamp}`,
        service_code: 'COMPTABLE',
        type: 'Courrier Sortant',
        description: 'Test Sortant - document comptable',
        category: 'Finance',
        classeur: 'CL-COMPTABLE-2025',
        date: nowiso,
        date_indexation: nowiso,
        sender: null,
        coordo_annotation: JSON.stringify({note:'Test Sortant'}),
        annex_count: 0,
        status: 'Archivé',
        created_at: nowiso
      },
      {
        reference: `REF-SECRETARIAT-${stamp}`,
        service_code: 'SECRETARIAT',
        type: 'Note Interne',
        description: 'Test Secrétariat - note interne',
        category: 'INCONNU',
        classeur: 'CL-SECRETARIAT-2025',
        date: nowiso,
        date_indexation: nowiso,
        sender: 'Interne',
        coordo_annotation: JSON.stringify({note:'Test Secrétariat'}),
        annex_count: 2,
        status: 'Archivé',
        created_at: nowiso
      },
      {
        reference: `REF-GENERAL-${stamp}`,
        service_code: 'GENERAL',
        type: 'Rapport',
        description: 'Test Général - Courrier_Général',
        category: 'INCONNU',
        classeur: 'CL-GENERAL-2025',
        date: nowiso,
        date_indexation: nowiso,
        sender: 'Système',
        coordo_annotation: JSON.stringify({note:'Test Général'}),
        annex_count: 0,
        status: 'Archivé',
        created_at: nowiso
      }
    ];

    // Build INSERT statement using only existing columns
    const colList = insertCols.join(', ');
    const placeholders = insertCols.map(_ => '?').join(', ');
    const insertSql = `INSERT INTO archives (${colList}) VALUES (${placeholders});`;

    console.log('Insert SQL will use columns:', insertCols.join(', '));

    const insertedIds = [];

    // Run inserts sequentially
    for (let r of rows) {
      const params = insertCols.map(c => {
        // map value or null
        if (r[c] === undefined) return null;
        return r[c];
      });
      try {
        const res = await run(insertSql, params);
        if (res && res.lastID) {
          insertedIds.push(res.lastID);
          console.log('Inserted row id:', res.lastID, 'reference:', r.reference);
        } else {
          console.log('Inserted row (no lastID available), reference:', r.reference);
        }
      } catch (e) {
        console.error('Error inserting row', r.reference, e.message);
      }
    }

    // Show count and sample rows
    const allRows = await all('SELECT id, reference, service_code, type, status, date FROM archives ORDER BY id DESC LIMIT 10');
    console.log('Sample rows (latest up to 10):');
    console.table(allRows);

    // Close DB
    db.close();

    console.log('Done. Inserted', insertedIds.length, 'test rows. Backup path:', backupPath);
  } catch (err) {
    console.error('Fatal error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
