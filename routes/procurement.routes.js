const express = require('express');
const {
  listPlanifications,
  createPlanification,
  bulkPlanifications,
  updatePlanification,
  listAppels,
  createAppel,
  bulkAppels,
  updateAppel,
  listContrats,
  createContrat,
  bulkContrats,
  updateContrat,
  listRapports,
  createRapport,
  bulkRapports,
  updateRapport,
} = require('../services/procurement.service');

module.exports = function procurementRoutes({ authenticateToken, upload, db, logAction }) {
  const router = express.Router();

  // Planifications
  router.get('/planifications', authenticateToken, async (req, res) => {
    try {
      const rows = await listPlanifications({ db });
      res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/planifications', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : null;
      const id = await createPlanification({ db, payload: req.body, pieceJointe, logAction });
      res.status(201).json({ id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/planifications/bulk', authenticateToken, async (req, res) => {
    try {
      const inserted = await bulkPlanifications({ db, items: req.body, logAction });
      res.status(201).json({ message: `${inserted} planifications importées` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/planifications/:id', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const { id } = req.params;
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : req.body.piece_jointe;
      const result = await updatePlanification({
        db,
        id,
        payload: req.body,
        pieceJointe,
        logAction,
      });
      if (result.notFound) return res.status(404).json({ error: 'Planification non trouvée' });
      return res.json({ message: 'Planification mise à jour' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Appels d'offres
  router.get('/appels', authenticateToken, async (req, res) => {
    try {
      const rows = await listAppels({ db });
      res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/appels', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : null;
      const id = await createAppel({ db, payload: req.body, pieceJointe, logAction });
      res.status(201).json({ id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/appels/bulk', authenticateToken, async (req, res) => {
    try {
      const inserted = await bulkAppels({ db, items: req.body, logAction });
      res.status(201).json({ message: `${inserted} appels importés` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/appels/:id', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const { id } = req.params;
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : req.body.piece_jointe;
      const result = await updateAppel({
        db,
        id,
        payload: req.body,
        pieceJointe,
        logAction,
      });
      if (result.notFound) return res.status(404).json({ error: 'Appel non trouvé' });
      return res.json({ message: 'Appel mis à jour' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Contrats
  router.get('/contrats', authenticateToken, async (req, res) => {
    try {
      const rows = await listContrats({ db });
      res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/contrats', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : null;
      const id = await createContrat({ db, payload: req.body, pieceJointe, logAction });
      res.status(201).json({ id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/contrats/bulk', authenticateToken, async (req, res) => {
    try {
      const inserted = await bulkContrats({ db, items: req.body, logAction });
      res.status(201).json({ message: `${inserted} contrats importés` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/contrats/:id', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const { id } = req.params;
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : req.body.piece_jointe;
      const result = await updateContrat({
        db,
        id,
        payload: req.body,
        pieceJointe,
        logAction,
      });
      if (result.notFound) return res.status(404).json({ error: 'Contrat non trouvé' });
      return res.json({ message: 'Contrat mis à jour' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Rapports d'attribution
  router.get('/rapports', authenticateToken, async (req, res) => {
    try {
      const rows = await listRapports({ db });
      res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rapports', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : null;
      const id = await createRapport({ db, payload: req.body, pieceJointe, logAction });
      res.status(201).json({ id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rapports/bulk', authenticateToken, async (req, res) => {
    try {
      const inserted = await bulkRapports({ db, items: req.body, logAction });
      res.status(201).json({ message: `${inserted} rapports importés` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/rapports/:id', authenticateToken, upload.single('pieceJointe'), async (req, res) => {
    try {
      const { id } = req.params;
      const pieceJointe = req.file ? `/uploads/${req.file.filename}` : req.body.piece_jointe;
      const result = await updateRapport({
        db,
        id,
        payload: req.body,
        pieceJointe,
        logAction,
      });
      if (result.notFound) return res.status(404).json({ error: 'Rapport non trouvé' });
      return res.json({ message: 'Rapport mis à jour' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};
