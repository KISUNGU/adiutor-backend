const express = require('express');

module.exports = function debugRoutes({ authenticateToken, requireDebugEnabled }) {
  const router = express.Router();

  router.get('/debug/auth-check', authenticateToken, requireDebugEnabled, (req, res) => {
    res.json({ authenticated: true, user: req.user, message: 'Token valide' });
  });

  router.get('/debug/token-check', authenticateToken, requireDebugEnabled, (req, res) => {
    return res.json({ valid: true, user: req.user });
  });

  return router;
};
