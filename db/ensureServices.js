module.exports = function ensureServicesTable(db) {
  if (!db) {
    throw new Error('ensureServicesTable: db is required');
  }

  // Table SERVICES (Gestion dynamique des services du workflow)
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      nom TEXT NOT NULL,
      description TEXT,
      actif INTEGER DEFAULT 1,
      ordre INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table services:', err.message);
    } else {
      console.log("Table 'services' prête.");

      // Vérifier si la table est vide et insérer les services par défaut
      // COMMENTÉ TEMPORAIREMENT POUR DIAGNOSTIC
      /*
      db.get("SELECT COUNT(*) as count FROM services", (cerr, row) => {
        if (cerr) {
          console.error("Erreur comptage services:", cerr.message);
        } else if (row.count === 0) {
          console.log("Insertion des services par défaut...");

          const services = [
            ['RAF', 'Responsable Administratif & Financier', 'Service de gestion administrative et financière', 1, 1],
            ['COMPTABLE', 'Service Comptable', 'Gestion comptable et validation des opérations', 1, 2],
            ['CAISSE', 'Service Caisse', 'Gestion des mouvements de trésorerie et paiements', 1, 3],
            ['TRESORERIE', 'Service Trésorerie', 'Gestion de la trésorerie et des flux financiers', 1, 4],
            ['FINANCE', 'Service Financier', 'Consolidation et validation financière finale', 1, 5],
            ['RH', 'Ressources Humaines', 'Gestion du personnel et des ressources humaines', 1, 6],
            ['LOGISTIQUE', 'Service Logistique', 'Gestion des achats et de la logistique', 1, 7],
            ['JURIDIQUE', 'Service Juridique', 'Affaires juridiques et contentieux', 1, 8],
            ['IT', 'Service Informatique', 'Support informatique et systèmes', 1, 9],
            ['COORDO', 'Coordination', 'Coordination et supervision générale', 1, 0]
          ];

          const insertStmt = db.prepare("INSERT INTO services (code, nom, description, actif, ordre) VALUES (?, ?, ?, ?, ?)");

          services.forEach((service) => {
            insertStmt.run(service, (ierr) => {
              if (ierr) console.error(`Erreur insertion service ${service[0]}:`, ierr.message);
            });
          });

          insertStmt.finalize(() => {
            console.log(`✅ ${services.length} services insérés avec succès.`);
          });
        } else {
          console.log(`Table services contient déjà ${row.count} entrées.`);
        }
      });
      */
    }
  });
};
