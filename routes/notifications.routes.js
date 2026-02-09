const express = require('express');
const {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
  deleteNotification,
  createNotification,
} = require('../services/notifications.service');

module.exports = function notificationsRoutes({
  db,
  authenticateToken,
  validate,
  notificationIdParam,
  notificationCreateValidator,
}) {
  const router = express.Router();

  router.get('/notifications/unread/count', authenticateToken, async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Token d'authentification manquant." });
    }
    try {
      const result = await countUnread({ db, userId });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.get('/notifications', authenticateToken, async (req, res, next) => {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    try {
      const rows = await listNotifications({ db, userId, limit });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  router.patch('/notifications/read-all', authenticateToken, async (req, res, next) => {
    const userId = req.user?.id;
    try {
      const result = await markAllRead({ db, userId });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.patch(
    '/notifications/:id/read',
    authenticateToken,
    notificationIdParam,
    validate,
    async (req, res, next) => {
      const userId = req.user?.id;
      try {
        const result = await markRead({ db, userId, id: req.params.id });
        return res.json(result);
      } catch (err) {
        return next(err);
      }
    },
  );

  router.delete(
    '/notifications/:id',
    authenticateToken,
    notificationIdParam,
    validate,
    async (req, res, next) => {
      const userId = req.user?.id;
      try {
        const result = await deleteNotification({ db, userId, id: req.params.id });
        return res.json(result);
      } catch (err) {
        return next(err);
      }
    },
  );

  router.post(
    '/notifications',
    authenticateToken,
    notificationCreateValidator,
    validate,
    async (req, res, next) => {
      try {
        const result = await createNotification({ db, body: req.body || {} });
        return res.status(201).json(result);
      } catch (err) {
        return next(err);
      }
    },
  );

  return router;
};
