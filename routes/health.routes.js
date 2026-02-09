const express = require('express');

module.exports = function healthRoutes({ db }) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    let database = 'up';
    await new Promise((resolve) => {
      db.get('SELECT 1', [], (err) => {
        if (err) database = 'error';
        resolve();
      });
    });
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      port: process.env.PORT || 4000,
      database,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  return router;
};
