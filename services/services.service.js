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
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function listServices({ db, activeOnly }) {
  const sql = activeOnly
    ? 'SELECT * FROM services WHERE actif = 1 ORDER BY ordre ASC, nom ASC'
    : 'SELECT * FROM services ORDER BY ordre ASC, nom ASC';
  return dbAll(db, sql, []);
}

async function createService({ db, body }) {
  const { code, nom, description, actif, ordre, has_archive_page, archive_icon, archive_color } = body;
  if (!code || !nom) {
    const err = new Error('Code et nom sont obligatoires');
    err.status = 400;
    throw err;
  }

  try {
    const result = await dbRun(
      db,
      `INSERT INTO services (code, nom, description, actif, ordre, has_archive_page, archive_icon, archive_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code.toUpperCase(),
        nom,
        description || null,
        actif !== undefined ? actif : 1,
        ordre !== undefined ? ordre : 0,
        has_archive_page !== undefined ? has_archive_page : 0,
        archive_icon || 'cilStorage',
        archive_color || 'primary',
      ],
    );
    return { id: result.lastID, message: 'Service créé avec succès' };
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE constraint failed')) {
      err.status = 409;
      err.message = 'Ce code de service existe déjà';
    }
    throw err;
  }
}

async function updateService({ db, id, body }) {
  const { code, nom, description, actif, ordre, has_archive_page, archive_icon, archive_color } = body;
  if (!nom) {
    const err = new Error('Le nom est obligatoire');
    err.status = 400;
    throw err;
  }

  try {
    const result = await dbRun(
      db,
      `UPDATE services
       SET code = COALESCE(?, code),
           nom = ?,
           description = ?,
           actif = COALESCE(?, actif),
           ordre = COALESCE(?, ordre),
           has_archive_page = COALESCE(?, has_archive_page),
           archive_icon = COALESCE(?, archive_icon),
           archive_color = COALESCE(?, archive_color),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        code ? code.toUpperCase() : null,
        nom,
        description,
        actif !== undefined ? actif : null,
        ordre !== undefined ? ordre : null,
        has_archive_page !== undefined ? has_archive_page : null,
        archive_icon || null,
        archive_color || null,
        id,
      ],
    );

    if (!result.changes) {
      const err = new Error('Service non trouvé');
      err.status = 404;
      throw err;
    }

    return { message: 'Service modifié avec succès' };
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE constraint failed')) {
      err.status = 409;
      err.message = 'Ce code de service existe déjà';
    }
    throw err;
  }
}

async function deleteService({ db, id }) {
  const row = await dbGet(
    db,
    'SELECT COUNT(*) as count FROM incoming_mails WHERE assigned_service IN (SELECT code FROM services WHERE id = ?)',
    [id],
  );
  if (row && row.count > 0) {
    const err = new Error(`Ce service est assigné à ${row.count} courrier(s) et ne peut être supprimé`);
    err.status = 409;
    throw err;
  }

  const result = await dbRun(db, 'DELETE FROM services WHERE id = ?', [id]);
  if (!result.changes) {
    const err = new Error('Service non trouvé');
    err.status = 404;
    throw err;
  }

  return { message: 'Service supprimé avec succès' };
}

async function toggleService({ db, id }) {
  const result = await dbRun(
    db,
    'UPDATE services SET actif = 1 - actif, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
  );
  if (!result.changes) {
    const err = new Error('Service non trouvé');
    err.status = 404;
    throw err;
  }
  return { message: 'Statut du service modifié avec succès' };
}

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService,
  toggleService,
};
