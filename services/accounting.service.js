/**
 * services/accounting.service.js
 * Service de gestion de la comptabilité
 * 
 * ✅ Logique métier comptabilité (comptes, achats, paiements)
 * ✅ Aucun req/res (pure logique)
 * ✅ Compatible PostgreSQL future
 */

 const { ensureAccountIdByCode } = require('../db/migrations');

/**
 * S'assure qu'un compte existe et retourne son ID
 * Wrapper promisifié de ensureAccountIdByCode
 * 
 * @param {object} db - Instance SQLite
 * @param {string} code - Code du compte
 * @returns {Promise<number>} ID du compte
 */
function getOrCreateAccountByCode(db, code) {
  return new Promise((resolve, reject) => {
    ensureAccountIdByCode(db, code, (err, accountId) => {
      if (err) return reject(err);
      resolve(accountId);
    });
  });
}

/**
 * Récupère les informations d'un compte par son code
 * 
 * @param {object} db - Instance SQLite
 * @param {string} code - Code du compte
 * @returns {Promise<object>} Compte trouvé ou null
 */
function getAccountByCode(db, code) {
  return new Promise((resolve, reject) => {
    const accountCode = String(code ?? '').trim();
    if (!accountCode) return reject(new Error('Code compte manquant'));

    db.get(
      `SELECT id, code, name, type, created_at FROM accounts WHERE TRIM(code) = ? LIMIT 1`,
      [accountCode],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

/**
 * Liste tous les comptes
 * 
 * @param {object} db - Instance SQLite
 * @param {object} filters - Filtres optionnels {type}
 * @returns {Promise<array>} Liste des comptes
 */
function listAccounts(db, filters = {}) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT id, code, name, type, created_at FROM accounts';
    const params = [];

    if (filters.type) {
      sql += ' WHERE type = ?';
      params.push(filters.type);
    }

    sql += ' ORDER BY code ASC';

    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * Créer un achat avec gestion du workflow Brouillard/Contrôle/Validation
 * 
 * @param {object} db - Instance SQLite
 * @param {object} data - Données achat {date, supplier, amount, description, ...}
 * @param {number} userId - ID utilisateur créateur
 * @returns {Promise<object>} {success, id, data}
 */
async function createAchat(db, data, userId) {
  try {
    const {
      date,
      supplier,
      amount,
      description,
      piece_path,
      piece_hash,
      compte_debit,
      compte_credit,
      status = 'BROUILLARD'
    } = data;

    // Validations
    if (!date || !supplier || amount == null) {
      return {
        success: false,
        error: 'Champs obligatoires manquants (date, supplier, amount)'
      };
    }

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO achats (
          date, supplier, amount, description,
          piece_path, piece_hash, compte_debit, compte_credit,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [date, supplier, amount, description, piece_path, piece_hash, compte_debit, compte_credit, status],
        function (err) {
          if (err) return reject(err);
          
          resolve({
            success: true,
            id: this.lastID,
            data: { id: this.lastID, date, supplier, amount, status }
          });
        }
      );
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Créer un paiement avec gestion du workflow
 * 
 * @param {object} db - Instance SQLite
 * @param {object} data - Données paiement {date, amount, description, compte, ...}
 * @param {number} userId - ID utilisateur créateur
 * @returns {Promise<object>} {success, id, data}
 */
async function createPaiement(db, data, userId) {
  try {
    const {
      date,
      amount,
      description,
      compte = 'Compte courant',
      piece_path,
      piece_hash,
      compte_debit,
      compte_credit,
      status = 'BROUILLARD'
    } = data;

    // Validations
    if (!date || amount == null) {
      return {
        success: false,
        error: 'Champs obligatoires manquants (date, amount)'
      };
    }

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO paiements (
          date, amount, description, compte,
          piece_path, piece_hash, compte_debit, compte_credit,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [date, amount, description, compte, piece_path, piece_hash, compte_debit, compte_credit, status],
        function (err) {
          if (err) return reject(err);
          
          resolve({
            success: true,
            id: this.lastID,
            data: { id: this.lastID, date, amount, compte, status }
          });
        }
      );
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Changer le statut d'un achat (workflow Brouillard -> Contrôle -> Validé)
 * 
 * @param {object} db - Instance SQLite
 * @param {number} achatId - ID de l'achat
 * @param {string} newStatus - Nouveau statut (CONTROLE, VALIDE)
 * @param {number} userId - ID utilisateur effectuant le changement
 * @returns {Promise<object>} {success, data}
 */
function changeAchatStatus(db, achatId, newStatus, userId) {
  return new Promise((resolve, reject) => {
    const validStatuses = ['BROUILLARD', 'CONTROLE', 'VALIDE'];
    
    if (!validStatuses.includes(newStatus)) {
      return resolve({
        success: false,
        error: `Statut invalide. Valeurs autorisées: ${validStatuses.join(', ')}`
      });
    }

    let updateFields = 'status = ?';
    const params = [newStatus];

    if (newStatus === 'CONTROLE') {
      updateFields += ', controlled_at = datetime("now"), controlled_by = ?';
      params.push(userId);
    } else if (newStatus === 'VALIDE') {
      updateFields += ', validated_at = datetime("now"), validated_by = ?';
      params.push(userId);
    }

    params.push(achatId);

    db.run(
      `UPDATE achats SET ${updateFields} WHERE id = ?`,
      params,
      function (err) {
        if (err) return reject(err);
        
        if (this.changes === 0) {
          return resolve({
            success: false,
            error: 'Achat non trouvé'
          });
        }

        resolve({
          success: true,
          data: { id: achatId, status: newStatus, changes: this.changes }
        });
      }
    );
  });
}

/**
 * Changer le statut d'un paiement
 * 
 * @param {object} db - Instance SQLite
 * @param {number} paiementId - ID du paiement
 * @param {string} newStatus - Nouveau statut
 * @param {number} userId - ID utilisateur
 * @returns {Promise<object>} {success, data}
 */
function changePaiementStatus(db, paiementId, newStatus, userId) {
  return new Promise((resolve, reject) => {
    const validStatuses = ['BROUILLARD', 'CONTROLE', 'VALIDE'];
    
    if (!validStatuses.includes(newStatus)) {
      return resolve({
        success: false,
        error: `Statut invalide. Valeurs autorisées: ${validStatuses.join(', ')}`
      });
    }

    let updateFields = 'status = ?';
    const params = [newStatus];

    if (newStatus === 'CONTROLE') {
      updateFields += ', controlled_at = datetime("now"), controlled_by = ?';
      params.push(userId);
    } else if (newStatus === 'VALIDE') {
      updateFields += ', validated_at = datetime("now"), validated_by = ?';
      params.push(userId);
    }

    params.push(paiementId);

    db.run(
      `UPDATE paiements SET ${updateFields} WHERE id = ?`,
      params,
      function (err) {
        if (err) return reject(err);
        
        if (this.changes === 0) {
          return resolve({
            success: false,
            error: 'Paiement non trouvé'
          });
        }

        resolve({
          success: true,
          data: { id: paiementId, status: newStatus, changes: this.changes }
        });
      }
    );
  });
}

module.exports = {
  getOrCreateAccountByCode,
  getAccountByCode,
  listAccounts,
  createAchat,
  createPaiement,
  changeAchatStatus,
  changePaiementStatus
};
