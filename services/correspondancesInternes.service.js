const fs = require('fs');
const path = require('path');

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

async function listInternes({ db }) {
  return dbAll(db, 'SELECT * FROM correspondances_internes');
}

async function getInterneById({ db, id }) {
  return dbGet(db, 'SELECT * FROM correspondances_internes WHERE id = ?', [id]);
}

async function getInternesStats({ db, period, startDate, endDate }) {
  const where = [];
  const params = [];

  if (startDate) {
    where.push('created_at >= ?');
    params.push(startDate);
  }
  if (endDate) {
    where.push('created_at <= ?');
    params.push(endDate);
  } else if (period && period !== 'all') {
    const now = new Date().toISOString().slice(0, 10);
    let calcStart;
    if (period === 'today') calcStart = now;
    else if (period === '7d') calcStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    else if (period === '30d') calcStart = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    if (calcStart) {
      where.push('created_at >= ?');
      params.push(calcStart);
    }
    where.push('created_at <= ?');
    params.push(now);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const row = await dbGet(
    db,
    `SELECT 
      COUNT(*) AS total,
      COUNT(CASE WHEN statut_global = 'Nouveau' THEN 1 END) AS draft,
      COUNT(CASE WHEN statut_global = 'En cours' THEN 1 END) AS inProgress,
      COUNT(CASE WHEN statut_global = 'Traité' THEN 1 END) AS treated
    FROM correspondances_internes ${whereSql}`,
    params,
  );

  return row || { total: 0, draft: 0, inProgress: 0, treated: 0 };
}

async function createInterne({ db, payload, pieceJointe, createdBy }) {
  const { reference, destinataire, objet, date, fonction, type_document, metadata } = payload;

  if (!objet || !String(objet).trim() || !date || !String(date).trim() || !type_document || !String(type_document).trim()) {
    const err = new Error('Les champs objet, date et type de document sont requis');
    err.status = 400;
    throw err;
  }

  const stmt = `
    INSERT INTO correspondances_internes (reference, destinataire, objet, date, fonction, type_document, piece_jointe, metadata, statut_global, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    reference ? String(reference).trim() : null,
    destinataire ? String(destinataire).trim() : null,
    String(objet).trim(),
    String(date).trim(),
    fonction ? String(fonction).trim() : null,
    String(type_document).trim(),
    pieceJointe,
    metadata || null,
    'Nouveau',
    createdBy || 'admin',
    new Date().toISOString(),
  ];

  const result = await dbRun(db, stmt, values);
  return { id: result.lastID };
}

async function deleteInterne({ db, id, baseDir }) {
  const row = await dbGet(db, 'SELECT piece_jointe FROM correspondances_internes WHERE id = ?', [id]);
  if (!row) {
    const err = new Error('Correspondance interne non trouvée');
    err.status = 404;
    throw err;
  }

  const result = await dbRun(db, 'DELETE FROM correspondances_internes WHERE id = ?', [id]);
  if (!result.changes) {
    const err = new Error('Correspondance interne non trouvée');
    err.status = 404;
    throw err;
  }

  if (row.piece_jointe && baseDir) {
    const filePath = path.join(baseDir, row.piece_jointe);
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Erreur lors de la suppression du fichier :', err.message);
    });
  }

  return { deleted: true };
}

module.exports = {
  listInternes,
  getInterneById,
  getInternesStats,
  createInterne,
  deleteInterne,
};
