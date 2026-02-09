async function validateIncomingMail({
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
}) {
  const mail = await dbGet('SELECT * FROM incoming_mails WHERE id = ?', [id]);
  if (!mail) {
    const err = new Error('Courrier non trouvé.');
    err.status = 404;
    throw err;
  }

  const svc = String(mail.assigned_service || '').trim().toUpperCase();
  if (!canUserValidateAssignedService(req.user, svc)) {
    const err = new Error(`Accès interdit: validation réservée au service '${svc || 'N/A'}' ou admin.`);
    err.status = 403;
    throw err;
  }

  if (!['Validation', 'Traité'].includes(mail.statut_global)) {
    const err = new Error(
      `Le courrier doit être en statut 'Validation' (ou 'Traité' en historique) pour être validé. Statut actuel: ${mail.statut_global}.`,
    );
    err.status = 409;
    throw err;
  }

  if (mail.statut_global === 'Traité' && !canTransition(mail.statut_global, 'Validation')) {
    const err = new Error('Transition illégale vers Validation.');
    err.status = 409;
    throw err;
  }

  if (!canTransition('Validation', 'Archivé')) {
    const err = new Error('Transition illégale vers Archivage.');
    err.status = 409;
    throw err;
  }

  await dbRun('BEGIN');

  try {
    if (mail.statut_global === 'Traité') {
      const upd = await dbRun(
        `UPDATE incoming_mails
         SET statut_global = ?, comment = COALESCE(?, comment)
         WHERE id = ?`,
        ['Validation', comment || null, id],
      );
      if (upd.changes === 0) {
        const err = new Error('Aucune mise à jour effectuée.');
        err.status = 404;
        throw err;
      }
    } else if (comment) {
      await dbRun(
        `UPDATE incoming_mails
         SET comment = COALESCE(?, comment)
         WHERE id = ?`,
        [comment, id],
      );
    }

    await recordHistory(
      Number(id),
      'Courrier validé et prêt pour archivage',
      userId,
      userName,
      JSON.stringify({
        previous_status: mail.statut_global,
        new_status: 'Validation',
        validated_by: userName,
        validation_comment: comment || null,
      }),
      req,
    );

    if (autoArchive) {
      const archRes = await archiveIncomingMail(Number(id), {
        userId,
        userName,
        comment: comment || null,
        category: bodyCategory,
        classeur: bodyClasseur,
        deleteOriginal: true,
        req,
      });

      await dbRun('COMMIT');

      notifyMailStatusChange(Number(id), 'Archivé', null, { validatedBy: userName }).catch(() => {});

      return { new_status: 'Archivé', archiveId: archRes.archiveId };
    }

    await dbRun('COMMIT');

    notifyMailStatusChange(Number(id), 'Validation', null, { validatedBy: userName }).catch(() => {});

    return { new_status: 'Validation' };
  } catch (error) {
    try {
      await dbRun('ROLLBACK');
    } catch (_) {}
    throw error;
  }
}

module.exports = {
  validateIncomingMail,
};
