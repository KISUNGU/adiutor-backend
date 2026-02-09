const fs = require('fs');
const path = require('path');

function ensureMigrationsTable(db) {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

function listMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function readMigrationSQL(filename) {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  return fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
}

function getAppliedMigrations(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT filename FROM schema_migrations', (err, rows) => {
      if (err) return reject(err);
      resolve(new Set((rows || []).map((r) => r.filename)));
    });
  });
}

function applyMigration(db, filename, sql) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN');
      db.exec(sql, (err) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        db.run(
          'INSERT INTO schema_migrations (filename) VALUES (?)',
          [filename],
          (insErr) => {
            if (insErr) {
              db.run('ROLLBACK');
              return reject(insErr);
            }
            db.run('COMMIT', (commitErr) => {
              if (commitErr) return reject(commitErr);
              resolve();
            });
          },
        );
      });
    });
  });
}

async function runMigrations(db, logger = console) {
  await ensureMigrationsTable(db);
  const files = listMigrationFiles();
  if (files.length === 0) return { applied: 0 };

  const applied = await getAppliedMigrations(db);
  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readMigrationSQL(file);
    logger.info?.(`Migration: applying ${file}`) || logger.log?.(`Migration: applying ${file}`);
    await applyMigration(db, file, sql);
    appliedCount += 1;
  }

  return { applied: appliedCount };
}

module.exports = runMigrations;
