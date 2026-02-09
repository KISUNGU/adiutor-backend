#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
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

(async () => {
  console.log('🌱 Seed: données de test pour autocomplete...');

  const disabledHash = bcrypt.hashSync('disabled', 10);

  try {
    // Ajouter quelques agents internes dans personnel
    const agents = [
      ['Jean Dupont', 'jean.dupont@picagl.cd', '+243 81 111 2222'],
      ['Marie Kabila', 'marie.kabila@picagl.cd', '+243 81 222 3333'],
      ['Paul Mukendi', 'paul.mukendi@picagl.cd', '+243 81 333 4444']
    ];

    for (const [name, email, phone] of agents) {
      try {
        await run(
          `INSERT INTO users (username, email, password, full_name, phone, is_system_user, is_active)
           VALUES (?, ?, ?, ?, ?, 0, 1)`,
          [email, email, disabledHash, name, phone]
        );
        console.log(`✅ Agent interne ajouté: ${name}`);
      } catch (e) {
        if (e.message.includes('UNIQUE constraint')) {
          console.log(`ℹ️ Agent déjà présent: ${name}`);
        } else {
          console.error(`Erreur ajout agent ${name}:`, e.message);
        }
      }
    }

    // Ajouter quelques partenaires
    const partenaires = [
      ['RIKOLTO', 'Agricole', 'info@rikolto.org', '+243 81 234 5678', 'Rikolto ASBL'],
      ['VSF-B', 'Elevage', 'contact@vsfb.org', '+243 82 345 6789', 'Vétérinaires Sans Frontières Belgique'],
      ['UNOPS', 'Développement', 'contact@unops.org', '+243 99 123 4567', 'Bureau des Nations Unies']
    ];

    for (const [nom, type, email, telephone, organisation] of partenaires) {
      try {
        await run('INSERT INTO partenaire (nom, type, email, telephone, organisation) VALUES (?, ?, ?, ?, ?)', 
          [nom, type, email, telephone, organisation]);
        console.log(`✅ Partenaire ajouté: ${nom}`);
      } catch (e) {
        if (e.message.includes('UNIQUE constraint')) {
          console.log(`ℹ️ Partenaire déjà présent: ${nom}`);
        } else {
          console.error(`Erreur ajout partenaire ${nom}:`, e.message);
        }
      }
    }

    console.log('\n✅ Seed terminé avec succès!');
  } catch (err) {
    console.error('❌ Erreur seed:', err.message);
  } finally {
    db.close(() => console.log('🔒 Connexion DB fermée.'));
  }
})();
