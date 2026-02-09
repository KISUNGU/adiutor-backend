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

console.log('🔍 Vérification des utilisateurs dans la base...\n');

db.all(`SELECT id, username, email, password FROM users ORDER BY id LIMIT 5`, [], async (err, rows) => {
  if (err) {
    console.error('❌ Erreur lecture users:', err);
    process.exit(1);
  }

  console.log(`📊 ${rows.length} utilisateur(s) trouvé(s):\n`);

  for (const row of rows) {
    console.log(`ID: ${row.id}`);
    console.log(`Username: ${row.username}`);
    console.log(`Email: ${row.email}`);
    console.log(`Password hash: ${row.password ? row.password.substring(0, 30) + '...' : 'NULL'}`);
    
    // Tester les passwords possibles
    const possiblePasswords = ['admin4321', 'adminpassword', 'admin'];
    
    if (row.password) {
      for (const testPwd of possiblePasswords) {
        try {
          const isMatch = await bcrypt.compare(testPwd, row.password);
          if (isMatch) {
            console.log(`✅ Mot de passe valide: "${testPwd}"`);
            break;
          }
        } catch (e) {
          // Hash format invalide
        }
      }
    }
    
    console.log('---');
  }

  db.close();
});
