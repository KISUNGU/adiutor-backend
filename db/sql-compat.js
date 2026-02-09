/**
 * 🗄️ SQL Compatibility Layer
 * 
 * Couche d'abstraction pour supporter SQLite ET PostgreSQL
 * sans dupliquer les migrations.
 * 
 * Stratégie:
 * - En développement: SQLite (performance, simplicité)
 * - En production: PostgreSQL (scalabilité, multi-instances)
 */

const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'sqlite' | 'postgres'

/**
 * Retourne la syntaxe correcte pour les clés primaires auto-incrémentées
 * - SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
 * - PostgreSQL: SERIAL PRIMARY KEY
 */
function autoIncrementPK() {
  if (DB_TYPE === 'postgres') {
    return 'SERIAL PRIMARY KEY';
  }
  return 'INTEGER PRIMARY KEY AUTOINCREMENT';
}

/**
 * Retourne la fonction SQL pour obtenir la date/heure actuelle
 * - SQLite: datetime('now')
 * - PostgreSQL: CURRENT_TIMESTAMP
 */
function currentTimestamp() {
  if (DB_TYPE === 'postgres') {
    return 'CURRENT_TIMESTAMP';
  }
  return "datetime('now')";
}

/**
 * Retourne le placeholder pour les requêtes paramétrées
 * - SQLite: ? ? ? ? (position-based)
 * - PostgreSQL: $1 $2 $3 $4 (numbered)
 * 
 * @param {number} index - Position du paramètre (1-indexed)
 * @returns {string}
 */
function placeholder(index) {
  if (DB_TYPE === 'postgres') {
    return `$${index}`;
  }
  return '?';
}

/**
 * Génère la liste de placeholders pour une requête INSERT
 * 
 * @param {number} count - Nombre de colonnes
 * @returns {string} - Ex: "?, ?, ?" ou "$1, $2, $3"
 */
function placeholders(count) {
  if (DB_TYPE === 'postgres') {
    return Array.from({ length: count }, (_, i) => `$${i + 1}`).join(', ');
  }
  return Array.from({ length: count }, () => '?').join(', ');
}

/**
 * Type de données pour BOOLEAN
 * - SQLite: INTEGER (0/1)
 * - PostgreSQL: BOOLEAN
 */
function booleanType() {
  if (DB_TYPE === 'postgres') {
    return 'BOOLEAN';
  }
  return 'INTEGER'; // SQLite stocke 0/1
}

/**
 * Type de données pour TEXT long
 * - SQLite: TEXT
 * - PostgreSQL: TEXT
 */
function textType() {
  return 'TEXT'; // Identique pour les deux
}

/**
 * Type de données pour TIMESTAMP
 * - SQLite: TEXT (ISO 8601 strings)
 * - PostgreSQL: TIMESTAMP WITHOUT TIME ZONE
 */
function timestampType() {
  if (DB_TYPE === 'postgres') {
    return 'TIMESTAMP WITHOUT TIME ZONE';
  }
  return 'TEXT'; // SQLite stocke en ISO 8601
}

/**
 * Opérateur de concaténation de chaînes
 * - SQLite: ||
 * - PostgreSQL: ||
 */
function concatOp() {
  return '||'; // Identique
}

/**
 * Fonction pour convertir en UPPER CASE
 * - SQLite: UPPER(col)
 * - PostgreSQL: UPPER(col)
 */
function upperFunc(column) {
  return `UPPER(${column})`; // Identique
}

/**
 * Requête pour lister toutes les tables
 * - SQLite: SELECT name FROM sqlite_master WHERE type='table'
 * - PostgreSQL: SELECT tablename FROM pg_tables WHERE schemaname='public'
 */
function listTablesQuery() {
  if (DB_TYPE === 'postgres') {
    return "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'";
  }
  return "SELECT name FROM sqlite_master WHERE type='table'";
}

/**
 * Helper pour construire une clause LIMIT/OFFSET
 * - SQLite: LIMIT x OFFSET y
 * - PostgreSQL: LIMIT x OFFSET y
 */
function limitOffset(limit, offset) {
  return `LIMIT ${limit} OFFSET ${offset}`; // Identique
}

/**
 * Retourne le nom de la colonne ROWID
 * - SQLite: ROWID (implicite)
 * - PostgreSQL: ctid (mais déconseillé, utiliser clé primaire)
 */
function rowidColumn() {
  if (DB_TYPE === 'postgres') {
    console.warn('⚠️ ROWID not recommended in PostgreSQL, use primary key instead');
    return 'ctid';
  }
  return 'ROWID';
}

module.exports = {
  DB_TYPE,
  autoIncrementPK,
  currentTimestamp,
  placeholder,
  placeholders,
  booleanType,
  textType,
  timestampType,
  concatOp,
  upperFunc,
  listTablesQuery,
  limitOffset,
  rowidColumn,
};
