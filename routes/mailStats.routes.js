const express = require('express');
const { getMailStatistics, getQuickActions } = require('../services/mailStats.service');

module.exports = function mailStatsRoutes({ authenticateToken, validate, mailStatisticsValidator, db }) {
  const router = express.Router();

  router.get('/mails/statistics', authenticateToken, mailStatisticsValidator, validate, async (req, res, next) => {
    try {
      const period = (req.query.period || 'all').toString();
      console.log('📊 GET /api/mails/statistics period=', period, 'user=', req.user?.id);

      const stats = await getMailStatistics({ db, period });
      return res.json(stats);
    } catch (err) {
      if (err.code === 'SCHEMA_MISMATCH') {
        return res.status(500).json({
          error: 'SCHEMA_MISMATCH',
          message: err.message,
          existingColumns: err.details?.existingColumns,
        });
      }
      console.error('❌ SQL ERROR /api/mails/statistics:', err.message);
      return res.status(500).json({ error: 'SQL_ERROR', detail: err.message });
    }
  });

  router.get('/quick-actions', authenticateToken, async (req, res, next) => {
    try {
      const actions = getQuickActions();
      res.json(actions);
    } catch (err) {
      console.error('Erreur /api/quick-actions:', err.message);
      next(err);
    }
  });

  return router;
};
