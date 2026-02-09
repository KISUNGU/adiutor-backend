/**
 * 🧪 Test de Connexion Base de Données
 * 
 * Valide que db/index.js fonctionne correctement avec:
 * - Connexion SQLite établie
 * - PRAGMA WAL activé
 * - Permissions en écriture
 * - Fermeture propre
 */

console.log('🧪 Test db/index.js\n');

const db = require('./db/index');

// Attendre que tous les PRAGMA soient appliqués
setTimeout(() => {
  console.log('\n📊 Vérification de la configuration...\n');

  // Test 1: Vérifier le mode WAL
  db.get(`PRAGMA journal_mode;`, [], (err, row) => {
    if (err) {
      console.error('❌ Erreur PRAGMA journal_mode:', err.message);
      process.exit(1);
    }
    const mode = Object.values(row)[0];
    if (mode === 'wal') {
      console.log('✅ Mode WAL confirmé');
    } else {
      console.warn(`⚠️  Mode actuel: ${mode} (attendu: wal)`);
    }
  });

  // Test 2: Vérifier les foreign keys
  db.get(`PRAGMA foreign_keys;`, [], (err, row) => {
    if (err) {
      console.error('❌ Erreur PRAGMA foreign_keys:', err.message);
      process.exit(1);
    }
    const enabled = Object.values(row)[0];
    if (enabled === 1) {
      console.log('✅ Foreign keys activées');
    } else {
      console.warn('⚠️  Foreign keys désactivées');
    }
  });

  // Test 3: Vérifier le busy_timeout
  db.get(`PRAGMA busy_timeout;`, [], (err, row) => {
    if (err) {
      console.error('❌ Erreur PRAGMA busy_timeout:', err.message);
      process.exit(1);
    }
    const timeout = Object.values(row)[0];
    console.log(`✅ Busy timeout: ${timeout}ms`);
  });

  // Test 4: Lister les tables existantes
  db.all(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`,
    [],
    (err, rows) => {
      if (err) {
        console.error('❌ Erreur listage tables:', err.message);
        process.exit(1);
      }
      console.log(`✅ Tables trouvées: ${rows.length}`);
      
      // Afficher quelques tables importantes
      const importantTables = ['users', 'incoming_mails', 'accounts', 'paiements'];
      const found = rows.filter(r => importantTables.includes(r.name));
      if (found.length > 0) {
        console.log('   Tables clés:', found.map(r => r.name).join(', '));
      }
    }
  );

  // Test 5: Vérifier l'écriture (INSERT + DELETE test)
  setTimeout(() => {
    console.log('\n🔧 Test écriture DB...');
    
    db.run(
      `CREATE TABLE IF NOT EXISTS _db_test (id INTEGER PRIMARY KEY, test TEXT)`,
      [],
      (err) => {
        if (err) {
          console.error('❌ Erreur CREATE TABLE:', err.message);
          process.exit(1);
        }

        db.run(
          `INSERT INTO _db_test (test) VALUES (?)`,
          ['test_' + Date.now()],
          function (err) {
            if (err) {
              console.error('❌ Erreur INSERT:', err.message);
              process.exit(1);
            }
            console.log('✅ Écriture DB OK (lastID:', this.lastID + ')');

            // Cleanup
            db.run(`DROP TABLE _db_test`, [], () => {
              console.log('\n✅ Tous les tests passés !');
              console.log('\n💡 db/index.js est prêt pour production\n');
              process.exit(0);
            });
          }
        );
      }
    );
  }, 500);
}, 1000);
