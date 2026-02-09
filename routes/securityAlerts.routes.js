const express = require('express');
const { listSecurityAlerts } = require('../services/securityAlerts.service');

module.exports = function securityAlertsRoutes({ authenticateToken, validate, securityAlertsListValidator, db }) {
  const router = express.Router();

  router.get('/security/alerts', authenticateToken, securityAlertsListValidator, validate, async (req, res, next) => {
    try {
      console.log('🔍 GET /api/security/alerts hit');
      const { limit = 50, severity, status } = req.query;
      const rows = await listSecurityAlerts({ db, limit, severity, status });
      console.log(`✅ Found ${rows ? rows.length : 0} alerts`);
      res.json(rows || []);
    } catch (err) {
      console.error('❌ Erreur récupération alertes sécurité:', err.message);
      next(err);
    }
  });

  return router;
};
