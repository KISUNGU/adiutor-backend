const express = require('express');

module.exports = function timestampRoutes({
  authenticateToken,
  authorizeRoles,
  metrics,
  logger,
  timestampModule,
  minioConfig,
  fs,
  path,
}) {
  const router = express.Router();
  const fsLib = fs || require('fs');
  const pathLib = path || require('path');

  // Créer timestamp pour un hash
  router.post('/timestamp/create', authenticateToken, authorizeRoles(['admin', 'archiviste']), async (req, res) => {
    const start = metrics.startTimer();
    try {
      const { hash, objectName } = req.body;

      if (!hash) {
        return res.status(400).json({ error: 'Hash requis' });
      }

      logger.timestamp('create', hash, false, { objectName, user: req.user.username });

      const timestamp = await timestampModule.requestTimestamp(hash);

      if (minioConfig && objectName) {
        const tmpPath = pathLib.join(require('os').tmpdir(), `${objectName}.tsr`);
        fsLib.writeFileSync(tmpPath, JSON.stringify(timestamp));

        await minioConfig.uploadToMinIO(tmpPath, `${objectName}.tsr`, minioConfig.WORM_BUCKET, {
          'x-amz-meta-timestamp': 'true',
          'x-amz-meta-related-object': objectName,
          'x-amz-meta-gen-time': timestamp.genTime,
        });

        logger.minio('upload', minioConfig.WORM_BUCKET, `${objectName}.tsr`);
      }

      const duration = metrics.endTimer(start);
      metrics.recordTimestamp('create', true, duration);
      logger.timestamp('create', hash, true, { objectName, genTime: timestamp.genTime });

      res.json({
        message: 'Timestamp créé',
        timestamp,
        report: timestampModule.generateTimestampReport(timestamp),
      });
    } catch (e) {
      const duration = metrics.endTimer(start);
      metrics.recordTimestamp('create', false, duration);
      logger.error('Erreur création timestamp:', e);
      res.status(500).json({ error: 'Erreur création timestamp', details: e.message });
    }
  });

  // Vérifier un timestamp
  router.post('/timestamp/verify', authenticateToken, async (req, res) => {
    const start = metrics.startTimer();
    try {
      const { hash, timestamp } = req.body;

      if (!hash || !timestamp) {
        return res.status(400).json({ error: 'Hash et timestamp requis' });
      }

      const verification = timestampModule.verifyTimestamp(hash, timestamp);

      const duration = metrics.endTimer(start);
      metrics.recordTimestamp('verify', verification.valid, duration);
      logger.timestamp('verify', hash, verification.valid, verification);

      res.json({
        verification,
        report: verification.valid ? timestampModule.generateTimestampReport(timestamp) : null,
      });
    } catch (e) {
      const duration = metrics.endTimer(start);
      metrics.recordTimestamp('verify', false, duration);
      logger.error('Erreur vérification timestamp:', e);
      res.status(500).json({ error: 'Erreur vérification timestamp', details: e.message });
    }
  });

  return router;
};
