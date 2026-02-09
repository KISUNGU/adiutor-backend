module.exports = function createCourriersSortantsRepo(db) {
  if (!db) throw new Error('courriersSortantsRepo: db is required');

  const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });

  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });

  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });

  return {
    getStats: (whereSql, params) =>
      dbGet(
        `SELECT 
          COUNT(*) AS total,
          COUNT(CASE WHEN statut = 'brouillon' THEN 1 END) AS draft,
          COUNT(CASE WHEN statut = 'valide' THEN 1 END) AS validated,
          COUNT(CASE WHEN statut = 'envoye' THEN 1 END) AS sent
        FROM courriers_sortants ${whereSql}`,
        params,
      ),

    insertCourrier: (payload) =>
      dbRun(
        `INSERT INTO courriers_sortants 
          (user_id, entete, courrier, pied, logo, statut, destinataire, objet, date_edition, reference_unique, uuid, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          payload.user_id,
          payload.entete,
          payload.courrier,
          payload.pied,
          payload.logo,
          payload.statut,
          payload.destinataire,
          payload.objet,
          payload.date_edition,
          payload.reference_unique,
          payload.uuid,
        ],
      ),

    listAll: () =>
      dbAll(
        `SELECT 
          id, user_id, entete, courrier, pied, logo, statut,
          reference_unique, uuid,
          original_filename, preview_pdf, extracted_text, scanned_receipt_path, original_file_path,
          destinataire, objet, date_edition,
          created_at, updated_at, validated_by, validated_at
        FROM courriers_sortants
        ORDER BY datetime(created_at) DESC`,
      ),

    listValidation: () =>
      dbAll(
        `SELECT 
          id, user_id, entete, courrier, pied, logo, statut,
          original_filename, preview_pdf, extracted_text, scanned_receipt_path, original_file_path,
          destinataire, objet, date_edition,
          created_at, updated_at, validated_by, validated_at
        FROM courriers_sortants
        WHERE statut = 'brouillon'
        ORDER BY datetime(created_at) DESC`,
      ),

    getById: (id) => dbGet(`SELECT * FROM courriers_sortants WHERE id = ?`, [id]),

    getByIdBasic: (id) => dbGet(`SELECT id, user_id, reference_unique, statut FROM courriers_sortants WHERE id = ?`, [id]),

    updateImport: (payload) =>
      dbRun(
        `UPDATE courriers_sortants
         SET courrier = ?,
             extracted_text = ?,
             original_filename = ?,
             original_file_path = ?,
             destinataire = ?,
             objet = ?,
             date_edition = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [
          payload.courrier,
          payload.extracted_text,
          payload.original_filename,
          payload.original_file_path,
          payload.destinataire,
          payload.objet,
          payload.date_edition,
          payload.id,
        ],
      ),

    insertImportNew: (payload) =>
      dbRun(
        `INSERT INTO courriers_sortants (user_id, courrier, extracted_text, original_filename, original_file_path, statut, destinataire, objet, date_edition, reference_unique, uuid, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          payload.user_id,
          payload.courrier,
          payload.extracted_text,
          payload.original_filename,
          payload.original_file_path,
          payload.statut,
          payload.destinataire,
          payload.objet,
          payload.date_edition,
          payload.reference_unique,
          payload.uuid,
        ],
      ),

    updateValidationStatus: (id, statut, validatedBy) =>
      dbRun(
        `UPDATE courriers_sortants 
         SET statut = ?, validated_by = ?, validated_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
        [statut, validatedBy, id],
      ),

    updateStatus: (id, statut) =>
      dbRun(`UPDATE courriers_sortants SET statut = ?, updated_at = datetime('now') WHERE id = ?`, [statut, id]),

    updateScan: (id, scanPath) =>
      dbRun(`UPDATE courriers_sortants SET scanned_receipt_path = ?, updated_at = datetime('now') WHERE id = ?`, [scanPath, id]),

    updateSend: (id) =>
      dbRun(`UPDATE courriers_sortants SET statut = 'envoye', updated_at = datetime('now') WHERE id = ?`, [id]),

    insertMailHistory: (id, userId, details) =>
      dbRun(
        `INSERT INTO mail_history (mail_id, action, timestamp, user_id, details)
         VALUES (?, 'Courrier sortant envoyé', datetime('now'), ?, ?)`,
        [id, userId, details],
      ),
  };
};
