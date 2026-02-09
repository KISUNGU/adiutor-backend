const bcrypt = require('bcryptjs');

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

async function listExternes({ db }) {
  return dbAll(db, 'SELECT * FROM correspondances_externes');
}

async function createExterne({ db, payload, pieceJointe }) {
  const { reference, destinataire, objet, date } = payload;

  if (!reference || !destinataire || !objet || !date) {
    const err = new Error('Tous les champs sont requis');
    err.status = 400;
    throw err;
  }

  const result = await dbRun(
    db,
    'INSERT INTO correspondances_externes (reference, destinataire, objet, date, piece_jointe) VALUES (?, ?, ?, ?, ?)',
    [reference, destinataire, objet, date, pieceJointe],
  );

  return { id: result.lastID };
}

async function bulkCreateExternes({ db, correspondances }) {
  if (!Array.isArray(correspondances) || correspondances.length === 0) {
    const err = new Error('Un tableau de correspondances est requis');
    err.status = 400;
    throw err;
  }

  await new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO correspondances_externes (reference, destinataire, objet, date, piece_jointe)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.serialize(() => {
      correspondances.forEach((corresp) => {
        if (!corresp.reference || !corresp.destinataire || !corresp.objet || !corresp.date) {
          console.warn('Correspondance incomplète ignorée :', corresp);
          return;
        }
        stmt.run(
          [corresp.reference, corresp.destinataire, corresp.objet, corresp.date, null],
          (err) => {
            if (err) {
              console.error('Erreur lors de l’insertion d’une correspondance :', err.message);
            }
          },
        );
      });

      // --- DÉBUT DU BLOC D'INSERTION INITIALE DE DONNÉES DE PERSONNEL ---

      function initializePersonnelData() {
        db.get("SELECT COUNT(*) AS count FROM users WHERE COALESCE(is_system_user, 1) = 0", (err, row) => {
          if (err) {
            console.error("Erreur vérification personnel:", err.message);
            return;
          }
          if (row.count > 0) {
            console.log("Personnel déjà initialisé. Saut de l'insertion.");
            return;
          }

          console.log('Initialisation des données du Personnel, Départements et Fonctions...');

          const departments = [
            { name: 'Coordination nationale', id: 1 },
            { name: 'UPEP SUD-KIVU', id: 2 },
            { name: 'UPEP TANGANYIKA', id: 3 },
          ];
          departments.forEach((dep) => {
            db.run(`INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)`, [dep.id, dep.name], (e) => {
              if (e) console.error('Erreur insert département:', e.message);
            });
          });

          const positionsMap = {};
          const positions = [
            'Coordonnateur National', 'Responsable Administratif et Financier', 'Responsable Passation des Marchés',
            'Responsable de Suivi et Evaluation', 'Expert en Gestion de projet PICAGL', 'Spécialiste National en Sauvegarde Environnemental',
            'Comptable/PICAGL', 'Expert en Gestion des Savoirs PICAGL', 'Chargée de Passation des Marchés PICAGL',
            'Spécialiste National de Nutrition PICAGL', 'Trésorière', 'Logisticien PICAGL', 'Informaticien',
            'Assistante Administrative', 'Caissière', 'Secrétaire', 'Chauffeur', 'Coordonnateur Provincial',
            'Comptable', 'Responsable Provincial de Suivi et Evaluation', 'Chargé de Passation des Marchés',
            'Expert en Recherche Agronomique et Appliquée', 'Assistant en Communication', 'Expert en Travaux de génie civil',
            'Assistant en logistique', 'Coordonnatrice Provinciale', 'Comptable Provincial', 'Chargé Passation des Marchés',
            'Expert en Travaux de Génie-civil', 'Caissier'
          ];
          positions.forEach((title, index) => {
            const id = index + 1;
            positionsMap[title] = id;
            db.run(`INSERT OR IGNORE INTO positions (id, title) VALUES (?, ?)`, [id, title], (e) => {
              if (e) console.error('Erreur insert position:', e.message);
            });
          });

          const personnelData = [
            { name: 'Alfred KIBANGULA ASOYO', position: 'Coordonnateur National', department: 'Coordination nationale', phone: '081 813 79 23', email: 'a.kibangula@yahoo.fr' },
            { name: 'Constant BALA KASONGO', position: 'Responsable Administratif et Financier', department: 'Coordination nationale', phone: '099 993 20 03', email: 'balacons@yahoo.fr' },
            { name: 'Jacques NKIOSILI ENKAN', position: 'Responsable Passation des Marchés', department: 'Coordination nationale', phone: '099 817 09 75', email: 'jnkiosili2007@yahoo.fr' },
            { name: 'Naven MATONDO BAVENGA', position: 'Responsable de Suivi et Evaluation', department: 'Coordination nationale', phone: '099 992 48 60', email: 'navenmat@yahoo.fr' },
            { name: 'Gaspard ZAMU HAIZURU', position: 'Expert en Gestion de projet PICAGL', department: 'Coordination nationale', phone: '0815648146', email: 'gaspa.haizuru@yahoo.com' },
            { name: 'Grace BARUKA', position: 'Spécialiste National en Sauvegarde Environnemental', department: 'Coordination nationale', phone: '0993002391', email: 'barukagrace01@gmail.com' },
            { name: 'Guillaume MUDIBANTU SANGULA', position: 'Comptable/PICAGL', department: 'Coordination nationale', phone: '0814039147', email: 'mudibantu@gmail.com' },
            { name: 'Dominique-Roger KADIMAMUYA LUFULWABO', position: 'Expert en Gestion des Savoirs PICAGL', department: 'Coordination nationale', phone: '0827261995', email: 'kadimamuya@yahoo.fr' },
            { name: 'Gisèle MPOYI BAKAJI', position: 'Chargée de Passation des Marchés PICAGL', department: 'Coordination nationale', phone: '0815159053', email: 'gimpoyi@gmail.com' },
            { name: 'Emmanuel KIBALA MULONGO', position: 'Spécialiste National de Nutrition PICAGL', department: 'Coordination nationale', phone: '0818999288', email: 'ekibala@rocketmail.com' },
            { name: 'Flavie LUZIZILA DIAKIESE', position: 'Trésorière', department: 'Coordination nationale', phone: '099 818 68 91', email: 'luzizilaflavie@yahoo.fr' },
            { name: 'Vincent SABITI CHAHIHABWA', position: 'Logisticien PICAGL', department: 'Coordination nationale', phone: '0812128075', email: 'vincentsabiti@gmail.com' },
            { name: 'Régis Landry KASUAMA MAKUMIKA', position: 'Informaticien', department: 'Coordination nationale', phone: '099 882 05 04', email: 'regiskas@gmail.com' },
            { name: 'Liliane KAZADI BANZA', position: 'Assistante Administrative', department: 'Coordination nationale', phone: '081 748 96 11', email: 'lilianekazadibanza1981@gmail.com' },
            { name: 'Ange KAYOYO NGOMBE', position: 'Caissière', department: 'Coordination nationale', phone: '081 629 37 09', email: 'ange_kayoyo@hotmail.fr' },
            { name: 'Sarah LOMBE ATOKOYAKA', position: 'Secrétaire', department: 'Coordination nationale', phone: '081 706 78 14', email: 'lombe.sarah@yahoo.com' },
            { name: 'Roger MAVINGA LWAMBA', position: 'Chauffeur', department: 'Coordination nationale', phone: '081 517 57 20', email: null },
            { name: 'Emmanuel NDOMBELE', position: 'Chauffeur', department: 'Coordination nationale', phone: '081 899 70 51', email: null },
            { name: 'Gilbert KABEYA BELLICE', position: 'Chauffeur', department: 'Coordination nationale', phone: '089 963 34 26', email: null },
            { name: 'Paulin WEDIONDO', position: 'Chauffeur', department: 'Coordination nationale', phone: '081 173 41 00', email: null },
            { name: 'Yves MFIRI MUSHONDA', position: 'Chauffeur', department: 'Coordination nationale', phone: '0903903904', email: null },
            { name: 'Jean Damas BULUBULU BITANDE', position: 'Coordonnateur Provincial', department: 'UPEP SUD-KIVU', phone: '082 199 53 48', email: 'bulubuludamas@yahoo.fr' },
            { name: 'Benoit NGUDIE MUSUNGAIE', position: 'Comptable', department: 'UPEP SUD-KIVU', phone: '815033264', email: 'bngudie@yahoo.fr' },
            { name: 'Bienvenu MOKILI LILALA', position: 'Responsable Provincial de Suivi et Evaluation', department: 'UPEP SUD-KIVU', phone: '0811919491', email: 'mokili.bl@gmail.com' },
            { name: 'José KABONGO', position: 'Chargé de Passation des Marchés', department: 'UPEP SUD-KIVU', phone: '0815042854', email: 'jose_kabongo_jkmm@yahoo.fr' },
            { name: 'LUTETEDIANKENDA LAMBERT', position: 'Expert en Recherche Agronomique et Appliquée', department: 'UPEP SUD-KIVU', phone: '0817533815', email: 'lutetelambert@gmail.com' },
            { name: 'Bob KATAY TSHEKE', position: 'Assistant en Communication', department: 'UPEP SUD-KIVU', phone: '0822222214', email: 'vanromarique.bob@gmail.com' },
            { name: 'KISUNZI KUNYOKUNA Jean de Dieu', position: 'Expert en Travaux de génie civil', department: 'UPEP SUD-KIVU', phone: '0817808267', email: 'kusmbul@yahoo.fr' },
            { name: 'Toussaint KWIRAKUBUYA BALOLA', position: 'Assistant en logistique', department: 'UPEP SUD-KIVU', phone: '08 53 32 75 83', email: 'balolatoussain1@gmail.com' },
            { name: 'Evelyne MAKOMBO ZAINA', position: 'Secrétaire', department: 'UPEP SUD-KIVU', phone: '08 19 90 04 41', email: 'emakombo14@gmail.com' },
            { name: 'Alice BITAWA', position: 'Caissière', department: 'UPEP SUD-KIVU', phone: '08 50 19 49 62', email: 'aliciabit24@gmail.com' },
            { name: 'Bezo KASHEMWA', position: 'Chauffeur', department: 'UPEP SUD-KIVU', phone: '970604966', email: null },
            { name: 'Guillaume KINYONGO AMISI', position: 'Chauffeur', department: 'UPEP SUD-KIVU', phone: '0999826901', email: null },
            { name: 'Berthelot MUFULA BAHATI', position: 'Chauffeur', department: 'UPEP SUD-KIVU', phone: '0819668915', email: null },
            { name: 'Brigitte KAPINGA SAUDA', position: 'Coordonnatrice Provinciale', department: 'UPEP TANGANYIKA', phone: '0815215326', email: 'brigittesauda@gmail.com' },
            { name: 'David THADILA MABIALA', position: 'Responsable Provincial de Suivi et Evaluation', department: 'UPEP TANGANYIKA', phone: '0973030724', email: 'davidthadila@hotmail.fr' },
            { name: 'Alain ALI YUMBI', position: 'Chargé Passation des Marchés', department: 'UPEP TANGANYIKA', phone: '081 270 36 92', email: 'alanbrownhelen@yahoo.fr' },
            { name: 'OKITANGANDA LOTSHUGUE John', position: 'Comptable Provincial', department: 'UPEP TANGANYIKA', phone: '0817339421', email: 'profoki2015@gmail.com' },
            { name: 'Ismaël KASAY SAWA', position: 'Expert en Travaux de Génie-civil', department: 'UPEP TANGANYIKA', phone: '0998265051', email: 'ismaelokasay@yahoo.fr' },
            { name: 'Jean Paul BATIBUHA', position: 'Expert en Recherche Agronomique et Appliquée', department: 'UPEP TANGANYIKA', phone: '0811 923 090', email: 'jbatibuha@gmail.com' },
            { name: 'Sara PANGASUDI AMINA', position: 'Assistante en Communication', department: 'UPEP TANGANYIKA', phone: '0999 411 414', email: 'aminapangasudi@gmail.com' },
            { name: 'NYEMBO KANUNU Willy', position: 'Assistant Logisticien', department: 'UPEP TANGANYIKA', phone: '0814111670', email: 'nyembowilly@yahoo.fr' },
            { name: 'TSHABOLA MBUYI Matthieu', position: 'Secrétaire', department: 'UPEP TANGANYIKA', phone: '0823957843', email: 'matthieuchris@gmail.com' },
            { name: 'Maurice LUBANDILA MBUYU', position: 'Caissier', department: 'UPEP TANGANYIKA', phone: '0811992919', email: 'mauricembuyu1@gmail.com' },
            { name: 'Christian NYEMBO LWAMBA', position: 'Chauffeur', department: 'UPEP TANGANYIKA', phone: '0822132310', email: null },
            { name: 'Archedou MWAMBA OTENDE', position: 'Chauffeur', department: 'UPEP TANGANYIKA', phone: '0821113388', email: null },
          ];

          const depMap = { 'Coordination nationale': 1, 'UPEP SUD-KIVU': 2, 'UPEP TANGANYIKA': 3 };

          const disabledHash = bcrypt.hashSync('disabled', 10);

          personnelData.forEach((p, idx) => {
            const position_id = positionsMap[p.position];
            const department_id = depMap[p.department];

            if (position_id && department_id) {
              const emailValue = p.email || `personnel_seed_${idx}_${Date.now()}@local`;
              const usernameValue = emailValue;
              db.run(
                `INSERT OR IGNORE INTO users (username, email, password, full_name, phone, fonction_id, departement_id, is_system_user, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
                [usernameValue, emailValue, disabledHash, p.name, p.phone || null, position_id, department_id],
                (e) => {
                  if (e) console.error(`Erreur insert personnel (${p.name}):`, e.message);
                },
              );
            } else {
              console.warn(`Donnée ignorée (Position ou Département introuvable pour ${p.name})`);
            }
          });
          console.log('Initialisation des données du Personnel terminée.');
        });
      }

      // initializePersonnelData(); // COMMENTÉ POUR DEBUG

      // --- FIN DU BLOC D'INSERTION INITIALE DE DONNÉES DE PERSONNEL ---
      stmt.finalize();
      resolve();
    });
  });

  return { message: 'Correspondances importées avec succès' };
}

async function deleteExterne({ db, id }) {
  const result = await dbRun(db, 'DELETE FROM correspondances_externes WHERE id = ?', [id]);
  if (!result.changes) {
    const err = new Error('Correspondance non trouvée');
    err.status = 404;
    throw err;
  }
  return { deleted: true };
}

module.exports = {
  listExternes,
  createExterne,
  bulkCreateExternes,
  deleteExterne,
};
