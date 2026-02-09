function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
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

async function listPv({ db, category }) {
  let query = 'SELECT * FROM pv';
  const params = [];
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  query += ' ORDER BY date DESC';
  return dbAll(db, query, params);
}

async function createPv({ db, payload }) {
  const { title, category, date, location, participants, decisions, next_actions, file_path } = payload;
  const query = `INSERT INTO pv (title, category, date, location, participants, decisions, next_actions, file_path)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const result = await dbRun(db, query, [title, category, date, location, participants, decisions, next_actions, file_path]);
  return result.lastID;
}

async function updatePv({ db, id, payload }) {
  const { title, category, date, location, participants, decisions, next_actions, file_path } = payload;
  const query = `UPDATE pv SET title = ?, category = ?, date = ?, location = ?,
                 participants = ?, decisions = ?, next_actions = ?, file_path = ? WHERE id = ?`;
  const result = await dbRun(db, query, [title, category, date, location, participants, decisions, next_actions, file_path, id]);
  return result;
}

async function deletePv({ db, id }) {
  return dbRun(db, 'DELETE FROM pv WHERE id = ?', [id]);
}

async function listAnnuaire({ db, category }) {
  let query = 'SELECT * FROM directory';
  const params = [];
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  query += ' ORDER BY name ASC';
  return dbAll(db, query, params);
}

async function createAnnuaire({ db, payload }) {
  const { name, position, organization, email, phone, category } = payload;
  const query = `INSERT INTO directory (name, position, organization, email, phone, category)
                 VALUES (?, ?, ?, ?, ?, ?)`;
  const result = await dbRun(db, query, [name, position, organization, email, phone, category]);
  return result.lastID;
}

async function updateAnnuaire({ db, id, payload }) {
  const { name, position, organization, email, phone, category } = payload;
  const query = `UPDATE directory SET name = ?, position = ?, organization = ?,
                 email = ?, phone = ?, category = ? WHERE id = ?`;
  const result = await dbRun(db, query, [name, position, organization, email, phone, category, id]);
  return result;
}

async function deleteAnnuaire({ db, id }) {
  return dbRun(db, 'DELETE FROM directory WHERE id = ?', [id]);
}

async function listSecretariatContrats({ db, type }) {
  let query = 'SELECT * FROM contrats';
  const params = [];
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY date_debut DESC';
  return dbAll(db, query, params);
}

async function createSecretariatContrat({ db, payload }) {
  const { employe, type, date_debut, date_fin, salaire, details } = payload;
  const query = `INSERT INTO contrats (employe, type, date_debut, date_fin, salaire, details)
                 VALUES (?, ?, ?, ?, ?, ?)`;
  const result = await dbRun(db, query, [employe, type, date_debut, date_fin, salaire, details]);
  return result.lastID;
}

async function updateSecretariatContrat({ db, id, payload }) {
  const { employe, type, date_debut, date_fin, salaire, details } = payload;
  const query = `UPDATE contrats SET employe = ?, type = ?, date_debut = ?,
                 date_fin = ?, salaire = ?, details = ? WHERE id = ?`;
  const result = await dbRun(db, query, [employe, type, date_debut, date_fin, salaire, details, id]);
  return result;
}

async function deleteSecretariatContrat({ db, id }) {
  return dbRun(db, 'DELETE FROM contrats WHERE id = ?', [id]);
}

async function listSecretariatDocuments({ db, type }) {
  let query = 'SELECT * FROM correspondances_externes';
  const params = [];
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY date DESC';
  return dbAll(db, query, params);
}

async function createSecretariatDocument({ db, payload }) {
  const { reference, objet, destinataire, date, piece_jointe, type } = payload;
  const query = `INSERT INTO correspondances_externes (reference, objet, destinataire, date, piece_jointe, type)
                 VALUES (?, ?, ?, ?, ?, ?)`;
  const result = await dbRun(db, query, [reference, objet, destinataire, date, piece_jointe, type]);
  return result.lastID;
}

async function updateSecretariatDocument({ db, id, payload }) {
  const { reference, objet, destinataire, date, piece_jointe, type } = payload;
  const query = `UPDATE correspondances_externes SET reference = ?, objet = ?, destinataire = ?,
                 date = ?, piece_jointe = ?, type = ? WHERE id = ?`;
  const result = await dbRun(db, query, [reference, objet, destinataire, date, piece_jointe, type, id]);
  return result;
}

async function deleteSecretariatDocument({ db, id }) {
  return dbRun(db, 'DELETE FROM correspondances_externes WHERE id = ?', [id]);
}

module.exports = {
  listPv,
  createPv,
  updatePv,
  deletePv,
  listAnnuaire,
  createAnnuaire,
  updateAnnuaire,
  deleteAnnuaire,
  listSecretariatContrats,
  createSecretariatContrat,
  updateSecretariatContrat,
  deleteSecretariatContrat,
  listSecretariatDocuments,
  createSecretariatDocument,
  updateSecretariatDocument,
  deleteSecretariatDocument,
};
