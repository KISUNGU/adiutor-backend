function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function listPvByCategory({ db, category }) {
  return dbAll(db, 'SELECT * FROM pv WHERE category = ?', [category]);
}

async function listDirectory({ db }) {
  return dbAll(db, 'SELECT * FROM directory');
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function createPv({ db, title, category }) {
  const result = await dbRun(db, 'INSERT INTO pv (title, category) VALUES (?, ?)', [title, category]);
  return result.lastID;
}

async function createDirectoryEntry({ db, name, position, organization, email, category }) {
  const result = await dbRun(
    db,
    'INSERT INTO directory (name, position, organization, email, category) VALUES (?, ?, ?, ?, ?)',
    [name, position, organization, email, category],
  );
  return result.lastID;
}

async function listOutgoingMails({ db }) {
  const safeJson = (value) => {
    if (!value || typeof value !== 'string') return null;
    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  };

  try {
    const rows = await dbAll(
      db,
      `SELECT
        id,
        courrier,
        extracted_text,
        statut,
        created_at,
        updated_at,
        destinataire,
        objet,
        date_edition,
        reference_unique,
        uuid,
        original_filename,
        original_file_path,
        preview_pdf,
        scanned_receipt_path
      FROM courriers_sortants
      WHERE LOWER(COALESCE(NULLIF(TRIM(statut), ''), '')) IN ('valide','validé')
      ORDER BY datetime(created_at) DESC`,
    );

    return (rows || []).map((r) => {
      const c = safeJson(r.courrier) || {};
      return {
        id: r.id,
        reference: r.reference_unique || c.reference || c.reference_unique || c.numero_reference || `CS-${r.id}`,
        destinataire: r.destinataire || c.destinataire || c.recipient || '',
        sujet: r.objet || c.concerne || c.objet || c.subject || '',
        date: r.date_edition || c.date || c.date_edition || (typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : ''),
        statut: r.statut,
        created_at: r.created_at,
        updated_at: r.updated_at,
        uuid: r.uuid || null,
        original_filename: r.original_filename || null,
        original_file_path: r.original_file_path || null,
        preview_pdf: r.preview_pdf || null,
        scanned_receipt_path: r.scanned_receipt_path || null,
      };
    });
  } catch (err) {
    console.warn('⚠️ /api/mails/outgoing: fallback outgoing_mails:', err.message);
    const legacy = await dbAll(db, 'SELECT * FROM outgoing_mails');
    return legacy || [];
  }
}

module.exports = {
  listPvByCategory,
  listDirectory,
  listOutgoingMails,
  createPv,
  createDirectoryEntry,
};
