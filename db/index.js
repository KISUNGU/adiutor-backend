/**
 * db/index.js
 * Connexion centralisée à SQLite avec PRAGMA optimisés
 * 
 * ✅ Une seule connexion SQLite pour toute l'application
 * ✅ PRAGMA WAL activé (multi-utilisateurs)
 * ✅ Compatible Docker (volume ./data:/app/data)
 * ✅ Prêt pour migration PostgreSQL (via DB_TYPE)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Type de base de données (sqlite | postgres)
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

// ⚠️ Pour PostgreSQL, utiliser un connecteur différent
if (DB_TYPE === 'postgres') {
  console.error('❌ PostgreSQL pas encore implémenté dans db/index.js');
  console.error('💡 Configurer DB_TYPE=sqlite pour continuer');
  process.exit(1);
}

// Déterminer le chemin de la base de données
// 1. Variable d'environnement SQLITE_DB_PATH (priorité)
// 2. Fallback: ./data/databasepnda.db (compatibilité existante)
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'databasepnda.db');

// S'assurer que le dossier data/ existe (important pour Docker)
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  console.log(`📁 Création du dossier: ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
}

// Créer la connexion unique
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Erreur connexion SQLite:', err.message);
    console.error('📍 Chemin DB:', DB_PATH);
    process.exit(1);
  }
  console.log(`✅ Connexion SQLite établie: ${DB_PATH}`);
  
  // Vérifier que le fichier DB est accessible en écriture
  fs.access(DB_PATH, fs.constants.W_OK, (accessErr) => {
    if (accessErr) {
      console.error('⚠️  Base de données en lecture seule !');
      console.error('💡 Vérifier permissions:', DB_PATH);
    }
  });
});

// Appliquer les PRAGMA CRITIQUES pour multi-utilisateurs + Docker
db.serialize(() => {
  // 1. WAL = Write-Ahead Logging → meilleure concurrence (CRITIQUE)
  //    Permet à plusieurs lecteurs simultanés pendant qu'un writer écrit
  //    OBLIGATOIRE pour SQLite en production multi-utilisateurs
  db.run(`PRAGMA journal_mode = WAL;`, (err) => {
    if (err) {
      console.error('❌ PRAGMA journal_mode failed:', err.message);
      console.error('⚠️  SQLite fonctionnera en mode dégradé (ROLLBACK)');
    } else {
      console.log('✅ PRAGMA journal_mode = WAL activé');
    }
  });

  // 2. Timeout avant erreur de verrouillage (5 secondes)
  //    Si la DB est verrouillée, attendre 5s avant erreur SQLITE_BUSY
  db.run(`PRAGMA busy_timeout = 5000;`, (err) => {
    if (err) {
      console.error('❌ PRAGMA busy_timeout failed:', err.message);
    } else {
      console.log('✅ PRAGMA busy_timeout = 5000ms');
    }
  });

  // 3. Activer les clés étrangères (IMPORTANT pour intégrité relationnelle)
  //    Par défaut DÉSACTIVÉ dans SQLite pour compatibilité historique
  db.run(`PRAGMA foreign_keys = ON;`, (err) => {
    if (err) {
      console.error('❌ PRAGMA foreign_keys failed:', err.message);
    } else {
      console.log('✅ PRAGMA foreign_keys = ON');
    }
  });

  // 4. Vérifier la configuration WAL (diagnostic)
  db.get(`PRAGMA journal_mode;`, [], (err, row) => {
    if (!err && row) {
      const mode = Object.values(row)[0];
      if (mode === 'wal') {
        console.log('🔒 Mode WAL confirmé (multi-utilisateurs OK)');
      } else {
        console.warn(`⚠️  Mode actuel: ${mode} (WAL attendu pour Docker)`);
      }
    }
  });

  // 5. Afficher cache_size et page_size (diagnostic optionnel)
  db.get(`PRAGMA cache_size;`, [], (err, row) => {
    if (!err && row) {
      console.log(`📊 Cache size: ${Math.abs(Object.values(row)[0])} pages`);
    }
  });
});

// Gestion propre de la fermeture de la base de données
process.on('SIGINT', () => {
  console.log('\n🛑 Signal SIGINT reçu, fermeture de la DB...');
  db.close((err) => {
    if (err) {
      console.error('❌ Erreur fermeture DB:', err.message);
      process.exit(1);
    }
    console.log('✅ Base de données fermée proprement');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Signal SIGTERM reçu, fermeture de la DB...');
  db.close((err) => {
    if (err) {
      console.error('❌ Erreur fermeture DB:', err.message);
      process.exit(1);
    }
    console.log('✅ Base de données fermée proprement');
    process.exit(0);
  });
});

// Export de la connexion unique (singleton pattern)
// ⚠️ Ne JAMAIS créer une deuxième connexion ailleurs dans le code
// ⚠️ Toujours importer avec: const db = require('./db/index');
module.exports = db;
