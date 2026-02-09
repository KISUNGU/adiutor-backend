/**
 * 🧪 Script de Validation Post-Refactoring
 * 
 * Vérifie que tous les modules critiques sont bien en place
 * et que l'application peut démarrer sans erreurs.
 * 
 * Usage:
 *   node validate_refactoring.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Validation du Refactoring\n');

// Couleurs console
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const blue = (text) => `\x1b[34m${text}\x1b[0m`;

let errors = 0;
let warnings = 0;
let success = 0;

/**
 * Vérifie qu'un fichier existe
 */
function checkFile(filePath, label) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(green('✅'), label, yellow(`(${filePath})`));
    success++;
    return true;
  } else {
    console.log(red('❌'), label, red(`MANQUANT: ${filePath}`));
    errors++;
    return false;
  }
}

/**
 * Vérifie qu'un fichier contient une chaîne spécifique
 */
function checkFileContains(filePath, searchString, label) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(red('❌'), label, red(`Fichier introuvable: ${filePath}`));
    errors++;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(searchString)) {
    console.log(green('✅'), label);
    success++;
    return true;
  } else {
    console.log(red('❌'), label, red(`"${searchString}" non trouvé`));
    errors++;
    return false;
  }
}

/**
 * Compte le nombre de lignes d'un fichier
 */
function countLines(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return 0;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  return content.split('\n').length;
}

console.log(blue('📦 1. Modules de Base de Données\n'));
checkFile('db/index.js', 'Connexion SQLite centralisée');
checkFile('db/migrations.js', 'Migrations centralisées');
checkFile('db/sql-compat.js', 'Couche de compatibilité PostgreSQL');

console.log('\n' + blue('🔧 2. Services Métier\n'));
checkFile('services/documents.service.js', 'Service Documents (PDF, QR, OCR, IA)');
checkFile('services/accounting.service.js', 'Service Comptabilité (workflow)');

console.log('\n' + blue('⏰ 3. Jobs Planifiés\n'));
checkFile('jobs/schedulers.js', 'Schedulers (brute-force, overdue, alerts)');

console.log('\n' + blue('🐳 4. Configuration Docker\n'));
checkFile('Dockerfile', 'Dockerfile backend');
checkFile('.dockerignore', 'Exclusions Docker');
checkFile('../docker-compose.yml', 'Docker Compose (stack complète)');
checkFile('../frontend/Dockerfile', 'Dockerfile frontend');

console.log('\n' + blue('📚 5. Documentation\n'));
checkFile('../REFACTORING_COMPLETE.md', 'Guide refactoring complet');
checkFile('../POSTGRESQL_MIGRATION_PREP.md', 'Stratégie migration PostgreSQL');
checkFile('../REFACTORING_FINAL_REPORT.md', 'Rapport final');
checkFile('../DOCKER_GUIDE.md', 'Guide Docker');

console.log('\n' + blue('✅ 6. Imports dans server.js\n'));
checkFileContains('server.js', "const db = require('./db/index')", 'Import db/index.js');
checkFileContains('server.js', "const { runAllMigrations } = require('./db/migrations')", 'Import db/migrations.js');
checkFileContains('server.js', "const { startAllSchedulers } = require('./jobs/schedulers')", 'Import jobs/schedulers.js');
checkFileContains('server.js', "const documentsService = require('./services/documents.service')", 'Import documents.service.js');

console.log('\n' + blue('🔍 7. Syntaxe PostgreSQL-Ready\n'));
checkFileContains('db/migrations.js', 'autoIncrementPK()', 'Utilise autoIncrementPK() au lieu de AUTOINCREMENT');
checkFileContains('db/migrations.js', 'currentTimestamp()', 'Utilise currentTimestamp() au lieu de datetime("now")');

console.log('\n' + blue('⚙️ 8. Configuration Environnement\n'));
checkFile('.env.example', 'Fichier .env.example avec variables PostgreSQL');
checkFileContains('.env.example', 'DB_TYPE=', 'Variable DB_TYPE définie');
checkFileContains('.env.example', 'POSTGRES_HOST=', 'Variables PostgreSQL documentées');

console.log('\n' + blue('📊 9. Métriques de Code\n'));

const serverLines = countLines('server.js');
if (serverLines > 0 && serverLines < 2800) {
  console.log(green('✅'), `server.js réduit (${serverLines} lignes, cible < 2800)`);
  success++;
} else if (serverLines >= 2800 && serverLines < 3200) {
  console.log(yellow('⚠️'), `server.js encore volumineux (${serverLines} lignes)`);
  warnings++;
} else if (serverLines === 0) {
  console.log(red('❌'), 'server.js introuvable ou vide');
  errors++;
} else {
  console.log(red('❌'), `server.js pas assez réduit (${serverLines} lignes, cible < 2800)`);
  errors++;
}

const migrationsLines = countLines('db/migrations.js');
if (migrationsLines > 250) {
  console.log(green('✅'), `migrations.js complet (${migrationsLines} lignes)`);
  success++;
} else {
  console.log(yellow('⚠️'), `migrations.js pourrait être incomplet (${migrationsLines} lignes)`);
  warnings++;
}

console.log('\n' + blue('🧱 10. Verrou Docker SQLite\n'));
checkFileContains('../docker-compose.yml', 'replicas: 1', 'Contrainte replicas: 1 (CRITIQUE pour SQLite)');

// Résumé final
console.log('\n' + '='.repeat(60));
console.log(blue('📋 Résumé de la Validation\n'));

console.log(green(`✅ Succès: ${success}`));
if (warnings > 0) {
  console.log(yellow(`⚠️  Avertissements: ${warnings}`));
}
if (errors > 0) {
  console.log(red(`❌ Erreurs: ${errors}`));
}

console.log('\n' + '='.repeat(60));

if (errors === 0 && warnings === 0) {
  console.log(green('\n🎉 VALIDATION RÉUSSIE ! Le refactoring est complet.\n'));
  console.log('Prochaines étapes:');
  console.log('  1. Tester le backend: npm run dev');
  console.log('  2. Tester Docker: docker-compose up');
  console.log('  3. Créer tests unitaires pour les services');
  process.exit(0);
} else if (errors === 0 && warnings > 0) {
  console.log(yellow('\n✅ Validation OK avec avertissements mineurs.\n'));
  process.exit(0);
} else {
  console.log(red('\n❌ ÉCHEC DE LA VALIDATION. Corrigez les erreurs ci-dessus.\n'));
  process.exit(1);
}
