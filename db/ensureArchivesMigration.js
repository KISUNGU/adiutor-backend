module.exports = function ensureArchivesMigration(db) {
  if (!db) {
    throw new Error('ensureArchivesMigration: db is required');
  }

  // Migration "safe" de la table archives vers le schéma unifié.
  // Objectifs:
  // - Ne pas casser si le schéma legacy n'a pas (type/date/file_path/...)
  // - Ne pas supprimer la table legacy si la copie échoue
  // - Ne pas rerun la migration si la table est déjà au nouveau format
  db.all('PRAGMA table_info(archives)', (pragmaErr, columns) => {
    if (pragmaErr) {
      console.warn('⚠️ PRAGMA archives impossible (skip migration):', pragmaErr.message);
      return;
    }

    const existingColumns = columns.map((c) => c.name);
    const alreadyNewSchema = ['reference', 'type', 'date', 'file_path', 'status', 'created_at', 'updated_at']
      .every((c) => existingColumns.includes(c));
    if (alreadyNewSchema) {
      console.log('✅ Table archives déjà au nouveau schéma (migration ignorée).');
      return;
    }

    console.log('🔄 Migration archives: schéma legacy détecté:', existingColumns);

    const legacyTable = `archives_legacy_${Date.now()}`;
    db.run(`ALTER TABLE archives RENAME TO ${legacyTable}`, (renameLegacyErr) => {
      if (renameLegacyErr) {
        console.error('❌ Impossible de renommer la table archives (abort migration):', renameLegacyErr.message);
        return;
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS archives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference TEXT NOT NULL UNIQUE,
          type TEXT DEFAULT 'Courrier Entrant',
          date DATE NOT NULL,
          description TEXT,
          category TEXT,
          classeur TEXT,
          file_path TEXT,
          status TEXT DEFAULT 'Archivé',
          sender TEXT,
          service_code TEXT,
          incoming_mail_id INTEGER,
          extracted_text TEXT,
          summary TEXT,
          classification TEXT,
          ai_summary TEXT,
          ai_keywords TEXT,
          ai_priority TEXT,
          executed_task TEXT,
          coordo_annotation TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (incoming_mail_id) REFERENCES incoming_mails(id) ON DELETE SET NULL
        )
      `, (createErr) => {
        if (createErr) {
          console.error('❌ Erreur création nouvelle table archives:', createErr.message);
          db.run('DROP TABLE IF EXISTS archives', () => {
            db.run(`ALTER TABLE ${legacyTable} RENAME TO archives`, () => {});
          });
          return;
        }

        db.all(`PRAGMA table_info(${legacyTable})`, (legacyPragmaErr, legacyCols) => {
          if (legacyPragmaErr) {
            console.error('❌ PRAGMA legacy archives:', legacyPragmaErr.message);
            db.run('DROP TABLE IF EXISTS archives', () => {
              db.run(`ALTER TABLE ${legacyTable} RENAME TO archives`, () => {});
            });
            return;
          }

          const legacyColumnNames = legacyCols.map((c) => c.name);
          const has = (name) => legacyColumnNames.includes(name);

          const referenceExpr = has('reference') ? 'reference' : (has('id') ? `printf('ARCH-%d', id)` : `printf('ARCH-%s', randomblob(8))`);
          const typeExpr = has('type') ? `COALESCE(type, 'Courrier Entrant')` : `'Courrier Entrant'`;
          const dateExpr = has('date')
            ? 'date'
            : (has('archived_date') ? `COALESCE(substr(archived_date, 1, 10), date('now'))` : `date('now')`);
          const descriptionExpr = has('description') ? 'description' : 'NULL';
          const categoryExpr = has('category') ? `COALESCE(category, 'INCONNU')` : `'INCONNU'`;
          const classeurExpr = has('classeur') ? 'classeur' : 'NULL';
          const filePathExpr = has('file_path') ? 'file_path' : (has('document_path') ? 'document_path' : 'NULL');
          const statusExpr = has('status') ? `COALESCE(status, 'Archivé')` : `'Archivé'`;
          const senderExpr = has('sender') ? `COALESCE(sender, 'Inconnu')` : `'Inconnu'`;
          const serviceCodeExpr = has('service_code') ? 'service_code' : 'NULL';
          const incomingMailIdExpr = has('incoming_mail_id') ? 'incoming_mail_id' : 'NULL';
          const executedTaskExpr = has('executed_task') ? 'executed_task' : 'NULL';
          const extractedTextExpr = has('extracted_text') ? 'extracted_text' : 'NULL';
          const summaryExpr = has('summary') ? 'summary' : 'NULL';
          const classificationExpr = has('classification') ? 'classification' : 'NULL';
          const aiSummaryExpr = has('ai_summary') ? 'ai_summary' : 'NULL';
          const aiKeywordsExpr = has('ai_keywords') ? 'ai_keywords' : 'NULL';
          const aiPriorityExpr = has('ai_priority') ? 'ai_priority' : 'NULL';
          const coordoAnnotationExpr = has('coordo_annotation') ? 'coordo_annotation' : 'NULL';
          const createdAtExpr = has('created_at') ? 'created_at' : 'CURRENT_TIMESTAMP';
          const updatedAtExpr = has('updated_at') ? 'updated_at' : 'CURRENT_TIMESTAMP';

          const insertSql = `
            INSERT INTO archives (
              reference, type, date, description, category, classeur, file_path, status,
              sender, service_code, incoming_mail_id, extracted_text, summary, classification,
              ai_summary, ai_keywords, ai_priority, executed_task, coordo_annotation,
              created_at, updated_at
            )
            SELECT
              ${referenceExpr} as reference,
              ${typeExpr} as type,
              ${dateExpr} as date,
              ${descriptionExpr} as description,
              ${categoryExpr} as category,
              ${classeurExpr} as classeur,
              ${filePathExpr} as file_path,
              ${statusExpr} as status,
              ${senderExpr} as sender,
              ${serviceCodeExpr} as service_code,
              ${incomingMailIdExpr} as incoming_mail_id,
              ${extractedTextExpr} as extracted_text,
              ${summaryExpr} as summary,
              ${classificationExpr} as classification,
              ${aiSummaryExpr} as ai_summary,
              ${aiKeywordsExpr} as ai_keywords,
              ${aiPriorityExpr} as ai_priority,
              ${executedTaskExpr} as executed_task,
              ${coordoAnnotationExpr} as coordo_annotation,
              ${createdAtExpr} as created_at,
              ${updatedAtExpr} as updated_at
            FROM ${legacyTable}
          `;

          db.run(insertSql, (insertErr) => {
            if (insertErr) {
              console.error('❌ Erreur insertion archives migration:', insertErr.message);
              db.run('DROP TABLE IF EXISTS archives', () => {
                db.run(`ALTER TABLE ${legacyTable} RENAME TO archives`, () => {});
              });
              return;
            }

            db.run(`DROP TABLE IF EXISTS ${legacyTable}`, (dropErr) => {
              if (dropErr) {
                console.warn('⚠️ Impossible de supprimer la table legacy archives:', dropErr.message);
              } else {
                console.log('✅ Migration archives terminée.');
              }
            });
          });
        });
      });
    });
  });
};
