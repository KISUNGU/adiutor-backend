const express = require('express');
const {
  listEquipments,
  listReservations,
  listFiles,
  createEquipment,
  createReservation,
} = require('../services/misc.service');

module.exports = function miscRoutes({ authenticateToken, db, logger }) {
  const router = express.Router();

  router.post('/pv', authenticateToken, (req, res) => {
    const { title, category } = req.body;
    db.run('INSERT INTO pv (title, category) VALUES (?, ?)', [title, category], function (err) {
      if (err) {
        console.error('Erreur lors de l\'ajout d\'un document :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    });
  });

  router.post('/directory', authenticateToken, (req, res) => {
    const { name, position, organization, email, category } = req.body;
    db.run(
      'INSERT INTO directory (name, position, organization, email, category) VALUES (?, ?, ?, ?, ?)',
      [name, position, organization, email, category],
      function (err) {
        if (err) {
          console.error('Erreur lors de l\'ajout de l\'entrée :', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
      },
    );
  });

  router.post('/equipments', authenticateToken, (req, res) => {
    const { name, type, status, acquisition_date } = req.body;
    db.run(
      'INSERT INTO equipments (name, type, status, acquisition_date) VALUES (?, ?, ?, ?)',
      [name, type, status, acquisition_date],
      function (err) {
        if (err) {
          console.error('Erreur lors de l\'ajout d\'un équipement :', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
      },
    );
  });

  router.post('/reservations', authenticateToken, (req, res) => {
    const { name, destination, date, type } = req.body;
    db.run(
      'INSERT INTO reservations (name, destination, date, type) VALUES (?, ?, ?, ?)',
      [name, destination, date, type],
      function (err) {
        if (err) {
          console.error('Erreur lors de l\'ajout d\'une réservation :', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
      },
    );
  });

  router.get('/equipments', authenticateToken, async (req, res, next) => {
    try {
      const rows = await listEquipments({ db });
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des équipements :', err.message);
      next(err);
    }
  });

  router.post('/equipments', authenticateToken, async (req, res, next) => {
    try {
      const id = await createEquipment({ db, payload: req.body || {} });
      res.status(201).json({ id });
    } catch (err) {
      console.error("Erreur lors de l'ajout d'un équipement :", err.message);
      next(err);
    }
  });

  router.get('/reservations', authenticateToken, async (req, res, next) => {
    try {
      const rows = await listReservations({ db });
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des réservations :', err.message);
      next(err);
    }
  });

  router.post('/reservations', authenticateToken, async (req, res, next) => {
    try {
      const id = await createReservation({ db, payload: req.body || {} });
      res.status(201).json({ id });
    } catch (err) {
      console.error("Erreur lors de l'ajout d'une réservation :", err.message);
      next(err);
    }
  });

  router.get('/files', authenticateToken, async (req, res, next) => {
    try {
      const files = await listFiles({ db });
      res.json({ files });
    } catch (err) {
      if (logger) {
        logger.error('Erreur lors de la récupération des fichiers', { error: err.message });
      }
      next(err);
    }
  });

  return router;
};
