const express = require('express');
const { deleteById } = require('../services/cleanup.service');

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

module.exports = function cleanupRoutes({ authenticateToken, validate, idParam, db, logAction }) {
  const router = express.Router();

  router.delete('/archives/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteById({ db, table: 'archives', id: Number(id) });
      res.status(200).json({ message: 'Document supprimé avec succès' });
    } catch (err) {
      console.error('Erreur lors de la suppression du document :', err.message);
      next(err);
    }
  });

  router.delete('/pv/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteById({ db, table: 'pv', id: Number(id) });
      res.status(200).json({ message: 'Document supprimé avec succès' });
    } catch (err) {
      console.error('Erreur lors de la suppression du document :', err.message);
      next(err);
    }
  });

  router.delete('/directory/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteById({ db, table: 'directory', id: Number(id) });
      res.status(200).json({ message: 'Entrée supprimée avec succès' });
    } catch (err) {
      console.error("Erreur lors de la suppression de l'entrée :", err.message);
      next(err);
    }
  });

  router.delete('/mails/incoming/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteById({ db, table: 'incoming_mails', id: Number(id) });
      res.status(200).json({ message: 'Courrier supprimé avec succès' });
    } catch (err) {
      console.error('Erreur lors de la suppression du courrier :', err.message);
      next(err);
    }
  });

  router.delete('/stocks/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteById({ db, table: 'stocks', id: Number(id) });
      res.status(200).json({ message: 'Stock supprimé avec succès' });
    } catch (err) {
      console.error("Erreur lors de la suppression d'un stock :", err.message);
      next(err);
    }
  });

  router.delete('/equipments/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteById({ db, table: 'equipments', id: Number(id) });
      res.status(200).json({ message: 'Équipement supprimé avec succès' });
    } catch (err) {
      console.error("Erreur lors de la suppression de l'équipement :", err.message);
      next(err);
    }
  });

  router.delete('/reservations/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      await deleteById({ db, table: 'reservations', id: Number(id) });
      res.status(200).json({ message: 'Réservation supprimée avec succès' });
    } catch (err) {
      console.error("Erreur lors de la suppression de la réservation :", err.message);
      next(err);
    }
  });

  router.delete('/planifications/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const row = await dbGet(db, 'SELECT reference FROM planifications WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ error: 'Planification non trouvée' });
      await deleteById({ db, table: 'planifications', id: Number(id) });
      if (typeof logAction === 'function') {
        logAction('planification', id, 'DELETE', `Planification ${row.reference} supprimée`);
      }
      res.status(200).json({ message: 'Planification supprimée avec succès' });
    } catch (err) {
      console.error('Erreur suppression planification:', err.message);
      next(err);
    }
  });

  router.delete('/appels/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const row = await dbGet(db, 'SELECT reference FROM appels WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ error: 'Appel non trouvé' });
      await deleteById({ db, table: 'appels', id: Number(id) });
      if (typeof logAction === 'function') {
        logAction('appel', id, 'DELETE', `Appel d'offre ${row.reference} supprimé`);
      }
      res.status(200).json({ message: 'Appel d\'offres supprimé avec succès' });
    } catch (err) {
      console.error('Erreur suppression appel:', err.message);
      next(err);
    }
  });

  router.delete('/contrats/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const row = await dbGet(db, 'SELECT reference FROM contrats WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ error: 'Contrat non trouvé' });
      await deleteById({ db, table: 'contrats', id: Number(id) });
      if (typeof logAction === 'function') {
        logAction('contrat', id, 'DELETE', `Contrat ${row.reference} supprimé`);
      }
      res.status(200).json({ message: 'Contrat supprimé avec succès' });
    } catch (err) {
      console.error('Erreur suppression contrat:', err.message);
      next(err);
    }
  });

  router.delete('/rapports/:id', authenticateToken, idParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const row = await dbGet(db, 'SELECT reference FROM rapports WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ error: 'Rapport non trouvé' });
      await deleteById({ db, table: 'rapports', id: Number(id) });
      if (typeof logAction === 'function') {
        logAction('rapport', id, 'DELETE', `Rapport ${row.reference} supprimé`);
      }
      res.status(200).json({ message: 'Rapport supprimé avec succès' });
    } catch (err) {
      console.error('Erreur suppression rapport:', err.message);
      next(err);
    }
  });

  return router;
};
