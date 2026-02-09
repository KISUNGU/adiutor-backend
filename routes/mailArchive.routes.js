const express = require('express');
const { archiveIncomingMailById } = require('../services/mailArchive.service');

module.exports = function mailArchiveRoutes({
  authenticateToken,
  authorizeAdmin,
  validate,
  mailIdParam,
  mailArchiveValidator,
  dbGet,
  dbAll,
  dbRun,
  archiveIncomingMail,
  canUserValidateAssignedService,
  recordEntityHistory,
}) {
  const router = express.Router();

  router.put(
    '/mails/incoming/:id/archive',
    authenticateToken,
    [...mailIdParam, ...mailArchiveValidator],
    validate,
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { comment, category: bodyCategory, classeur: bodyClasseur } = req.body || {};
        const userId = req.user.id;
        const userName = req.user.username;

        const result = await archiveIncomingMailById({
          dbGet,
          dbRun,
          archiveIncomingMail,
          canUserValidateAssignedService,
          recordEntityHistory,
          id,
          comment,
          bodyCategory,
          bodyClasseur,
          userId,
          userName,
          req,
        });

        return res.json({
          id: Number(id),
          archiveId: result.archiveId,
          message: 'Courrier archivé avec succès.',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post('/mails/archive-batch', authenticateToken, authorizeAdmin, async (req, res, next) => {
    try {
      const daysBeforeRaw = Number(req.body?.daysBefore ?? 7);
      const daysBefore = Number.isFinite(daysBeforeRaw) && daysBeforeRaw >= 0 ? Math.floor(daysBeforeRaw) : 7;
      const dateModifier = `-${daysBefore} day`;
      const comment = req.body?.comment || null;
      const category = req.body?.category || null;
      const classeur = req.body?.classeur || null;

      const candidats = await dbAll(
        `
        SELECT id, ref_code, subject, sender
        FROM incoming_mails
        WHERE statut_global = 'Traité'
          AND (date_archivage IS NULL OR TRIM(date_archivage) = '')
          AND date(COALESCE(date_reception, arrival_date, mail_date, created_at)) <= date('now', ?)
        ORDER BY id ASC
        `,
        [dateModifier],
      );

      if (!candidats || candidats.length === 0) {
        return res.json({
          success: true,
          archivedCount: 0,
          message: `Aucun courrier à archiver (statut 'Traité', plus vieux que ${daysBefore} jours).`,
        });
      }

      const archived = [];
      const failed = [];

      for (const mail of candidats) {
        try {
          const result = await archiveIncomingMail(Number(mail.id), {
            userId: req.user?.id,
            userName: req.user?.username,
            comment,
            category,
            classeur,
            deleteOriginal: true,
            req,
          });
          archived.push({
            id: mail.id,
            ref_code: mail.ref_code,
            subject: mail.subject,
            sender: mail.sender,
            archiveId: result?.archiveId,
          });
        } catch (err) {
          failed.push({ id: mail.id, error: err.message });
        }
      }

      return res.json({
        success: failed.length === 0,
        archivedCount: archived.length,
        failedCount: failed.length,
        archived,
        failed,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
