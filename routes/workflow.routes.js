const express = require('express');
const { getWorkflowKpi, getWorkflowPerformance } = require('../services/workflow.service');

module.exports = function workflowRoutes({ authenticateToken, dbGet, dbAll }) {
  const router = express.Router();

  router.get('/workflow/kpi', authenticateToken, async (req, res, next) => {
    try {
      const data = await getWorkflowKpi({ dbGet, dbAll });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.get('/workflow/performance', authenticateToken, async (req, res, next) => {
    try {
      const data = await getWorkflowPerformance({ dbGet, dbAll });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
