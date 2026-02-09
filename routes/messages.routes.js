const express = require('express');
const { listMessagesBySession, listConversations, createMessage } = require('../services/messages.service');

module.exports = function messagesRoutes({
  authenticateToken,
  validate,
  sessionIdParam,
  userIdParam,
  messageCreateValidator,
  dbAll,
  dbRun,
}) {
  const router = express.Router();

  router.get('/messages/:session_id', authenticateToken, sessionIdParam, validate, async (req, res, next) => {
    try {
      const rows = await listMessagesBySession({ dbAll, sessionId: req.params.session_id });
      res.json({ messages: rows || [] });
    } catch (err) {
      next(err);
    }
  });

  router.get('/conversations/:user_id', authenticateToken, userIdParam, validate, async (req, res, next) => {
    try {
      const requestedUserId = Number(req.params.user_id);
      const actorUserId = Number(req.user?.id);
      const actorRoleId = Number(req.user?.role_id);
      const isPrivileged = actorRoleId === 1 || actorRoleId === 2;

      if (!Number.isFinite(requestedUserId)) {
        return res.status(400).json({ error: 'user_id invalide' });
      }
      if (!isPrivileged && requestedUserId !== actorUserId) {
        return res.status(403).json({ error: 'Accès interdit.' });
      }

      const rows = await listConversations({ dbAll, requestedUserId });
      res.json({ sessions: rows || [] });
    } catch (err) {
      next(err);
    }
  });

  router.post('/messages', authenticateToken, messageCreateValidator, validate, async (req, res, next) => {
    try {
      const { session_id, role, content } = req.body;
      const user_id = req.user?.id;
      const result = await createMessage({ dbRun, sessionId: session_id, userId: user_id, role, content });
      res.json({ id: result.id });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
