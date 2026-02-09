/**
 * Module de génération d'identifiants uniques pour les documents
 */

const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

// Préfixes par type de document
const PREFIXES = {
  entrant: 'ACQE',
  sortant: 'ACQS',
  archive: 'ARCH',
  pv: 'PVSE',
  contrat: 'CTRT',
  juridique: 'DOCT'
};

/**
 * Génère un UUID v4
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Génère une référence unique au format PREFIX-YYYY-NNNNN
 * @param {Object} db - Instance SQLite database
 * @param {string} type - Type de document (entrant, sortant, archive, etc.)
 * @param {string} tableName - Nom de la table
 * @param {string} columnName - Nom de la colonne de référence (défaut: reference_unique)
 * @returns {Promise<{reference: string, uuid: string}>}
 */
function generateReference(db, type, tableName, columnName = 'reference_unique') {
  return new Promise((resolve, reject) => {
    const prefix = PREFIXES[type] || 'DOC';
    const year = new Date().getFullYear();
    
    // Trouver le prochain numéro de séquence pour ce préfixe + année
    const pattern = `${prefix}-${year}-%`;
    
    db.get(
      `SELECT ${columnName} FROM ${tableName} 
       WHERE ${columnName} LIKE ? 
       ORDER BY ${columnName} DESC LIMIT 1`,
      [pattern],
      (err, row) => {
        if (err) {
          return reject(err);
        }

        let nextSeq = 1;
        
        if (row && row[columnName]) {
          // Extraire le numéro de séquence de la dernière référence
          const parts = row[columnName].split('-');
          if (parts.length === 3) {
            const lastSeq = parseInt(parts[2], 10);
            if (!isNaN(lastSeq)) {
              nextSeq = lastSeq + 1;
            }
          }
        }

        const seqNum = String(nextSeq).padStart(5, '0');
        const reference = `${prefix}-${year}-${seqNum}`;
        const uuid = generateUUID();

        resolve({ reference, uuid });
      }
    );
  });
}

/**
 * Génère une référence unique et vérifie qu'elle n'existe pas déjà
 * (protection contre race conditions)
 */
async function generateUniqueReference(db, type, tableName, columnName = 'reference_unique', maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { reference, uuid } = await generateReference(db, type, tableName, columnName);
      
      // Vérifier que la référence n'existe pas déjà
      const exists = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM ${tableName} WHERE ${columnName} = ?`,
          [reference],
          (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
          }
        );
      });

      if (!exists) {
        return { reference, uuid };
      }

      // Si existe (rare), attendre un peu et réessayer
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
    }
  }

  throw new Error('Impossible de générer une référence unique après plusieurs tentatives');
}

/**
 * Parse une référence pour extraire ses composants
 */
function parseReference(reference) {
  if (!reference || typeof reference !== 'string') {
    return null;
  }

  const parts = reference.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const [prefix, year, sequence] = parts;
  
  // Trouver le type depuis le préfixe
  const type = Object.keys(PREFIXES).find(key => PREFIXES[key] === prefix) || 'unknown';

  return {
    prefix,
    type,
    year: parseInt(year, 10),
    sequence: parseInt(sequence, 10),
    full: reference
  };
}

/**
 * Valide le format d'une référence
 */
function isValidReference(reference) {
  const parsed = parseReference(reference);
  return parsed !== null && 
         parsed.year >= 2020 && 
         parsed.year <= 2100 &&
         parsed.sequence > 0;
}

module.exports = {
  generateUUID,
  generateReference,
  generateUniqueReference,
  parseReference,
  isValidReference,
  PREFIXES
};
