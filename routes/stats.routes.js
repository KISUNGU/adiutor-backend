const express = require('express');
const {
  getCourriersStats,
  getMonthlyStats,
  getByClasseurStats,
  getTopSendersStats,
  getKpisStats,
  getDashboardKpis,
} = require('../services/stats.service');

module.exports = function statsRoutes({ authenticateToken, db, getExpectedServiceForRole }) {
  const router = express.Router();

  router.get('/courriers-stats', authenticateToken, async (req, res) => {
    try {
      const stats = await getCourriersStats({ db });
      res.json({ stats });
    } catch (error) {
      console.error('Erreur stats courriers:', error.message);
      res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
  });

  router.get('/dashboard/stats', authenticateToken, async (req, res) => {
    try {
      const stats = await getCourriersStats({ db });
      res.json({ stats });
    } catch (error) {
      console.error('Erreur dashboard stats:', error.message);
      res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
  });

  router.get('/stats/monthly', authenticateToken, async (req, res) => {
    try {
      const monthly = await getMonthlyStats({ db });
      res.json(monthly);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/stats/by-classeur', authenticateToken, async (req, res) => {
    try {
      const rows = await getByClasseurStats({ db });
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/stats/top-senders', authenticateToken, async (req, res) => {
    try {
      const rows = await getTopSendersStats({ db });
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/stats/kpis', authenticateToken, async (req, res) => {
    try {
      const kpis = await getKpisStats({ db });
      res.json(kpis);
    } catch (error) {
      return res.status(500).json({ error: 'Erreur lors du calcul des KPIs' });
    }
  });

  router.get('/dashboard/kpis', authenticateToken, async (req, res) => {
    try {
      const data = await getDashboardKpis({
        db,
        user: req.user,
        getExpectedServiceForRole,
      });
      return res.json(data);
    } catch (e) {
      console.error('Erreur /api/dashboard/kpis:', e);
      return res.status(500).json({ error: 'Erreur serveur.', details: e.message });
    }
  });

  return router;
};
