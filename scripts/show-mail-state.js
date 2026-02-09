#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

(async () => {
  console.log('🔎 Etat des tables (incoming_mails / archives) ...');
  try {
    // Tenter différentes sélections selon le schéma
    let incoming = [];
    try {
      incoming = await all(`SELECT id, ref_code, subject, sender, statut_global as status, assigned_to FROM incoming_mails ORDER BY id DESC LIMIT 10`);
    } catch {
      try {
        incoming = await all(`SELECT id, ref_code, subject, sender, status, assigned_to FROM incoming_mails ORDER BY id DESC LIMIT 10`);
      } catch {
        incoming = await all(`SELECT * FROM incoming_mails ORDER BY id DESC LIMIT 10`);
      }
    }

    let archives = [];
    try {
      archives = await all(`SELECT id, reference, description, executed_task, category, status FROM archives ORDER BY id DESC LIMIT 10`);
    } catch {
      archives = await all(`SELECT * FROM archives ORDER BY id DESC LIMIT 10`);
    }

    console.table(incoming);
    console.table(archives);
    console.log(`📊 Totaux: incoming=${incoming.length}, archives=${archives.length}`);
  } catch (err) {
    console.error('❌ Erreur affichage état:', err.message);
  } finally {
    db.close(() => console.log('🔒 Connexion DB fermée.'));
  }
})();
