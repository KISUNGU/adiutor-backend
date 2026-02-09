const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function setDb(database) {
    db = database;
}

// Helper function to wrap db.all in a promise
function dbAll(query, params = []) {
    if (!db) throw new Error("Database not initialized in dbFunctions. Call setDb() first.");
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Helper function to wrap db.get in a promise
function dbGet(query, params = []) {
    if (!db) throw new Error("Database not initialized in dbFunctions. Call setDb() first.");
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Helper function to wrap db.run in a promise
function dbRun(query, params = []) {
    if (!db) throw new Error("Database not initialized in dbFunctions. Call setDb() first.");
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// --- Fonctions existantes ---
async function getUserFromDatabase(userId) {
  try {
    const row = await dbGet('SELECT u.id, u.username as name, u.email, r.name as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [userId]);
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur depuis la BDD:', error);
    throw error;
  }
}

async function getEquipmentDetailsFromDatabase(equipmentId) {
  try {
    const row = await dbGet('SELECT id, name, type, status, acquisition_date FROM equipments WHERE id = ?', [equipmentId]);
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'équipement depuis la BDD:', error);
    throw error;
  }
}

async function listEquipments(options = {}, sortBy = null, sortOrder = 'ASC') {
  try {
    let query = 'SELECT id, name, type, status, acquisition_date FROM equipments';
    const params = [];
    const conditions = [];

    if (options.name) { conditions.push('name LIKE ?'); params.push(`%${options.name}%`); }
    if (options.type) { conditions.push('type = ?'); params.push(options.type); }
    if (options.status) { conditions.push('status = ?'); params.push(options.status); }

    if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }
    if (sortBy) {
      const allowedSortColumns = ['id', 'name', 'type', 'status', 'acquisition_date'];
      if (allowedSortColumns.includes(sortBy)) { query += ` ORDER BY ${sortBy} ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`; }
    }

    const rows = await dbAll(query, params);
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des équipements depuis la BDD:', error);
    throw error;
  }
}

async function getOldestEquipment() {
  try {
    const row = await dbGet('SELECT id, name, type, status, acquisition_date FROM equipments ORDER BY acquisition_date ASC LIMIT 1');
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'équipement le plus ancien:', error);
    throw error;
  }
}

async function getUserRole(userNameOrEmail) {
  try {
    const row = await dbGet('SELECT u.username as name, u.email, r.name as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = ? OR u.email = ? LIMIT 1', [userNameOrEmail, userNameOrEmail]);
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération du rôle de l\'utilisateur:', error);
    throw error;
  }
}

async function getConversationHistory(sessionId) {
  try {
    const rows = await dbAll(
      'SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId]
    );
    return rows.map(row => ({ role: row.role, content: row.content }));
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique de conversation:', error);
    throw error;
  }
}

async function saveMessage(sessionId, role, content, userId = null, toolName = null, toolCallId = null) {
  const sql = `INSERT INTO messages (session_id, role, content, user_id)
               VALUES (?, ?, ?, ?)`;
  const params = [sessionId, role, content, userId];
  const safeParams = params.map(p => p === undefined ? null : p);

  try {
    await dbRun(sql, safeParams);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du message en BDD:', error);
  }
}

// --- NOUVELLES FONCTIONS POUR INCOMING_MAILS ---
async function getIncomingMailDetails(mailId) {
  try {
    const row = await dbGet('SELECT * FROM incoming_mails WHERE id = ?', [mailId]);
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des détails du courrier entrant:', error);
    throw error;
  }
}

async function listIncomingMails(options = {}, sortBy = 'date_reception', sortOrder = 'DESC') {
  try {
    let query = 'SELECT id, subject, sender, mail_date, date_reception as arrival_date, statut_global as status FROM incoming_mails';
    const params = [];
    const conditions = [];

    if (options.subject) { conditions.push('subject LIKE ?'); params.push(`%${options.subject}%`); }
    if (options.sender) { conditions.push('sender LIKE ?'); params.push(`%${options.sender}%`); }
    if (options.status) { conditions.push('statut_global = ?'); params.push(options.status); }
    if (options.arrivalDateAfter) { conditions.push('date_reception >= ?'); params.push(options.arrivalDateAfter); }
    if (options.arrivalDateBefore) { conditions.push('date_reception <= ?'); params.push(options.arrivalDateBefore); }

    if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }

    const allowedSortColumns = ['id', 'subject', 'sender', 'mail_date', 'date_reception', 'statut_global'];
    let actualSortBy = sortBy;
    if (sortBy === 'arrival_date') actualSortBy = 'date_reception';
    if (sortBy === 'status') actualSortBy = 'statut_global';

    if (sortBy && allowedSortColumns.includes(actualSortBy)) {
      query += ` ORDER BY ${actualSortBy} ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    const rows = await dbAll(query, params);
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des courriers entrants:', error);
    throw error;
  }
}

// --- NOUVELLES FONCTIONS POUR STOCKS ---
async function getStockDetails(stockId) {
  try {
    const row = await dbGet('SELECT * FROM stocks WHERE id = ?', [stockId]);
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des détails du stock:', error);
    throw error;
  }
}

async function listStocks(options = {}, sortBy = 'entry_date', sortOrder = 'DESC') {
  try {
    let query = 'SELECT id, name, category, quantity, entry_date FROM stocks';
    const params = [];
    const conditions = [];

    if (options.name) { conditions.push('name LIKE ?'); params.push(`%${options.name}%`); }
    if (options.category) { conditions.push('category = ?'); params.push(options.category); }
    if (options.quantityGreaterThan) { conditions.push('quantity >= ?'); params.push(options.quantityGreaterThan); }
    if (options.quantityLessThan) { conditions.push('quantity <= ?'); params.push(options.quantityLessThan); }

    if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }

    const allowedSortColumns = ['id', 'name', 'category', 'quantity', 'entry_date'];
    if (sortBy && allowedSortColumns.includes(sortBy)) {
      query += ` ORDER BY ${sortBy} ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    const rows = await dbAll(query, params);
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des stocks:', error);
    throw error;
  }
}

// --- NOUVELLES FONCTIONS POUR CONTRATS ---
async function getContractDetails(contractId) {
  try {
    const row = await dbGet('SELECT * FROM contrats WHERE id = ?', [contractId]);
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des détails du contrat:', error);
    throw error;
  }
}

async function listContracts(options = {}, sortBy = 'start_date', sortOrder = 'DESC') {
  try {
    let query = 'SELECT id, employee, type, start_date, end_date FROM contrats';
    const params = [];
    const conditions = [];

    if (options.employee) { conditions.push('employee LIKE ?'); params.push(`%${options.employee}%`); }
    if (options.type) { conditions.push('type = ?'); params.push(options.type); }
    if (options.startDateAfter) { conditions.push('start_date >= ?'); params.push(options.startDateAfter); }
    if (options.endDateBefore) { conditions.push('end_date <= ?'); params.push(options.endDateBefore); }

    if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }

    const allowedSortColumns = ['id', 'employee', 'type', 'start_date', 'end_date'];
    if (sortBy && allowedSortColumns.includes(sortBy)) {
      query += ` ORDER BY ${sortBy} ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    const rows = await dbAll(query, params);
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des contrats:', error);
    throw error;
  }
}

// --- NOUVELLES FONCTIONS POUR ACHATS ---
async function getPurchaseDetails(purchaseId) {
  try {
    const row = await dbGet('SELECT * FROM achats WHERE id = ?', [purchaseId]);
    return row || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des détails de l\'achat:', error);
    throw error;
  }
}

async function listPurchases(options = {}, sortBy = 'date', sortOrder = 'DESC') {
  try {
    let query = 'SELECT id, date, supplier, amount, description FROM achats';
    const params = [];
    const conditions = [];

    if (options.supplier) { conditions.push('supplier LIKE ?'); params.push(`%${options.supplier}%`); }
    if (options.amountGreaterThan) { conditions.push('amount >= ?'); params.push(options.amountGreaterThan); }
    if (options.amountLessThan) { conditions.push('amount <= ?'); params.push(options.amountLessThan); }
    if (options.dateAfter) { conditions.push('date >= ?'); params.push(options.dateAfter); }
    if (options.dateBefore) { conditions.push('date <= ?'); params.push(options.dateBefore); }

    if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }

    const allowedSortColumns = ['id', 'date', 'supplier', 'amount'];
    if (sortBy && allowedSortColumns.includes(sortBy)) {
      query += ` ORDER BY ${sortBy} ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    const rows = await dbAll(query, params);
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des achats:', error);
    throw error;
  }
}

async function getTotalPurchasesAmount(options = {}) {
  try {
    let query = 'SELECT SUM(amount) AS total_amount FROM achats';
    const params = [];
    const conditions = [];

    if (options.supplier) { conditions.push('supplier LIKE ?'); params.push(`%${options.supplier}%`); }
    if (options.dateAfter) { conditions.push('date >= ?'); params.push(options.dateAfter); }
    if (options.dateBefore) { conditions.push('date <= ?'); params.push(options.dateBefore); }

    if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }

    const row = await dbGet(query, params);
    return row || { total_amount: 0 };
  } catch (error) {
    console.error('Erreur lors du calcul du montant total des achats:', error);
    throw error;
  }
}

module.exports = {
  setDb,
  getUserFromDatabase,
  getEquipmentDetailsFromDatabase,
  listEquipments,
  getOldestEquipment,
  getUserRole,
  getConversationHistory,
  saveMessage,
  getIncomingMailDetails,
  listIncomingMails,
  getStockDetails,
  listStocks,
  getContractDetails,
  listContracts,
  getPurchaseDetails,
  listPurchases,
  getTotalPurchasesAmount
};
