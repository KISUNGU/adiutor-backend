const express = require('express');

module.exports = function inventoryRoutes({ authenticateToken, db }) {
  const router = express.Router();

  router.get('/approvisionnements', authenticateToken, (req, res) => {
    db.all('SELECT * FROM approvisionnements', [], (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des approvisionnements :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.post('/approvisionnements', authenticateToken, (req, res) => {
    const { date, amount, description } = req.body;
    db.run(
      'INSERT INTO approvisionnements (date, amount, description) VALUES (?, ?, ?)',
      [date, amount, description],
      function (err) {
        if (err) {
          console.error("Erreur lors de l'ajout d'un approvisionnement :", err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
      },
    );
  });

  router.get('/stocks', authenticateToken, (req, res) => {
    db.all('SELECT * FROM stocks', [], (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des stocks :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.post('/stocks', authenticateToken, (req, res) => {
    const { name, category, quantity, entry_date } = req.body;
    db.run(
      'INSERT INTO stocks (name, category, quantity, entry_date) VALUES (?, ?, ?, ?)',
      [name, category, quantity, entry_date],
      function (err) {
        if (err) {
          console.error("Erreur lors de l'ajout d'un stock :", err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
      },
    );
  });

  router.post('/mobilisations', authenticateToken, (req, res) => {
    const { source, amount, date } = req.body;
    db.run(
      'INSERT INTO mobilisations (source, amount, date) VALUES (?, ?, ?)',
      [source, amount, date],
      function (err) {
        if (err) {
          console.error("Erreur lors de l'ajout d'une mobilisation :", err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
      },
    );
  });

  return router;
};
