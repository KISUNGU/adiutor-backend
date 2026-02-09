module.exports = function ensureCourriersSortantsTable(db) {
  if (!db) {
    throw new Error('ensureCourriersSortantsTable: db is required');
  }

  // Table COURRIERS_SORTANTS (NOUVELLE TABLE pour les courriers sortants)
  db.run(`
    CREATE TABLE IF NOT EXISTS courriers_sortants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entete TEXT, -- JSON: {pays, ministere, secretariat, projet, fonction}
      courrier TEXT, -- JSON (optionnel dans le nouveau flux d'import)
      pied TEXT, -- JSON: {adresse, tel, email}
      logo TEXT, -- Base64 ou URL du logo
      statut TEXT DEFAULT 'brouillon', -- brouillon, importe, en_attente_validation, envoye, valide, rejete
      original_filename TEXT, -- nom de fichier d'origine importé
      original_file_path TEXT, -- chemin /uploads/... du fichier original
      preview_pdf TEXT, -- chemin /uploads/... du PDF d'aperçu fidèle
      extracted_text TEXT, -- texte brut extrait
      scanned_receipt_path TEXT, -- chemin du scan avec AR après envoi
      archived_at TIMESTAMP,
      archived_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      validated_by INTEGER,
      validated_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (validated_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table courriers_sortants:', err.message);
      return;
    }

    console.log("Table 'courriers_sortants' prête.");
    db.all('PRAGMA table_info(courriers_sortants)', (perr, info) => {
      if (perr) return console.error('Erreur PRAGMA courriers_sortants:', perr.message);
      const have = (name) => info && info.some((c) => c.name === name);
      const alters = [];
      if (!have('user_id')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN user_id INTEGER');
      if (!have('entete')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN entete TEXT');
      if (!have('pied')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN pied TEXT');
      if (!have('logo')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN logo TEXT');
      if (!have('created_at')) alters.push("ALTER TABLE courriers_sortants ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      if (!have('updated_at')) alters.push("ALTER TABLE courriers_sortants ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      if (!have('validated_by')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN validated_by INTEGER');
      if (!have('validated_at')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN validated_at TIMESTAMP');
      if (!have('original_filename')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN original_filename TEXT');
      if (!have('original_file_path')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN original_file_path TEXT');
      if (!have('preview_pdf')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN preview_pdf TEXT');
      if (!have('extracted_text')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN extracted_text TEXT');
      if (!have('scanned_receipt_path')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN scanned_receipt_path TEXT');
      if (!have('courrier')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN courrier TEXT');
      if (!have('statut')) alters.push("ALTER TABLE courriers_sortants ADD COLUMN statut TEXT DEFAULT 'brouillon'");
      if (!have('destinataire')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN destinataire TEXT');
      if (!have('objet')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN objet TEXT');
      if (!have('date_edition')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN date_edition TEXT');
      if (!have('reference_unique')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN reference_unique TEXT');
      if (!have('uuid')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN uuid TEXT');
      if (!have('archived_at')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN archived_at TIMESTAMP');
      if (!have('archived_by')) alters.push('ALTER TABLE courriers_sortants ADD COLUMN archived_by INTEGER');
      alters.forEach((sql) => db.run(sql, (aerr) => aerr && console.error('ALTER courriers_sortants:', aerr.message)));
    });
  });
};
