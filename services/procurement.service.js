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

async function listPlanifications({ db }) {
  return dbAll(db, 'SELECT * FROM planifications');
}

async function createPlanification({ db, payload, pieceJointe, logAction }) {
  const { reference, description, budget, dateDebut, dateFin, statut } = payload;
  const result = await dbRun(
    db,
    `INSERT INTO planifications (reference, description, budget, dateDebut, dateFin, statut, piece_jointe) VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [reference, description, budget, dateDebut, dateFin, statut, pieceJointe],
  );
  logAction('planification', result.lastID, 'CREATE', `Planification ${reference} créée`);
  return result.lastID;
}

async function bulkPlanifications({ db, items, logAction }) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  return new Promise((resolve, reject) => {
    let inserted = 0;
    const stmt = db.prepare(
      `INSERT INTO planifications (reference, description, budget, dateDebut, dateFin, statut) VALUES (?, ?, ?, ?, ?, ?)`
    );
    items.forEach((p) => {
      stmt.run([p.reference, p.description, p.budget, p.dateDebut, p.dateFin, p.statut], function (err) {
        if (err) return reject(err);
        logAction('planification', this.lastID, 'CREATE', `Planification ${p.reference} importée`);
        inserted++;
        if (inserted === items.length) {
          stmt.finalize();
          resolve(inserted);
        }
      });
    });
  });
}

async function updatePlanification({ db, id, payload, pieceJointe, logAction }) {
  const { reference, description, budget, dateDebut, dateFin, statut } = payload;
  const result = await dbRun(
    db,
    `UPDATE planifications SET reference = ?, description = ?, budget = ?, dateDebut = ?, dateFin = ?, statut = ?, piece_jointe = ? WHERE id = ?`,
    [reference, description, budget, dateDebut, dateFin, statut, pieceJointe, id],
  );
  if (result.changes === 0) return { notFound: true };
  logAction('planification', id, 'UPDATE', `Planification ${reference} modifiée`);
  return { notFound: false };
}

async function listAppels({ db }) {
  return dbAll(db, 'SELECT * FROM appels');
}

async function createAppel({ db, payload, pieceJointe, logAction }) {
  const { reference, description, budget, datePublication, dateCloture, statut, etape } = payload;
  const result = await dbRun(
    db,
    `INSERT INTO appels (reference, description, budget, datePublication, dateCloture, statut, etape, piece_jointe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    [reference, description, budget, datePublication, dateCloture, statut, etape, pieceJointe],
  );
  logAction('appel', result.lastID, 'CREATE', `Appel d'offre ${reference} créé`);
  return result.lastID;
}

async function bulkAppels({ db, items, logAction }) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  return new Promise((resolve, reject) => {
    let inserted = 0;
    const stmt = db.prepare(
      `INSERT INTO appels (reference, description, budget, datePublication, dateCloture, statut, etape) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    items.forEach((a) => {
      stmt.run([a.reference, a.description, a.budget, a.datePublication, a.dateCloture, a.statut, a.etape], function (err) {
        if (err) return reject(err);
        logAction('appel', this.lastID, 'CREATE', `Appel d'offre ${a.reference} importé`);
        inserted++;
        if (inserted === items.length) {
          stmt.finalize();
          resolve(inserted);
        }
      });
    });
  });
}

async function updateAppel({ db, id, payload, pieceJointe, logAction }) {
  const { reference, description, budget, datePublication, dateCloture, statut, etape } = payload;
  const result = await dbRun(
    db,
    `UPDATE appels SET reference = ?, description = ?, budget = ?, datePublication = ?, dateCloture = ?, statut = ?, etape = ?, piece_jointe = ? WHERE id = ?`,
    [reference, description, budget, datePublication, dateCloture, statut, etape, pieceJointe, id],
  );
  if (result.changes === 0) return { notFound: true };
  logAction('appel', id, 'UPDATE', `Appel d'offre ${reference} modifié`);
  return { notFound: false };
}

async function listContrats({ db }) {
  return dbAll(db, 'SELECT * FROM contrats');
}

async function createContrat({ db, payload, pieceJointe, logAction }) {
  const { reference, appelId, appelReference, fournisseur, montant, dateSignature, dateFin, statut } = payload;
  const result = await dbRun(
    db,
    `INSERT INTO contrats (reference, appelId, appelReference, fournisseur, montant, dateSignature, dateFin, statut, piece_jointe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reference, appelId, appelReference, fournisseur, montant, dateSignature, dateFin, statut, pieceJointe],
  );
  logAction('contrat', result.lastID, 'CREATE', `Contrat ${reference} créé`);
  return result.lastID;
}

async function bulkContrats({ db, items, logAction }) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  return new Promise((resolve, reject) => {
    let inserted = 0;
    const stmt = db.prepare(
      `INSERT INTO contrats (reference, appelId, appelReference, fournisseur, montant, dateSignature, dateFin, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    items.forEach((c) => {
      stmt.run([c.reference, c.appelId, c.appelReference, c.fournisseur, c.montant, c.dateSignature, c.dateFin, c.statut], function (err) {
        if (err) return reject(err);
        logAction('contrat', this.lastID, 'CREATE', `Contrat ${c.reference} importé`);
        inserted++;
        if (inserted === items.length) {
          stmt.finalize();
          resolve(inserted);
        }
      });
    });
  });
}

async function updateContrat({ db, id, payload, pieceJointe, logAction }) {
  const { reference, appelId, appelReference, fournisseur, montant, dateSignature, dateFin, statut } = payload;
  const result = await dbRun(
    db,
    `UPDATE contrats SET reference = ?, appelId = ?, appelReference = ?, fournisseur = ?, montant = ?, dateSignature = ?, dateFin = ?, statut = ?, piece_jointe = ? WHERE id = ?`,
    [reference, appelId, appelReference, fournisseur, montant, dateSignature, dateFin, statut, pieceJointe, id],
  );
  if (result.changes === 0) return { notFound: true };
  logAction('contrat', id, 'UPDATE', `Contrat ${reference} modifié`);
  return { notFound: false };
}

async function listRapports({ db }) {
  return dbAll(db, 'SELECT * FROM rapports');
}

async function createRapport({ db, payload, pieceJointe, logAction }) {
  const { reference, appelId, appelReference, fournisseur, score, justification, dateAttribution, statut } = payload;
  const result = await dbRun(
    db,
    `INSERT INTO rapports (reference, appelId, appelReference, fournisseur, score, justification, dateAttribution, statut, piece_jointe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reference, appelId, appelReference, fournisseur, score, justification, dateAttribution, statut, pieceJointe],
  );
  logAction('rapport', result.lastID, 'CREATE', `Rapport ${reference} créé`);
  return result.lastID;
}

async function bulkRapports({ db, items, logAction }) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  return new Promise((resolve, reject) => {
    let inserted = 0;
    const stmt = db.prepare(
      `INSERT INTO rapports (reference, appelId, appelReference, fournisseur, score, justification, dateAttribution, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    items.forEach((r) => {
      stmt.run([r.reference, r.appelId, r.appelReference, r.fournisseur, r.score, r.justification, r.dateAttribution, r.statut], function (err) {
        if (err) return reject(err);
        logAction('rapport', this.lastID, 'CREATE', `Rapport ${r.reference} importé`);
        inserted++;
        if (inserted === items.length) {
          stmt.finalize();
          resolve(inserted);
        }
      });
    });
  });
}

async function updateRapport({ db, id, payload, pieceJointe, logAction }) {
  const { reference, appelId, appelReference, fournisseur, score, justification, dateAttribution, statut } = payload;
  const result = await dbRun(
    db,
    `UPDATE rapports SET reference = ?, appelId = ?, appelReference = ?, fournisseur = ?, score = ?, justification = ?, dateAttribution = ?, statut = ?, piece_jointe = ? WHERE id = ?`,
    [reference, appelId, appelReference, fournisseur, score, justification, dateAttribution, statut, pieceJointe, id],
  );
  if (result.changes === 0) return { notFound: true };
  logAction('rapport', id, 'UPDATE', `Rapport ${reference} modifié`);
  return { notFound: false };
}

module.exports = {
  listPlanifications,
  createPlanification,
  bulkPlanifications,
  updatePlanification,
  listAppels,
  createAppel,
  bulkAppels,
  updateAppel,
  listContrats,
  createContrat,
  bulkContrats,
  updateContrat,
  listRapports,
  createRapport,
  bulkRapports,
  updateRapport,
};
