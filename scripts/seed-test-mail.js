#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this.lastID ?? this.changes);
    });
  });
}

(function main(){
  console.log('🌱 Seed: insertion d\'un courrier de test...');
  const ref = 'TEST-' + Date.now();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Déterminer dynamiquement les colonnes disponibles
  db.all("PRAGMA table_info(incoming_mails)", async (err, info) => {
    if (err) {
      console.error('❌ Erreur lecture schéma:', err.message);
      db.close();
      return;
    }
    const cols = new Set((info||[]).map(c => c.name));

    // Colonnes communes probables
  const hasArrival = cols.has('arrival_date');
  const hasMailDate = cols.has('mail_date');
    const hasReception = cols.has('date_reception');
    const hasStatus = cols.has('status');
    const hasStatutGlobal = cols.has('statut_global');
    const hasAssigned = cols.has('assigned_to');
    const hasClasseur = cols.has('classeur');
    const hasResponseDue = cols.has('response_due');

    // Construire l'insert selon schéma
    const fields = ['ref_code','subject','sender'];
    const values = [ref, 'Courrier de test', 'Expéditeur Test'];

  if (hasArrival) { fields.push('arrival_date'); values.push(now); }
  if (hasMailDate) { fields.push('mail_date'); values.push(now.slice(0,10)); }
    if (hasReception) { fields.push('date_reception'); values.push(now); }
    if (hasStatus) { fields.push('status'); values.push('En Traitement'); }
    if (hasStatutGlobal) { fields.push('statut_global'); values.push('En Traitement'); }
    fields.push('comment'); values.push('Traitement de test');
    if (hasAssigned) { fields.push('assigned_to'); values.push('admin'); }
    if (hasClasseur) { fields.push('classeur'); values.push('CL01'); }
    if (hasResponseDue) { fields.push('response_due'); values.push(null); }

    const placeholders = fields.map(_=>'?').join(', ');
    const sql = `INSERT INTO incoming_mails (${fields.join(', ')}) VALUES (${placeholders})`;

    try {
      const mailId = await run(sql, values);
      console.log(`✅ Courrier de test inséré avec ID: ${mailId}, ref: ${ref}`);
    } catch (e) {
      console.error('❌ Erreur seed:', e.message);
    } finally {
      db.close(() => console.log('🔒 Connexion DB fermée.'));
    }
  });
})();
