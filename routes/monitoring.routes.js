const express = require('express');

module.exports = function monitoringRoutes({ authenticateToken, authorizeRoles, metrics, logger, minioConfig, passport, db }) {
  const router = express.Router();

  // Endpoint Prometheus metrics
  router.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', metrics.register.contentType);
      const metricsData = await metrics.getMetrics();
      res.end(metricsData);
    } catch (e) {
      logger.error('Erreur export métriques:', e);
      res.status(500).end();
    }
  });

  // Healthcheck
  router.get('/health', (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: true,
        minio: minioConfig !== null,
        oauth: passport !== null,
      },
    };

    res.json(health);
  });

  router.get('/api/health', async (req, res) => {
    let database = 'up';
    if (db && typeof db.get === 'function') {
      await new Promise((resolve) => {
        db.get('SELECT 1', [], (err) => {
          if (err) database = 'error';
          resolve();
        });
      });
    }
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      port: process.env.PORT || 4000,
      database,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  // Status détaillé (admin seulement)
  router.get('/api/status', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
      const metricsData = await metrics.getMetrics();

      res.json({
        server: {
          version: '3.0.0',
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
        },
        memory: process.memoryUsage(),
        services: {
          database: true,
          minio: minioConfig !== null,
          oauth: passport !== null,
        },
        metrics: metricsData,
      });
    } catch (e) {
      logger.error('Erreur status:', e);
      res.status(500).json({ error: 'Erreur récupération status' });
    }
  });

  return router;
};
