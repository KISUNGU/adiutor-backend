#!/usr/bin/env node
/*
 * Script de purge des données de courriers et archives.
 * ATTENTION: Supprime définitivement les données des tables:
 *   - archive_annexes
 *   - archives
 *   - annexes
 *   - mail_history
 *   - incoming_mails
 * Réinitialise aussi les compteurs AUTOINCREMENT.
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

(async () => {
  console.log('🔄 Début purge des données courriers & archives...');
  try {
    // Désactiver les foreign keys pour suppression massive puis réactiver
    await run('PRAGMA foreign_keys = OFF');

    // Ordre: dépendances vers parents
    const deletedArchiveAnnexes = await run('DELETE FROM archive_annexes');
    const deletedArchives = await run('DELETE FROM archives');
    const deletedAnnexes = await run('DELETE FROM annexes');
    const deletedHistory = await run('DELETE FROM mail_history');
    const deletedIncoming = await run('DELETE FROM incoming_mails');

    // Reset AUTOINCREMENT (SQLite sequence table)
    await run("DELETE FROM sqlite_sequence WHERE name IN ('archive_annexes','archives','annexes','mail_history','incoming_mails')");

    await run('PRAGMA foreign_keys = ON');

    console.log('✅ Purge terminée:');
    console.log(`   archive_annexes supprimés: ${deletedArchiveAnnexes}`);
    console.log(`   archives supprimés:        ${deletedArchives}`);
    console.log(`   annexes supprimés:         ${deletedAnnexes}`);
    console.log(`   mail_history supprimés:    ${deletedHistory}`);
    console.log(`   incoming_mails supprimés:  ${deletedIncoming}`);
    console.log('ℹ️ Compteurs AUTOINCREMENT réinitialisés.');
  } catch (err) {
    console.error('❌ Erreur purge:', err.message);
  } finally {
    db.close(() => console.log('🔒 Connexion DB fermée.'));
  }
})();
