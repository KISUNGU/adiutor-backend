#!/usr/bin/env node
/**
 * Script de diagnostic Railway
 * À exécuter pour identifier les problèmes de déploiement
 */

console.log('🔍 Diagnostic Railway - Vérification de la configuration\n');

// Vérifier Node.js version
console.log('📌 Version Node.js:', process.version);
console.log('📌 Plateforme:', process.platform, process.arch);
console.log('');

// Vérifier variables d'environnement critiques
console.log('🔐 Variables d\'environnement:');
const requiredVars = ['JWT_SECRET_KEY', 'ENCRYPTION_MASTER_KEY'];
const optionalVars = ['PORT', 'DB_TYPE', 'OPENAI_API_KEY', 'ALLOWED_ORIGIN', 'RAILWAY_ENVIRONMENT'];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: Défini (${value.length} caractères)`);
  } else {
    console.log(`  ❌ ${varName}: MANQUANT - Le serveur ne démarrera pas!`);
  }
});

console.log('');
console.log('📋 Variables optionnelles:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value}`);
  } else {
    console.log(`  ⚪ ${varName}: Non défini (utilise valeur par défaut)`);
  }
});

// Vérifier dépendances critiques
console.log('');
console.log('📦 Dépendances critiques:');
const criticalDeps = [
  'express',
  'sqlite3',
  'jsonwebtoken',
  'bcryptjs',
  'dotenv'
];

criticalDeps.forEach(dep => {
  try {
    const version = require(`${dep}/package.json`).version;
    console.log(`  ✅ ${dep}: v${version}`);
  } catch (e) {
    console.log(`  ❌ ${dep}: Non installé`);
  }
});

// Vérifier structure fichiers
console.log('');
console.log('📁 Structure fichiers:');
const fs = require('fs');
const criticalFiles = [
  'server.js',
  'package.json',
  'db/index.js',
  'db/migrations.js',
  'nixpacks.toml',
  'railway.json'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}: Manquant`);
  }
});

// Vérifier connexion base de données
console.log('');
console.log('💾 Base de données:');
const dbType = process.env.DB_TYPE || 'sqlite';
console.log(`  Type: ${dbType}`);

if (dbType === 'sqlite') {
  const dbPath = process.env.SQLITE_DB_PATH || './data/mails.db3';
  console.log(`  Chemin: ${dbPath}`);
  
  const path = require('path');
  const dir = path.dirname(dbPath);
  
  if (!fs.existsSync(dir)) {
    console.log(`  ⚠️ Répertoire ${dir} n'existe pas - créez-le!`);
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  ✅ Répertoire ${dir} créé`);
    } catch (e) {
      console.log(`  ❌ Impossible de créer ${dir}:`, e.message);
    }
  } else {
    console.log(`  ✅ Répertoire ${dir} existe`);
  }
}

// Configuration serveur
console.log('');
console.log('🚀 Configuration serveur:');
const port = process.env.PORT || 4000;
const host = process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : 'localhost';
console.log(`  Port: ${port}`);
console.log(`  Host: ${host}`);
console.log(`  URL locale: http://${host}:${port}`);

// Résumé
console.log('');
console.log('📊 RÉSUMÉ:');
const hasRequiredVars = requiredVars.every(v => process.env[v]);
if (hasRequiredVars) {
  console.log('  ✅ Toutes les variables requises sont définies');
} else {
  console.log('  ❌ Variables requises manquantes - ajoutez-les dans Railway!');
  console.log('');
  console.log('  Pour générer:');
  console.log('    JWT_SECRET_KEY:');
  console.log('      node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  console.log('    ENCRYPTION_MASTER_KEY:');
  console.log('      node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
}

console.log('');
console.log('✅ Diagnostic terminé');
console.log('');
console.log('📖 Pour consulter les logs Railway:');
console.log('   1. Ouvrez https://railway.app/dashboard');
console.log('   2. Sélectionnez votre projet');
console.log('   3. Cliquez sur "Deployments"');
console.log('   4. Sélectionnez le dernier déploiement');
console.log('   5. Consultez "Build Logs" et "Deploy Logs"');
