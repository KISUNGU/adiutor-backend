const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath,
  sqlite3.OPEN_READONLY,
  (err) => {
    if (err) return console.error('ERR open DB:', err.message);
  }
);

function q(sql, params=[]) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
}

function pragmaColumns(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []).map(r => r.name));
    });
  });
}

(async () => {
  try {
    const archivesCols = await pragmaColumns('archives');
    const incomingCols = await pragmaColumns('incoming_mails');

    const archivesCountRow = await q('SELECT COUNT(*) as c FROM archives');
    const archivesCount = archivesCountRow[0] ? archivesCountRow[0].c : 0;

    // Build safe select for archives (avoid referencing missing columns)
    const archiveSelectCols = ['id','reference','incoming_mail_id'];
    if (archivesCols.includes('archived_date')) archiveSelectCols.push('archived_date AS archived_date');
    else if (archivesCols.includes('date')) archiveSelectCols.push('date AS archived_date');
    if (archivesCols.includes('file_path')) archiveSelectCols.push('file_path');

    const archivesSample = await q(`SELECT ${archiveSelectCols.join(', ')} FROM archives ORDER BY id DESC LIMIT 10`);

    // incoming_mails archived count safe
    const hasStatutGlobal = incomingCols.includes('statut_global');
    const hasDateArchivage = incomingCols.includes('date_archivage');
    let incomingArchivedCount = 0;
    if (hasStatutGlobal && hasDateArchivage) {
      const row = await q("SELECT COUNT(*) as c FROM incoming_mails WHERE statut_global = 'Archivé' OR date_archivage IS NOT NULL");
      incomingArchivedCount = row[0] ? row[0].c : 0;
    } else if (hasStatutGlobal) {
      const row = await q("SELECT COUNT(*) as c FROM incoming_mails WHERE statut_global = 'Archivé'");
      incomingArchivedCount = row[0] ? row[0].c : 0;
    } else {
      // Fallback: zero
      incomingArchivedCount = 0;
    }

    // incoming sample
    const incomingSelect = ['id','ref_code'];
    if (incomingCols.includes('statut_global')) incomingSelect.push('statut_global');
    if (incomingCols.includes('date_archivage')) incomingSelect.push('date_archivage');
    if (incomingCols.includes('archived_at')) incomingSelect.push('archived_at');
    const incomingSample = await q(`SELECT ${incomingSelect.join(', ')} FROM incoming_mails ORDER BY id DESC LIMIT 10`);

    console.log(JSON.stringify({
      database: dbPath,
      archives_columns: archivesCols,
      incoming_columns: incomingCols,
      archives_count: archivesCount,
      archives_sample: archivesSample,
      incoming_archived_count: incomingArchivedCount,
      incoming_sample: incomingSample
    }, null, 2));
  } catch (e) {
    console.error('Error querying DB:', e.message);
  } finally {
    db.close();
  }
})();
