const express = require('express');
const {
  listInternes,
  getInterneById,
  getInternesStats,
  createInterne,
  deleteInterne,
} = require('../services/correspondancesInternes.service');

module.exports = function correspondancesInternesRoutes({
  authenticateToken,
  authorizeRoles,
  validate,
  interneIdParam,
  interneStatsValidator,
  interneCreateValidator,
  upload,
  db,
  baseDir,
}) {
  const router = express.Router();

  router.get('/correspondances-internes', authenticateToken, async (req, res, next) => {
    try {
      const rows = await listInternes({ db });
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des correspondances internes :', err.message);
      next(err);
    }
  });

  router.get(
    '/correspondances-internes/stats',
    authenticateToken,
    authorizeRoles(['secretariat', 'coordonnateur', 'raf']),
    interneStatsValidator,
    validate,
    async (req, res, next) => {
      try {
        const { period, startDate, endDate } = req.query;
        const row = await getInternesStats({ db, period, startDate, endDate });
        res.json(row || { total: 0, draft: 0, inProgress: 0, treated: 0 });
      } catch (err) {
        console.error('Erreur stats internes:', err.message, err.stack);
        next(err);
      }
    },
  );

  router.get(
    '/correspondances-internes/:id',
    authenticateToken,
    interneIdParam,
    validate,
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'id invalide' });
        const row = await getInterneById({ db, id });
        if (!row) return res.status(404).json({ error: 'Correspondance interne non trouvée' });
        return res.json(row);
      } catch (err) {
        console.error('Erreur récupération correspondance interne :', err.message);
        next(err);
      }
    },
  );

  router.post(
    '/correspondances-internes',
    authenticateToken,
    upload.single('pieceJointe'),
    interneCreateValidator,
    validate,
    async (req, res, next) => {
      try {
        const pieceJointe = req.file ? `/uploads/${req.file.filename}` : null;
        const result = await createInterne({
          db,
          payload: req.body || {},
          pieceJointe,
          createdBy: req.user?.email || 'admin',
        });
        res.status(201).json({ message: 'Correspondance interne créée avec succès', id: result.id });
      } catch (err) {
        console.error('Erreur dans endpoint correspondances-internes:', err);
        next(err);
      }
    },
  );

  router.post(
    '/test/correspondances-internes',
    authenticateToken,
    interneStatsValidator,
    validate,
    async (req, res, next) => {
      try {
        const result = await createInterne({
          db,
          payload: req.body || {},
          pieceJointe: null,
          createdBy: req.user?.email || 'admin',
        });
        res.status(201).json({ message: 'Test réussi', id: result.id });
      } catch (err) {
        console.error('Erreur test endpoint:', err);
        next(err);
      }
    },
  );

  router.delete(
    '/correspondances-internes/:id',
    authenticateToken,
    interneIdParam,
    validate,
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        await deleteInterne({ db, id, baseDir });
        res.status(200).json({ message: 'Correspondance interne supprimée avec succès' });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
};
