module.exports = function ensureIncomingMailsTable(db) {
  if (!db) {
    throw new Error('ensureIncomingMailsTable: db is required');
  }

  // Table INCOMING_MAILS (Mise à jour pour ajouter response_due)
  db.run(`
    CREATE TABLE IF NOT EXISTS incoming_mails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_code TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      sender TEXT NOT NULL,
      arrival_date DATE NOT NULL,
      document_path TEXT,
      original_filename TEXT,
      status TEXT DEFAULT 'Nouveau', -- Nouveau, Indexé, En Traitement, Archivé, Rejeté
      comment TEXT,
      indexed_by TEXT,
      indexed_date DATE,
      assigned_to TEXT,
      classeur TEXT,
      qr_code_path TEXT, -- chemin image QR générée
      ar_pdf_path TEXT, -- chemin Accusé de Réception PDF
      response_due DATE, -- NOUVEAU: Date de réponse attendue
      response_required INTEGER DEFAULT 0, -- NOUVEAU: réponse requise (0/1)
      response_outgoing_id INTEGER, -- NOUVEAU: id du courrier sortant lié (brouillon/valide/envoye)
      response_created_at DATETIME, -- NOUVEAU: date de création de la réponse
      traitement_effectue INTEGER DEFAULT 0, -- 0/1 indicateur traitement réalisé
      return_comment TEXT, -- commentaire lors d'un retour vers l'indexation
      rejection_reason TEXT, -- raison en cas de rejet
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table incoming_mails:', err.message);
    } else {
      console.log("Table 'incoming_mails' prête.");
      db.all('PRAGMA table_info(incoming_mails)', (err2, info) => {
        const have = (name) => Array.isArray(info) && info.some((col) => col && col.name === name);

        if (info && !info.some((col) => col.name === 'response_due')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN response_due DATE', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne response_due:', alterErr.message);
            else console.log("Colonne 'response_due' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'courrier_nature')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN courrier_nature TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne courrier_nature:', alterErr.message);
            else console.log("✅ Colonne 'courrier_nature' ajoutée à incoming_mails.");
          });
        }
        if (!have('response_required')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN response_required INTEGER DEFAULT 0', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne response_required:', alterErr.message);
            else console.log("✅ Colonne 'response_required' ajoutée à incoming_mails.");
          });
        }
        if (!have('response_outgoing_id')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN response_outgoing_id INTEGER', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne response_outgoing_id:', alterErr.message);
            else console.log("✅ Colonne 'response_outgoing_id' ajoutée à incoming_mails.");
          });
        }
        if (!have('response_created_at')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN response_created_at DATETIME', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne response_created_at:', alterErr.message);
            else console.log("✅ Colonne 'response_created_at' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'qr_code_path')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN qr_code_path TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne qr_code_path:', alterErr.message);
            else console.log("Colonne 'qr_code_path' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'ar_pdf_path')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN ar_pdf_path TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne ar_pdf_path:', alterErr.message);
            else console.log("Colonne 'ar_pdf_path' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'classeur')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN classeur TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne classeur:', alterErr.message);
            else console.log("Colonne 'classeur' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'traitement_effectue')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN traitement_effectue INTEGER DEFAULT 0', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne traitement_effectue:', alterErr.message);
            else console.log("Colonne 'traitement_effectue' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'return_comment')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN return_comment TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne return_comment:', alterErr.message);
            else console.log("Colonne 'return_comment' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'rejection_reason')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN rejection_reason TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne rejection_reason:', alterErr.message);
            else console.log("Colonne 'rejection_reason' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'assigned_service')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN assigned_service TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne assigned_service:', alterErr.message);
            else console.log("Colonne 'assigned_service' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'category')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN category TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne category:', alterErr.message);
            else console.log("Colonne 'category' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'current_actor_role')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN current_actor_role TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne current_actor_role:', alterErr.message);
            else console.log("Colonne 'current_actor_role' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'service_disposition_at')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN service_disposition_at DATETIME', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne service_disposition_at:', alterErr.message);
            else console.log("Colonne 'service_disposition_at' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'treatment_started_at')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN treatment_started_at DATETIME', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne treatment_started_at:', alterErr.message);
            else console.log("Colonne 'treatment_started_at' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'treatment_completed_at')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN treatment_completed_at DATETIME', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne treatment_completed_at:', alterErr.message);
            else console.log("Colonne 'treatment_completed_at' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'financial_received_at')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN financial_received_at DATETIME', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne financial_received_at:', alterErr.message);
            else console.log("Colonne 'financial_received_at' ajoutée à incoming_mails.");
          });
        }

        if (!have('numero_acquisition')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN numero_acquisition TEXT', (alterErr) => {
            if (alterErr) {
              console.error('Erreur ajout colonne numero_acquisition:', alterErr.message);
            } else {
              console.log("✅ Colonne 'numero_acquisition' ajoutée à incoming_mails.");
              db.run(
                "UPDATE incoming_mails SET numero_acquisition = TRIM(ref_code) WHERE (numero_acquisition IS NULL OR TRIM(numero_acquisition) = '') AND ref_code IS NOT NULL AND TRIM(ref_code) <> ''",
                (e) => e && console.error('Backfill numero_acquisition error:', e.message),
              );
              db.run(
                'CREATE UNIQUE INDEX IF NOT EXISTS idx_incoming_mails_numero_acquisition ON incoming_mails(numero_acquisition)',
                (e) => e && console.error('Index numero_acquisition error:', e.message),
              );
            }
          });
        }

        if (!have('numero_finance')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN numero_finance TEXT', (alterErr) => {
            if (alterErr) {
              console.error('Erreur ajout colonne numero_finance:', alterErr.message);
            } else {
              console.log("✅ Colonne 'numero_finance' ajoutée à incoming_mails.");
              db.run(
                'CREATE UNIQUE INDEX IF NOT EXISTS idx_incoming_mails_numero_finance ON incoming_mails(numero_finance)',
                (e) => e && console.error('Index numero_finance error:', e.message),
              );
            }
          });
        }

        if (!have('numero_archivage_general')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN numero_archivage_general TEXT', (alterErr) => {
            if (alterErr) {
              console.error('Erreur ajout colonne numero_archivage_general:', alterErr.message);
            } else {
              console.log("✅ Colonne 'numero_archivage_general' ajoutée à incoming_mails.");
              db.run(
                'CREATE UNIQUE INDEX IF NOT EXISTS idx_incoming_mails_numero_archivage_general ON incoming_mails(numero_archivage_general)',
                (e) => e && console.error('Index numero_archivage_general error:', e.message),
              );
            }
          });
        }

        if (!have('ref_code')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN ref_code TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne ref_code:', alterErr.message);
            else console.log("✅ Colonne 'ref_code' ajoutée à incoming_mails.");
          });
        }
        if (!have('mail_date')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN mail_date DATE', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne mail_date:', alterErr.message);
            else {
              console.log("✅ Colonne 'mail_date' ajoutée à incoming_mails.");
              db.run('UPDATE incoming_mails SET mail_date = COALESCE(mail_date, arrival_date, created_at) WHERE mail_date IS NULL');
            }
          });
        }
        if (!have('date_reception')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN date_reception DATE', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne date_reception:', alterErr.message);
            else {
              console.log("✅ Colonne 'date_reception' ajoutée à incoming_mails.");
              db.run('UPDATE incoming_mails SET date_reception = COALESCE(date_reception, arrival_date, mail_date, created_at) WHERE date_reception IS NULL');
            }
          });
        }
        if (!have('file_path')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN file_path TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne file_path:', alterErr.message);
            else {
              console.log("✅ Colonne 'file_path' ajoutée à incoming_mails.");
              db.run("UPDATE incoming_mails SET file_path = COALESCE(file_path, document_path) WHERE (file_path IS NULL OR TRIM(file_path) = '') AND document_path IS NOT NULL");
            }
          });
        }
        if (!have('recipient')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN recipient TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne recipient:', alterErr.message);
            else console.log("✅ Colonne 'recipient' ajoutée à incoming_mails.");
          });
        }
        if (!have('summary')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN summary TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne summary:', alterErr.message);
            else console.log("✅ Colonne 'summary' ajoutée à incoming_mails.");
          });
        }
        if (!have('type_courrier')) {
          db.run("ALTER TABLE incoming_mails ADD COLUMN type_courrier TEXT DEFAULT 'Externe'", (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne type_courrier:', alterErr.message);
            else console.log("✅ Colonne 'type_courrier' ajoutée à incoming_mails.");
          });
        }
        if (!have('extracted_text')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN extracted_text TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne extracted_text:', alterErr.message);
            else console.log("✅ Colonne 'extracted_text' ajoutée à incoming_mails.");
          });
        }
        if (!have('embedding')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN embedding TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne embedding:', alterErr.message);
            else console.log("✅ Colonne 'embedding' ajoutée à incoming_mails.");
          });
        }
        if (!have('reference_unique')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN reference_unique TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne reference_unique:', alterErr.message);
            else console.log("✅ Colonne 'reference_unique' ajoutée à incoming_mails.");
          });
        }
        if (!have('uuid')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN uuid TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne uuid:', alterErr.message);
            else console.log("✅ Colonne 'uuid' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'archived_at')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN archived_at DATETIME', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne archived_at:', alterErr.message);
            else console.log("Colonne 'archived_at' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'file_hash')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN file_hash TEXT', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne file_hash:', alterErr.message);
            else console.log("✅ Colonne 'file_hash' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'partially_archived')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN partially_archived INTEGER DEFAULT 0', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne partially_archived:', alterErr.message);
            else console.log("Colonne 'partially_archived' ajoutée à incoming_mails.");
          });
        }
        if (info && !info.some((col) => col.name === 'partial_archive_date')) {
          db.run('ALTER TABLE incoming_mails ADD COLUMN partial_archive_date DATETIME', (alterErr) => {
            if (alterErr) console.error('Erreur ajout colonne partial_archive_date:', alterErr.message);
            else console.log("Colonne 'partial_archive_date' ajoutée à incoming_mails.");
          });
        }

        if (info && !info.some((col) => col.name === 'statut_global')) {
          db.run("ALTER TABLE incoming_mails ADD COLUMN statut_global TEXT DEFAULT 'Acquis'", (alterErr) => {
            if (alterErr) {
              console.error('Erreur ajout colonne statut_global:', alterErr.message);
            } else {
              console.log("Colonne 'statut_global' ajoutée à incoming_mails.");
              db.run(`UPDATE incoming_mails SET statut_global = 
                CASE 
                  WHEN status = 'Nouveau' THEN 'Acquis'
                  WHEN status = 'Indexé' THEN 'Indexé'
                  WHEN status = 'En Traitement' THEN 'En Traitement'
                  WHEN status = 'Archivé' THEN 'Archivé'
                  WHEN status = 'Rejeté' THEN 'Rejeté'
                  ELSE 'Acquis'
                END
                WHERE statut_global IS NULL OR statut_global = ''`, (migErr) => {
                if (migErr) console.error('Erreur migration status -> statut_global:', migErr.message);
                else console.log('✅ Données migrées: status -> statut_global');
              });
            }
          });
        }
      });
    }
  });
  
};
