const logger = require('../utils/logger');

module.exports = function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const reqId = req.headers['x-request-id'] || undefined;

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    logger.info('HTTP', {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: durationMs,
      ip: req.ip,
      request_id: reqId,
      user_id: req.user?.id,
    });
  });

  next();
};
