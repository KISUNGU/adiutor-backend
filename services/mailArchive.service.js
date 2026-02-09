async function archiveIncomingMailById({
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
}) {
  const mail = await dbGet(
    'SELECT id, assigned_service, statut_global FROM incoming_mails WHERE id = ?',
    [Number(id)],
  );
  if (!mail) {
    const err = new Error('Courrier introuvable.');
    err.status = 404;
    throw err;
  }

  const svc = String(mail.assigned_service || '').trim().toUpperCase();
  if (!canUserValidateAssignedService(req.user, svc)) {
    const err = new Error(`Accès interdit: archivage réservé au service '${svc || 'N/A'}' ou admin.`);
    err.status = 403;
    throw err;
  }

  const result = await archiveIncomingMail(Number(id), {
    userId,
    userName,
    comment,
    category: bodyCategory,
    classeur: bodyClasseur,
    deleteOriginal: true,
    req,
  });

  try {
    const row = await dbGet('SELECT response_outgoing_id FROM incoming_mails WHERE id = ?', [Number(id)]);
    const outgoingId = row?.response_outgoing_id != null ? Number(row.response_outgoing_id) : null;
    if (outgoingId && Number.isFinite(outgoingId) && outgoingId > 0) {
      await dbRun(
        `UPDATE courriers_sortants
         SET archived_at = COALESCE(archived_at, datetime('now')),
             archived_by = COALESCE(archived_by, ?),
             updated_at = datetime('now')
         WHERE id = ?`,
        [userId || null, outgoingId],
      );
      try {
        recordEntityHistory(
          'courriers_sortants',
          outgoingId,
          'Archivage lié (entrant archivé)',
          userId,
          userName,
          { incoming_mail_id: Number(id), archive_id: result.archiveId },
          req,
        );
      } catch (_) {}
    }
  } catch (e) {
    console.warn('⚠️ Archivage couplé sortant ignoré:', e.message);
  }

  return { archiveId: result.archiveId };
}

module.exports = {
  archiveIncomingMailById,
};
