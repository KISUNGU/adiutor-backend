const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'databasepnda.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur connexion DB:', err);
    process.exit(1);
  }
});

async function createLegacyAdmin() {
  console.log('🔧 Création utilisateur avec anciennes credentials...\n');

  const email = 'admin@mail.com';
  const username = 'admin_legacy';
  const password = 'adminpassword';
  
  // Vérifier si existe déjà
  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      console.error('❌ Erreur:', err);
      db.close();
      process.exit(1);
    }

    if (row) {
      console.log(`ℹ️  Utilisateur ${email} existe déjà (id=${row.id})`);
      
      // Mettre à jour le mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, email],
        (err) => {
          if (err) {
            console.error('❌ Erreur mise à jour:', err);
          } else {
            console.log('✅ Mot de passe mis à jour');
            console.log(`\n📋 Credentials:`);
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
          }
          db.close();
        }
      );
    } else {
      // Créer nouvel utilisateur
      const hashedPassword = await bcrypt.hash(password, 10);
      
      db.run(
        `INSERT INTO users (username, email, password, role_id, created_at)
         VALUES (?, ?, ?, 1, datetime('now'))`,
        [username, email, hashedPassword],
        function(err) {
          if (err) {
            console.error('❌ Erreur création:', err);
          } else {
            console.log(`✅ Utilisateur créé (id=${this.lastID})`);
            console.log(`\n📋 Credentials:`);
            console.log(`   Email: ${email}`);
            console.log(`   Username: ${username}`);
            console.log(`   Password: ${password}`);
            console.log(`   Role: ADMIN (role_id=1)`);
          }
          db.close();
        }
      );
    }
  });
}

createLegacyAdmin();
