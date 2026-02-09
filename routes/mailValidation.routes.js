const express = require('express');
const { validateIncomingMail } = require('../services/mailValidation.service');

module.exports = function mailValidationRoutes({
  authenticateToken,
  validate,
  mailIdParam,
  mailValidateValidator,
  dbGet,
  dbRun,
  canTransition,
  canUserValidateAssignedService,
  recordHistory,
  archiveIncomingMail,
  notifyMailStatusChange,
}) {
  const router = express.Router();

  router.put(
    '/mails/incoming/:id/validate',
    authenticateToken,
    [...mailIdParam, ...mailValidateValidator],
    validate,
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { comment, category: bodyCategory, classeur: bodyClasseur } = req.body || {};
        const userId = req.user.id;
        const userName = req.user.username;

        const autoArchive =
          typeof req.body?.autoArchive === 'boolean'
            ? req.body.autoArchive
            : process.env.AUTO_ARCHIVE_ON_VALIDATE !== 'false';

        const result = await validateIncomingMail({
          dbGet,
          dbRun,
          canTransition,
          canUserValidateAssignedService,
          recordHistory,
          archiveIncomingMail,
          notifyMailStatusChange,
          id,
          comment,
          bodyCategory,
          bodyClasseur,
          autoArchive,
          userId,
          userName,
          req,
        });

        if (result.new_status === 'Archivé') {
          return res.json({
            id: Number(id),
            archiveId: result.archiveId,
            message: 'Courrier validé et archivé automatiquement.',
            new_status: 'Archivé',
          });
        }

        return res.json({
          id: Number(id),
          message: 'Courrier validé avec succès. Prêt pour l’archivage.',
          new_status: 'Validation',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
};
