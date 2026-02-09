module.exports = function ensureArchivesTable(db) {
  if (!db) {
    throw new Error('ensureArchivesTable: db is required');
  }

  // Table ARCHIVES
  db.run(`
    CREATE TABLE IF NOT EXISTS archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      category TEXT,
      description TEXT,
      classeur TEXT,
      archived_date DATE NOT NULL,
      document_path TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table archives:', err.message);
      return;
    }

    console.log("Table 'archives' prête.");
    db.all('PRAGMA table_info(archives)', (perr, info) => {
      if (perr) return console.error('Erreur PRAGMA archives:', perr.message);
      const has = (name) => info && info.some((c) => c.name === name);

      if (!has('classeur')) {
        db.run('ALTER TABLE archives ADD COLUMN classeur TEXT', (aerr) => {
          if (aerr) console.error('ALTER archives classeur:', aerr.message);
          else console.log('Colonne classeur ajoutée à archives');
        });
      }

      if (!has('incoming_mail_id')) {
        db.run('ALTER TABLE archives ADD COLUMN incoming_mail_id INTEGER', (aerr) => {
          if (aerr) console.error('ALTER archives incoming_mail_id:', aerr.message);
          else console.log('Colonne incoming_mail_id ajoutée à archives');
        });
      }

      if (!has('is_copy')) {
        db.run('ALTER TABLE archives ADD COLUMN is_copy INTEGER DEFAULT 0', (aerr) => {
          if (aerr) console.error('ALTER archives is_copy:', aerr.message);
          else console.log('Colonne is_copy ajoutée à archives');
        });
      }

      if (!has('executed_task')) {
        db.run('ALTER TABLE archives ADD COLUMN executed_task TEXT', (aerr) => {
          if (aerr) console.error('ALTER archives executed_task:', aerr.message);
          else console.log('Colonne executed_task ajoutée à archives');
        });
      }
    });

    // Backfill retardé et sécurisé: ne l'exécuter que si les colonnes nécessaires existent
    db.all('PRAGMA table_info(archives)', (aErr, aInfo) => {
      if (aErr) return console.error('PRAGMA archives (backfill):', aErr.message);
      const hasIncomingMailIdBF = aInfo && aInfo.some((c) => c.name === 'incoming_mail_id');
      if (!hasIncomingMailIdBF) {
        return;
      }
      db.all('PRAGMA table_info(incoming_mails)', (imErr, imInfo) => {
        if (imErr) return console.error('PRAGMA incoming_mails (backfill):', imErr.message);
        const hasClassification = imInfo && imInfo.some((c) => c.name === 'classification');
        const hasTypeCourrier = imInfo && imInfo.some((c) => c.name === 'type_courrier');
        const hasClasseurIM = imInfo && imInfo.some((c) => c.name === 'classeur');

        if (hasClassification || hasTypeCourrier) {
          const sources = [];
          if (hasClassification) sources.push("(SELECT classification FROM incoming_mails im WHERE im.id = archives.incoming_mail_id AND classification IS NOT NULL AND TRIM(classification) <> '')");
          if (hasTypeCourrier) sources.push("(SELECT type_courrier FROM incoming_mails im WHERE im.id = archives.incoming_mail_id AND type_courrier IS NOT NULL AND TRIM(type_courrier) <> '')");
          const sqlCat = `UPDATE archives\nSET category = COALESCE(${sources.join(', ')}, category)\nWHERE (category IS NULL OR TRIM(category) = '' OR category = 'INCONNU')\n  AND incoming_mail_id IS NOT NULL`;
          db.run(sqlCat, (uerrCat) => uerrCat && console.error('Backfill catégorie archives:', uerrCat.message));
        }

        if (hasClasseurIM) {
          const sqlCls = `UPDATE archives\nSET classeur = COALESCE(\n  (SELECT classeur FROM incoming_mails im WHERE im.id = archives.incoming_mail_id AND classeur IS NOT NULL AND TRIM(classeur) <> ''),\n  classeur\n)\nWHERE (classeur IS NULL OR TRIM(classeur) = '')\n  AND incoming_mail_id IS NOT NULL`;
          db.run(sqlCls, (uerrCls) => uerrCls && console.error('Backfill classeur archives:', uerrCls.message));
        }
      });
    });
  });
};
