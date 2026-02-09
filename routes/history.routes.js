const express = require('express');
const { listMailHistory } = require('../services/history.service');

module.exports = function historyRoutes({ authenticateToken, db }) {
  const router = express.Router();

  router.get('/history', authenticateToken, async (req, res, next) => {
    try {
      const rows = await listMailHistory({ db });
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur récupération historique complet:', err.message);
      next(err);
    }
  });

  router.get('/mails/incoming/:id/history', authenticateToken, (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT * FROM mail_history
        WHERE mail_id = ?
        ORDER BY timestamp DESC
    `;

    db.all(sql, [id], (err, rows) => {
      if (err) {
        console.error(`Erreur récupération historique courrier ${id}:`, err.message);
        return res.status(500).json({ error: "Erreur serveur lors de la récupération de l'historique." });
      }
      res.json(rows);
    });
  });

  return router;
};
