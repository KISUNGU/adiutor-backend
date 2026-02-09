const express = require('express');
const {
  listPvByCategory,
  listDirectory,
  listOutgoingMails,
  createPv,
  createDirectoryEntry,
} = require('../services/content.service');

module.exports = function contentRoutes({ authenticateToken, validate, pvCategoryParam, db }) {
  const router = express.Router();

  router.get('/pv/:category', authenticateToken, pvCategoryParam, validate, async (req, res, next) => {
    try {
      const { category } = req.params;
      const rows = await listPvByCategory({ db, category });
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des documents :', err.message);
      next(err);
    }
  });

  router.get('/directory', authenticateToken, async (req, res, next) => {
    try {
      const rows = await listDirectory({ db });
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des entrées :', err.message);
      next(err);
    }
  });

  router.post('/pv', authenticateToken, async (req, res, next) => {
    try {
      const { title, category } = req.body || {};
      const id = await createPv({ db, title, category });
      res.status(201).json({ id });
    } catch (err) {
      console.error("Erreur lors de l'ajout d'un document :", err.message);
      next(err);
    }
  });

  router.post('/directory', authenticateToken, async (req, res, next) => {
    try {
      const { name, position, organization, email, category } = req.body || {};
      const id = await createDirectoryEntry({ db, name, position, organization, email, category });
      res.status(201).json({ id });
    } catch (err) {
      console.error("Erreur lors de l'ajout de l'entrée :", err.message);
      next(err);
    }
  });

  router.get('/mails/outgoing', authenticateToken, async (req, res, next) => {
    try {
      console.log('Requête reçue pour GET /api/mails/outgoing');
      const rows = await listOutgoingMails({ db });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
