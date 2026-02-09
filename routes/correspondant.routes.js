const express = require('express');
const router = express.Router();
const Partenaire = require('../models/Partenaire');

let db;

// Recherche fusionnée agents internes + partenaires
router.get('/correspondants', (req, res) => {
  const q = (req.query.search || '').trim();
  if (!q) return res.json([]);
  
  // Agents internes (table personnel)
  db.all(`SELECT id, name AS label, 'interne' AS type FROM personnel_unified WHERE name LIKE ? LIMIT 10`, [`%${q}%`], (err, internes) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur recherche agents internes.' });
    }
    // Partenaires
    Partenaire.search(db, q, (err2, partenaires) => {
      if (err2) return res.status(500).json({ error: 'Erreur recherche partenaires.' });
      const mapped = (partenaires||[]).map(p => ({ id: p.id, label: p.nom, type: 'partenaire', organisation: p.organisation }));
      res.json([...(internes||[]), ...mapped]);
    });
  });
});

module.exports = (database) => {
  db = database;
  Partenaire.createTable(db);
  return router;
};
