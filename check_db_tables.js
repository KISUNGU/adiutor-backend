const db = require('./db/index');

// Lister toutes les tables
db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`, [], (err, rows) => {
  if (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
  
  console.log('📋 Tables dans la base de données:\n');
  rows.forEach(r => console.log('  -', r.name));
  
  // Vérifier si users existe
  console.log('\n👤 Utilisateurs dans la table users:');
  db.all(`SELECT id, username, email, role_id FROM users LIMIT 5`, [], (err2, users) => {
    if (err2) {
      console.error('❌ Erreur users:', err2.message);
    } else {
      console.table(users);
    }
    
    setTimeout(() => process.exit(0), 1000);
  });
});
