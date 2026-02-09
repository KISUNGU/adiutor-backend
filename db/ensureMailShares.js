/**
 * Crée les tables pour le partage de courriers entre services
 */
function ensureMailSharesTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Table des partages de courriers
      db.run(`
        CREATE TABLE IF NOT EXISTS mail_shares (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          incoming_mail_id INTEGER NOT NULL,
          shared_by_user_id INTEGER NOT NULL,
          shared_from_service TEXT,
          shared_to_service TEXT NOT NULL,
          share_message TEXT,
          share_type TEXT DEFAULT 'info',
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          read_at DATETIME,
          responded_at DATETIME,
          FOREIGN KEY (incoming_mail_id) REFERENCES incoming_mails(id) ON DELETE CASCADE,
          FOREIGN KEY (shared_by_user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('Erreur création table mail_shares:', err);
          reject(err);
        } else {
          console.log("Table 'mail_shares' prête.");
        }
      });

      // Table des commentaires/contributions sur courriers partagés
      db.run(`
        CREATE TABLE IF NOT EXISTS mail_share_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mail_share_id INTEGER NOT NULL,
          incoming_mail_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          service_code TEXT,
          comment_text TEXT NOT NULL,
          comment_type TEXT DEFAULT 'comment',
          attachments TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mail_share_id) REFERENCES mail_shares(id) ON DELETE CASCADE,
          FOREIGN KEY (incoming_mail_id) REFERENCES incoming_mails(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('Erreur création table mail_share_comments:', err);
          reject(err);
        } else {
          console.log("Table 'mail_share_comments' prête.");
          resolve();
        }
      });
    });
  });
}

module.exports = { ensureMailSharesTables };
