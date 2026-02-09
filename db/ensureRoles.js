module.exports = function ensureRolesTable(db) {
  if (!db) {
    throw new Error('ensureRolesTable: db is required');
  }

  // Table ROLES (legacy / compat): certains scripts et vues utilisent un LEFT JOIN roles.
  // Si la table a été vidée par erreur, on réensemence les rôles attendus sans toucher à users.
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error("Erreur création table roles:", err.message);
      return;
    }

    const roles = [
      [1, 'admin'],
      [2, 'coordonnateur'],
      [3, 'raf'],
      [4, 'comptable'],
      [5, 'caisse'],
      [6, 'tresorerie'],
      [7, 'secretariat'],
      [8, 'logistique'],
      [9, 'assistant_admin'],
      [10, 'receptionniste'],
    ];

    const stmt = db.prepare(
      `INSERT INTO roles (id, name) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`
    );
    roles.forEach((r) => {
      stmt.run(r, (ierr) => {
        if (ierr) console.error('Erreur seed role', r, ierr.message);
      });
    });
    stmt.finalize(() => {
      console.log("✅ Table 'roles' vérifiée/ensemencée.");
    });
  });
};
