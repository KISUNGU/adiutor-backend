class Partenaire {
  static createTable(db) {
    db.run(`CREATE TABLE IF NOT EXISTS partenaire (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      type TEXT,
      email TEXT,
      telephone TEXT,
      organisation TEXT
    )`, (err) => {
      if (err) console.error('Erreur création table partenaire:', err.message);
    });
  }

  static search(db, query, cb) {
    db.all(`SELECT id, nom, type, email, organisation FROM partenaire WHERE nom LIKE ? OR organisation LIKE ? LIMIT 10`, [`%${query}%`, `%${query}%`], (err, rows) => {
      cb(err, rows);
    });
  }
}

module.exports = Partenaire;
