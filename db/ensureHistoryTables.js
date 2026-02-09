module.exports = function ensureHistoryTables(db) {
  if (!db) {
    throw new Error('ensureHistoryTables: db is required');
  }

  // Table MAIL_HISTORY (NOUVELLE TABLE pour la traçabilité)
  db.run(`
    CREATE TABLE IF NOT EXISTS mail_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mail_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      details TEXT,
      ip_address TEXT, -- 🔒 Adresse IP pour audit
      user_agent TEXT, -- 🔒 Navigateur/client pour traçabilité
      action_hash TEXT, -- 🔒 Hash SHA-256 de l'action pour intégrité
      FOREIGN KEY (mail_id) REFERENCES incoming_mails(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error("Erreur création table mail_history:", err.message);
    else console.log("Table 'mail_history' prête.");

    // Ajouter la colonne action_hash si absente (ancienne base)
    db.all('PRAGMA table_info(mail_history)', (err2, info) => {
      if (err2) return console.error('Erreur PRAGMA mail_history:', err2.message);
      const have = (name) => info && info.some((c) => c.name === name);
      if (!have('ip_address')) {
        db.run('ALTER TABLE mail_history ADD COLUMN ip_address TEXT', (e) => {
          if (e) console.error('Erreur ajout ip_address:', e.message);
          else console.log("✅ Colonne 'ip_address' ajoutée à mail_history.");
        });
      }
      if (!have('user_agent')) {
        db.run('ALTER TABLE mail_history ADD COLUMN user_agent TEXT', (e) => {
          if (e) console.error('Erreur ajout user_agent:', e.message);
          else console.log("✅ Colonne 'user_agent' ajoutée à mail_history.");
        });
      }
      if (!have('action_hash')) {
        db.run('ALTER TABLE mail_history ADD COLUMN action_hash TEXT', (e) => {
          if (e) console.error('Erreur ajout action_hash:', e.message);
          else console.log("✅ Colonne 'action_hash' ajoutée à mail_history.");
        });
      }
    });
  });

  // Table ENTITY_HISTORY (historique unifié: entrant/sortant/archives/etc)
  db.run(
    `CREATE TABLE IF NOT EXISTS entity_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL, -- ex: 'incoming_mails', 'courriers_sortants'
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      action_hash TEXT
    )`,
    (err) => {
      if (err) console.error('Erreur création table entity_history:', err.message);
      else console.log("Table 'entity_history' prête.");
    },
  );
};
