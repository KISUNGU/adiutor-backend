const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/databasepnda.db', (err) => {
  if (err) {
    console.error('❌ Erreur connexion DB:', err);
    process.exit(1);
  }
});

console.log('🔧 Recréation table audit_logs avec schéma complet...');

db.serialize(() => {
  // Supprimer l'ancienne table
  db.run(`DROP TABLE IF EXISTS audit_logs`, (err) => {
    if (err) {
      console.error('❌ Erreur suppression table:', err);
      process.exit(1);
    }
    console.log('✅ Ancienne table audit_logs supprimée');
  });

  // Créer nouvelle table avec schéma complet
  db.run(`
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  `, (err) => {
    if (err) {
      console.error('❌ Erreur création table:', err);
      process.exit(1);
    }
    console.log('✅ Nouvelle table audit_logs créée avec schéma complet');
  });

  // Créer indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip)`, (err) => {
    if (err) {
      console.error('❌ Erreur création indexes:', err);
      process.exit(1);
    }
    console.log('✅ Indexes créés');
    
    // Vérifier schéma final
    db.all(`PRAGMA table_info(audit_logs)`, [], (err, rows) => {
      if (err) {
        console.error('❌ Erreur vérification schéma:', err);
        process.exit(1);
      }
      console.log('\n📋 Schéma final audit_logs:');
      rows.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
      });
      console.log('\n✅ Migration terminée avec succès!');
      db.close();
    });
  });
});
