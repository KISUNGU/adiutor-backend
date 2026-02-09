/**
 * db/migrations.js
 * Gestion centralisée des migrations et schémas de base de données
 * 
 * ✅ Toutes les CREATE TABLE IF NOT EXISTS
 * ✅ Toutes les ALTER TABLE (ajout colonnes)
 * ✅ Migrations comptabilité
 * ✅ Exécuté UNE seule fois au démarrage
 * ✅ Aucun SQL dans server.js ou routes
 * ✅ Compatible SQLite + PostgreSQL via sql-compat.js
 */

const {
  autoIncrementPK,
  currentTimestamp,
  timestampType,
} = require('./sql-compat');

// Import de toutes les migrations existantes
const ensureIncomingMailsTable = require('./ensureIncomingMails');
const ensureHistoryTables = require('./ensureHistoryTables');
const ensureCourriersSortantsTable = require('./ensureCourriersSortants');
const ensureArchivesTable = require('./ensureArchives');
const ensureArchivesMigration = require('./ensureArchivesMigration');
const ensureServicesTable = require('./ensureServices');
const ensureRolesTable = require('./ensureRoles');
const ensureRolePermissionsTable = require('./ensureRolePermissions');
const { ensureMailSharesTables } = require('./ensureMailShares');
const runMigrations = require('./runMigrations');

/**
 * Ajoute des colonnes manquantes à une table (ALTER TABLE)
 * @param {object} db - Instance SQLite
 * @param {string} tableName - Nom de la table
 * @param {array} columns - [{name, ddl}, ...]
 * @param {object} opts - Options {statusColumn, backfillStatus}
 */
function ensureColumns(db, tableName, columns, opts = {}) {
  const { statusColumn = 'status', backfillStatus = true } = opts;
  
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) return reject(err);
      
      const existing = new Set((rows || []).map((r) => r.name));
      const missing = columns.filter((c) => c && c.name && c.ddl && !existing.has(c.name));
      
      if (missing.length === 0) {
        return resolve({ tableName, changed: false });
      }

      db.serialize(() => {
        let failed = false;
        
        for (const col of missing) {
          if (!col || !col.name || !col.ddl) {
            console.error('❌ Colonne ignorée (nom ou DDL manquant):', col);
            continue;
          }
          
          db.run(`ALTER TABLE ${tableName} ADD COLUMN ${col.ddl}`, [], (e) => {
            if (failed) return;
            if (e) {
              failed = true;
              return reject(e);
            }
          });
        }

        if (!backfillStatus) {
          return resolve({ tableName, changed: true });
        }

        // Backfill NULL/empty status avec valeur par défaut
        db.run(
          `UPDATE ${tableName} SET ${statusColumn} = 'BROUILLARD' WHERE ${statusColumn} IS NULL OR TRIM(${statusColumn}) = ''`,
          [],
          (e2) => {
            if (failed) return;
            if (e2) return reject(e2);
            resolve({ tableName, changed: true });
          }
        );
      });
    });
  });
}

/**
 * S'assure qu'un compte existe dans la table accounts
 * Crée le compte s'il n'existe pas
 */
function ensureAccountIdByCode(db, code, cb) {
  const accountCode = String(code ?? '').trim();
  if (!accountCode) return cb(new Error('account code missing'));

  const first = accountCode[0];
  const accountType =
    first === '6'
      ? 'CHARGE'
      : first === '7'
        ? 'PRODUIT'
        : first === '1'
          ? 'PASSIF'
          : 'ACTIF';

  db.get(`SELECT id FROM accounts WHERE TRIM(code) = ? LIMIT 1`, [accountCode], (err, row) => {
    if (err) return cb(err);
    if (row && row.id != null) return cb(null, row.id);

    db.run(
      `INSERT INTO accounts (code, name, type, created_at) VALUES (?, ?, ?, ${currentTimestamp()})`,
      [accountCode, accountCode, accountType],
      function (e2) {
        if (e2) return cb(e2);
        return cb(null, this.lastID);
      }
    );
  });
}

/**
 * Migrations tables d'authentification
 * Crée les tables : refresh_tokens, audit_logs
 */
function runAuthSchemaMigrations(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🔐 Exécution migrations authentification...');

      // Table refresh_tokens (pour JWT refresh)
      db.run(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id ${autoIncrementPK()},
          user_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          revoked_at TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Table audit_logs (pour détection brute-force et audit sécurité)
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id ${autoIncrementPK()},
          user_id INTEGER,
          user_email TEXT,
          action TEXT NOT NULL,
          module TEXT,
          entity_type TEXT,
          entity_id INTEGER,
          severity TEXT DEFAULT 'info',
          success INTEGER DEFAULT 1,
          ip TEXT,
          user_agent TEXT,
          meta TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // Index pour performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip)`);

      // Ajouter les colonnes manquantes si audit_logs existe déjà avec ancien schéma
      ensureColumns(db, 'audit_logs', [
        { name: 'user_email', ddl: 'user_email TEXT' },
        { name: 'module', ddl: 'module TEXT' },
        { name: 'entity_type', ddl: 'entity_type TEXT' },
        { name: 'entity_id', ddl: 'entity_id INTEGER' },
        { name: 'severity', ddl: "severity TEXT DEFAULT 'info'" },
        { name: 'success', ddl: 'success INTEGER DEFAULT 1' },
        { name: 'ip', ddl: 'ip TEXT' },
        { name: 'meta', ddl: 'meta TEXT' }
      ], { backfillStatus: false })
        .then(() => {
          // Ajouter la colonne full_name à la table users
          return ensureColumns(db, 'users', [
            { name: 'full_name', ddl: 'full_name TEXT' }
          ], { backfillStatus: false });
        })
        .then(() => {
          console.log('✅ Tables authentification créées');
          resolve();
        })
        .catch((err) => {
          console.error('❌ Erreur migration auth:', err);
          reject(err);
        });
    });
  });
}

/**
 * Migrations tables système (notifications, messages, security_alerts)
 */
function runSystemTablesMigrations(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🔔 Exécution migrations tables système...');

      // Table notifications
      db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id ${autoIncrementPK()},
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          titre TEXT NOT NULL,
          message TEXT NOT NULL,
          mail_id INTEGER,
          lu INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (mail_id) REFERENCES incoming_mails(id) ON DELETE CASCADE
        )
      `);

      // Table messages (pour l'agent AI)
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id ${autoIncrementPK()},
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table security_alerts
      db.run(`
        CREATE TABLE IF NOT EXISTS security_alerts (
          id ${autoIncrementPK()},
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT,
          severity TEXT DEFAULT 'medium',
          status TEXT DEFAULT 'active',
          source TEXT,
          meta TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Index pour performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_lu ON notifications(lu)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type)`);

      console.log('✅ Tables système créées');
      resolve();
    });
  });
}

/**
 * Migrations gestion documentaire (Type_Document, classeurs)
 */
function runDocumentManagementMigrations(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('📁 Exécution migrations gestion documentaire...');

      // Table Type_Document
      db.run(`
        CREATE TABLE IF NOT EXISTS Type_Document (
          id_type_document ${autoIncrementPK()},
          nom_type TEXT NOT NULL UNIQUE
        )
      `);

      // Table annexes (pour les fichiers joints aux courriers)
      db.run(`
        CREATE TABLE IF NOT EXISTS annexes (
          id ${autoIncrementPK()},
          incoming_mail_id INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_type TEXT,
          file_size INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (incoming_mail_id) REFERENCES incoming_mails(id) ON DELETE CASCADE
        )
      `);

      // Index pour performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_annexes_incoming_mail ON annexes(incoming_mail_id)`);

      // Table archive_annexes (pour stocker les annexes des archives)
      db.run(`
        CREATE TABLE IF NOT EXISTS archive_annexes (
          id ${autoIncrementPK()},
          archive_id INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_type TEXT,
          file_size INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE CASCADE
        )
      `);

      // Index pour performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_archive_annexes_archive ON archive_annexes(archive_id)`);

      // Insérer des types de documents par défaut
      const defaultTypes = [
        'Courrier entrant',
        'Courrier sortant',
        'Note de service',
        'Rapport',
        'Facture',
        'Contrat',
        'Convention',
        'Décision',
        'Arrêté',
        'Circulaire',
        'Mémorandum',
        'Procès-verbal',
        'Compte-rendu',
        'Attestation',
        'Certificat',
        'Lettre officielle',
        'Demande',
        'Réponse',
        'Transmission',
        'Archive'
      ];

      const stmt = db.prepare('INSERT OR IGNORE INTO Type_Document (nom_type) VALUES (?)');
      defaultTypes.forEach(type => stmt.run(type));
      stmt.finalize();

      console.log('✅ Tables gestion documentaire créées');
      resolve();
    });
  });
}

/**
 * Migrations spécifiques comptabilité
 * Crée les tables : accounts, journal_entries, journal_lines, ecritures_comptables, achats, paiements
 */
function runAccountingSchemaMigrations(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('📊 Exécution migrations comptabilité...');

      // Table accounts
      db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id ${autoIncrementPK()},
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table journal_entries
      db.run(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id ${autoIncrementPK()},
          date TEXT,
          reference TEXT,
          description TEXT,
          status TEXT DEFAULT 'DRAFT',
          payment_method TEXT,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          journal TEXT,
          piece_path TEXT,
          piece_hash TEXT,
          tiers TEXT,
          controlled_at DATETIME,
          controlled_by INTEGER,
          validated_at DATETIME,
          validated_by INTEGER
        )
      `);

      // Table journal_lines
      db.run(`
        CREATE TABLE IF NOT EXISTS journal_lines (
          id ${autoIncrementPK()},
          journal_entry_id INTEGER NOT NULL,
          account_id INTEGER NOT NULL,
          debit REAL DEFAULT 0,
          credit REAL DEFAULT 0,
          FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
      `);

      // Table ecritures_comptables
      db.run(`
        CREATE TABLE IF NOT EXISTS ecritures_comptables (
          id ${autoIncrementPK()},
          date_ecriture TEXT,
          numero_piece TEXT NOT NULL UNIQUE,
          journal TEXT,
          compte_debit TEXT,
          compte_credit TEXT,
          montant REAL,
          libelle TEXT,
          tiers TEXT,
          piece_path TEXT,
          piece_hash TEXT,
          reference_operation_caisse TEXT,
          statut TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          controlled_at DATETIME,
          controlled_by INTEGER,
          validated_at DATETIME,
          validated_by INTEGER
        )
      `);

      // Table achats
      db.run(`
        CREATE TABLE IF NOT EXISTS achats (
          id ${autoIncrementPK()},
          date TEXT NOT NULL,
          supplier TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          piece_path TEXT,
          piece_hash TEXT,
          compte_debit TEXT,
          compte_credit TEXT,
          status TEXT DEFAULT 'BROUILLARD',
          controlled_at DATETIME,
          controlled_by INTEGER,
          validated_at DATETIME,
          validated_by INTEGER
        )
      `);

      // Table paiements
      db.run(`
        CREATE TABLE IF NOT EXISTS paiements (
          id ${autoIncrementPK()},
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          compte TEXT DEFAULT 'Compte courant',
          piece_path TEXT,
          piece_hash TEXT,
          compte_debit TEXT,
          compte_credit TEXT,
          status TEXT DEFAULT 'BROUILLARD',
          controlled_at DATETIME,
          controlled_by INTEGER,
          validated_at DATETIME,
          validated_by INTEGER
        )
      `);

      console.log('✅ Tables comptabilité créées');

      // Ajout colonnes manquantes achats
      const achatsColumns = [
        { name: 'piece_path', ddl: 'piece_path TEXT' },
        { name: 'piece_hash', ddl: 'piece_hash TEXT' },
        { name: 'compte_debit', ddl: 'compte_debit TEXT' },
        { name: 'compte_credit', ddl: 'compte_credit TEXT' },
        { name: 'status', ddl: "status TEXT DEFAULT 'BROUILLARD'" },
        { name: 'controlled_at', ddl: 'controlled_at DATETIME' },
        { name: 'controlled_by', ddl: 'controlled_by INTEGER' },
        { name: 'validated_at', ddl: 'validated_at DATETIME' },
        { name: 'validated_by', ddl: 'validated_by INTEGER' },
      ];

      // Ajout colonnes manquantes paiements
      const paiementsColumns = [
        { name: 'piece_path', ddl: 'piece_path TEXT' },
        { name: 'piece_hash', ddl: 'piece_hash TEXT' },
        { name: 'compte_debit', ddl: 'compte_debit TEXT' },
        { name: 'compte_credit', ddl: 'compte_credit TEXT' },
        { name: 'status', ddl: "status TEXT DEFAULT 'BROUILLARD'" },
        { name: 'controlled_at', ddl: 'controlled_at DATETIME' },
        { name: 'controlled_by', ddl: 'controlled_by INTEGER' },
        { name: 'validated_at', ddl: 'validated_at DATETIME' },
        { name: 'validated_by', ddl: 'validated_by INTEGER' },
      ];

      Promise.all([
        ensureColumns(db, 'achats', achatsColumns, { statusColumn: 'status', backfillStatus: true }),
        ensureColumns(db, 'paiements', paiementsColumns, { statusColumn: 'status', backfillStatus: true })
      ])
        .then(() => {
          console.log('✅ Colonnes comptabilité synchronisées');
          resolve();
        })
        .catch((err) => {
          console.error('❌ Erreur migration colonnes comptabilité:', err.message);
          reject(err);
        });
    });
  });
}

/**
 * Point d'entrée principal : exécute TOUTES les migrations
 * À appeler UNE SEULE FOIS au démarrage dans server.js
 */
async function runAllMigrations(db) {
  console.log('🚀 Démarrage migrations base de données...');

  try {
    // 1. Tables principales (ordre important: dépendances)
    console.log('📦 Création tables principales...');
    await ensureIncomingMailsTable(db);
    await ensureHistoryTables(db);
    await ensureCourriersSortantsTable(db);
    await ensureArchivesTable(db);
    await ensureArchivesMigration(db);
    await ensureServicesTable(db);
    await ensureRolesTable(db);
    await ensureRolePermissionsTable(db);
    await ensureMailSharesTables(db);
    
    // 2. Migrations authentification (refresh_tokens, audit_logs)
    await runAuthSchemaMigrations(db);
    
    // 3. Migrations tables système (notifications, messages, security_alerts)
    await runSystemTablesMigrations(db);
    
    // 4. Migrations gestion documentaire (Type_Document)
    await runDocumentManagementMigrations(db);
    
    // 5. Migrations générales (autres tables)
    // Gérer les erreurs de manière non-fatale car certaines migrations
    // peuvent dépendre de tables pas encore créées
    console.log('📦 Exécution migrations générales...');
    try {
      await runMigrations(db);
    } catch (migErr) {
      console.warn('⚠️  Certaines migrations ont échoué (non-fatal):', migErr.message);
    }

    // 6. Migrations comptabilité
    await runAccountingSchemaMigrations(db);

    // 7. Ajout colonnes supplémentaires sur incoming_mails
    await ensureColumns(db, 'incoming_mails', [
      { name: 'courrier_nature', ddl: 'courrier_nature TEXT' },
      { name: 'id_type_document', ddl: 'id_type_document INTEGER' },
      { name: 'is_mission_doc', ddl: 'is_mission_doc INTEGER DEFAULT 0' },
      { name: 'mission_reference', ddl: 'mission_reference TEXT' },
      { name: 'date_retour_mission', ddl: 'date_retour_mission TEXT' },
      { name: 'date_archivage', ddl: 'date_archivage TEXT' },
      { name: 'qr_code_path', ddl: 'qr_code_path TEXT' },
      { name: 'ar_pdf_path', ddl: 'ar_pdf_path TEXT' },
      { name: 'response_required', ddl: 'response_required INTEGER DEFAULT 0' },
      { name: 'response_due', ddl: 'response_due TEXT' },
      { name: 'response_outgoing_id', ddl: 'response_outgoing_id INTEGER' },
      { name: 'response_created_at', ddl: 'response_created_at TEXT' },
      { name: 'annexes', ddl: 'annexes TEXT' },
      { name: 'id_classement', ddl: 'id_classement INTEGER' },
      { name: 'date_annotation_dg', ddl: 'date_annotation_dg TEXT' },
      { name: 'service_orientation_dg', ddl: 'service_orientation_dg TEXT' },
      { name: 'annotation_dg', ddl: 'annotation_dg TEXT' },
      { name: 'user_reception', ddl: 'user_reception INTEGER' },
      { name: 'recipient', ddl: 'recipient TEXT' },
      { name: 'date_indexation', ddl: 'date_indexation TEXT' },
      { name: 'extracted_text', ddl: 'extracted_text TEXT' },
      { name: 'keywords', ddl: 'keywords TEXT' },
      { name: 'classification', ddl: 'classification TEXT' },
      { name: 'assigned_to', ddl: 'assigned_to INTEGER' },
      { name: 'traitement_effectue', ddl: 'traitement_effectue TEXT' },
      { name: 'reference_unique', ddl: 'reference_unique TEXT' },
      { name: 'uuid', ddl: 'uuid TEXT' },
      { name: 'date_reception', ddl: 'date_reception TEXT' },
      { name: 'mail_date', ddl: 'mail_date TEXT' },
      { name: 'numero_acquisition', ddl: 'numero_acquisition TEXT' },
      { name: 'file_path', ddl: 'file_path TEXT' },
      { name: 'statut_global', ddl: 'statut_global TEXT' },
      { name: 'summary', ddl: 'summary TEXT' },
      { name: 'type_courrier', ddl: 'type_courrier TEXT' },
      { name: 'indexed_function_id', ddl: 'indexed_function_id INTEGER' },
      { name: 'assigned_service', ddl: 'assigned_service TEXT' },
      { name: 'urgent', ddl: 'urgent INTEGER DEFAULT 0' },
      { name: 'ai_summary', ddl: 'ai_summary TEXT' },
      { name: 'ai_keywords', ddl: 'ai_keywords TEXT' },
      { name: 'ai_priority', ddl: 'ai_priority TEXT' },
      { name: 'numero_archivage_general', ddl: 'numero_archivage_general TEXT' }
    ]).catch((err) => {
      console.warn('⚠️  Migration colonnes incoming_mails ignorée:', err.message);
    });

    // 8. Synchroniser arrival_date avec date_reception pour les lignes existantes
    console.log('🔄 Synchronisation arrival_date...');
    await new Promise((resolve) => {
      db.run(`UPDATE incoming_mails SET arrival_date = date_reception WHERE arrival_date IS NULL AND date_reception IS NOT NULL`, (err) => {
        if (err) {
          console.warn('⚠️  Sync arrival_date ignoré:', err.message);
        } else {
          console.log('✅ arrival_date synchronisé avec date_reception');
        }
        resolve();
      });
    });

    // 9. Ajout colonnes archives sur services
    await ensureColumns(db, 'services', [
      { name: 'has_archive_page', ddl: 'has_archive_page INTEGER DEFAULT 0' },
      { name: 'archive_icon', ddl: 'archive_icon TEXT' },
      { name: 'archive_color', ddl: 'archive_color TEXT' }
    ], { backfillStatus: false }).catch((err) => {
      console.warn('⚠️  Migration colonnes services ignorée:', err.message);
    });

    console.log('✅ Toutes les migrations exécutées avec succès');
  } catch (error) {
    console.error('❌ Erreur lors des migrations:', error.message);
    throw error;
  }
}

module.exports = {
  runAllMigrations,
  ensureColumns,
  ensureAccountIdByCode,
  runAccountingSchemaMigrations,
  runAuthSchemaMigrations,
  runSystemTablesMigrations,
  runDocumentManagementMigrations
};
