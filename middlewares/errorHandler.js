const logger = require('../utils/logger');

module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const payload = {
    error: err.publicMessage || err.message || 'Erreur serveur.',
  };

  if (err.code) payload.code = err.code;
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  logger.error('HTTP_ERROR', {
    status,
    method: req.method,
    path: req.originalUrl || req.url,
    message: err.message,
    code: err.code,
    stack: err.stack,
  });

  return res.status(status).json(payload);
};
