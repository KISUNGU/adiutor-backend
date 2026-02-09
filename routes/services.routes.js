const express = require('express');
const {
  listServices,
  createService,
  updateService,
  deleteService,
  toggleService,
} = require('../services/services.service');

module.exports = function servicesRoutes({
  db,
  authenticateToken,
  validate,
  serviceIdParam,
  serviceCreateValidator,
  serviceUpdateValidator,
  serviceListValidator,
}) {
  const router = express.Router();

  router.get(
    '/services',
    authenticateToken,
    serviceListValidator,
    validate,
    async (req, res, next) => {
      const activeOnly = req.query.active !== 'false';
      try {
        const rows = await listServices({ db, activeOnly });
        return res.json(rows || []);
      } catch (err) {
        return next(err);
      }
    },
  );

  router.post(
    '/services',
    authenticateToken,
    serviceCreateValidator,
    validate,
    async (req, res, next) => {
      try {
        const result = await createService({ db, body: req.body || {} });
        return res.status(201).json(result);
      } catch (err) {
        return next(err);
      }
    },
  );

  router.put(
    '/services/:id',
    authenticateToken,
    serviceIdParam,
    serviceUpdateValidator,
    validate,
    async (req, res, next) => {
      try {
        const result = await updateService({ db, id: req.params.id, body: req.body || {} });
        return res.json(result);
      } catch (err) {
        return next(err);
      }
    },
  );

  router.delete(
    '/services/:id',
    authenticateToken,
    serviceIdParam,
    validate,
    async (req, res, next) => {
      try {
        const result = await deleteService({ db, id: req.params.id });
        return res.json(result);
      } catch (err) {
        return next(err);
      }
    },
  );

  router.patch(
    '/services/:id/toggle',
    authenticateToken,
    serviceIdParam,
    validate,
    async (req, res, next) => {
      try {
        const result = await toggleService({ db, id: req.params.id });
        return res.json(result);
      } catch (err) {
        return next(err);
      }
    },
  );

  return router;
};
