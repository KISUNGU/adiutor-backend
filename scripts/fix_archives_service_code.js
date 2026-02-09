/**
 * Script: fix_archives_service_code.js
 * Description: Mettre à jour les archives avec service_code="Inconnu" ou NULL
 *              en récupérant le service depuis incoming_mails (assigned_service ou service_orientation_dg)
 * 
 * Utilisation: node backend/scripts/fix_archives_service_code.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databasepnda.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Erreur ouverture DB:', err.message);
    process.exit(1);
  }
  console.log('✅ Base de données ouverte:', dbPath);
});

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

async function main() {
  try {
    console.log('\n🔍 Recherche des archives avec service_code manquant ou "Inconnu"...\n');

    // Récupérer les archives avec service_code problématique
    const archives = await dbAll(`
      SELECT a.id, a.reference, a.incoming_mail_id, a.service_code, a.category,
             i.assigned_service, i.service_orientation_dg
      FROM archives a
      LEFT JOIN incoming_mails i ON a.incoming_mail_id = i.id
      WHERE a.service_code IS NULL 
         OR a.service_code = '' 
         OR UPPER(a.service_code) = 'INCONNU'
         OR UPPER(a.service_code) = 'UNKNOWN'
    `);

    console.log(`📊 Trouvé ${archives.length} archive(s) à corriger\n`);

    if (archives.length === 0) {
      console.log('✅ Toutes les archives ont déjà un service_code valide !');
      db.close();
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const archive of archives) {
      const newServiceCode = archive.assigned_service || archive.service_orientation_dg || null;

      if (!newServiceCode || newServiceCode === '' || newServiceCode.toUpperCase() === 'INCONNU') {
        console.log(`⏭️  Archive #${archive.id} (${archive.reference}): Aucun service disponible dans incoming_mails`);
        skipped++;
        continue;
      }

      await dbRun(
        'UPDATE archives SET service_code = ? WHERE id = ?',
        [newServiceCode, archive.id]
      );

      console.log(`✅ Archive #${archive.id} (${archive.reference}): service_code mis à jour → "${newServiceCode}"`);
      updated++;
    }

    console.log(`\n📈 Résumé:`);
    console.log(`   - ${updated} archive(s) mise(s) à jour`);
    console.log(`   - ${skipped} archive(s) ignorée(s) (pas de service disponible)`);
    console.log(`   - Total traité: ${archives.length}`);

    // Afficher les problèmes restants
    const remaining = await dbAll(`
      SELECT COUNT(*) as count
      FROM archives
      WHERE service_code IS NULL 
         OR service_code = '' 
         OR UPPER(service_code) = 'INCONNU'
         OR UPPER(service_code) = 'UNKNOWN'
    `);

    if (remaining[0].count > 0) {
      console.log(`\n⚠️  Il reste ${remaining[0].count} archive(s) avec service_code manquant`);
      
      const samples = await dbAll(`
        SELECT id, reference, service_code, incoming_mail_id
        FROM archives
        WHERE service_code IS NULL 
           OR service_code = '' 
           OR UPPER(service_code) = 'INCONNU'
           OR UPPER(service_code) = 'UNKNOWN'
        LIMIT 10
      `);
      
      console.log('Exemples:');
      console.table(samples);
    } else {
      console.log('\n🎉 Toutes les archives ont maintenant un service_code !');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    db.close(() => {
      console.log('\n✅ Base de données fermée');
    });
  }
}

main();
