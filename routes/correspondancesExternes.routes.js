const express = require('express');
const {
  listExternes,
  createExterne,
  bulkCreateExternes,
  deleteExterne,
} = require('../services/correspondancesExternes.service');

module.exports = function correspondancesExternesRoutes({
  authenticateToken,
  validate,
  externeIdParam,
  externeCreateValidator,
  externeBulkValidator,
  upload,
  db,
}) {
  const router = express.Router();

  router.get('/correspondances-externes', authenticateToken, async (req, res, next) => {
    try {
      console.log('Requête reçue pour GET /api/correspondances-externes');
      const rows = await listExternes({ db });
      console.log('Correspondances récupérées :', rows);
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des correspondances :', err.message);
      next(err);
    }
  });

  router.post(
    '/correspondances-externes',
    authenticateToken,
    upload.single('pieceJointe'),
    externeCreateValidator,
    validate,
    async (req, res, next) => {
      try {
        const piece_jointe = req.file ? `/uploads/${req.file.filename}` : null;
        const result = await createExterne({ db, payload: req.body || {}, pieceJointe: piece_jointe });
        res.status(201).json({ id: result.id });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/correspondances-externes/bulk',
    authenticateToken,
    externeBulkValidator,
    validate,
    async (req, res, next) => {
      try {
        const result = await bulkCreateExternes({ db, correspondances: req.body });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/correspondances-externes/:id',
    authenticateToken,
    externeIdParam,
    validate,
    async (req, res, next) => {
      try {
        const { id } = req.params;
        await deleteExterne({ db, id: Number(id) });
        res.json({ message: 'Correspondance supprimée avec succès' });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
};
