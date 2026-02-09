const express = require('express');

module.exports = function searchMemoryRoutes({ authenticateToken, validate, searchMemoryValidator, queryMemoryStore }) {
  const router = express.Router();

  router.get('/search-memory', authenticateToken, searchMemoryValidator, validate, async (req, res, next) => {
    try {
      const query = req.query.q;
      const results = await queryMemoryStore(query);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
