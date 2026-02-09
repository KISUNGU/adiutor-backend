function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function createNotificationInternal({ db, userId, type, titre, message, mailId = null }) {
  const result = await dbRun(
    db,
    'INSERT INTO notifications (user_id, type, titre, message, mail_id) VALUES (?, ?, ?, ?, ?)',
    [userId, type, titre, message, mailId],
  );
  return { id: result.lastID };
}

async function getUserByUsername({ db, username }) {
  return dbGet(db, 'SELECT id, username, email FROM users WHERE username = ?', [username]);
}

async function getUsersByRoles({ db, roleIds }) {
  const placeholders = roleIds.map(() => '?').join(',');
  return dbAll(
    db,
    `SELECT id, username, email FROM users WHERE role_id IN (${placeholders}) AND email NOT LIKE '%_old@%'`,
    roleIds,
  );
}

async function notifyMailStatusChange({ db, mailId, status, assignedTo = null, details = {} }) {
  try {
    const mail = await dbGet(db, 'SELECT * FROM incoming_mails WHERE id = ?', [mailId]);
    if (!mail) return;

    let titre = '';
    let message = '';
    let type = '';
    let notifyUsers = [];

    switch (status) {
      case 'Indexé':
        type = 'indexation';
        titre = '📋 Courrier indexé';
        message = `Le courrier "${mail.subject}" de ${mail.sender} a été indexé avec la référence ${mail.ref_code}`;
        notifyUsers = await getUsersByRoles({ db, roleIds: [1, 2] });
        break;

      case 'En Traitement':
        type = 'assignation';
        titre = '📌 Nouveau courrier assigné';
        message = `Le courrier "${mail.subject}" de ${mail.sender} vous a été assigné pour traitement`;
        if (assignedTo) {
          const user = await getUserByUsername({ db, username: assignedTo });
          if (user) notifyUsers = [user];
        }
        break;

      case 'Traité':
        type = 'traitement_execute';
        titre = '✅ Courrier traité';
        message = `Le courrier "${mail.subject}" a été traité avec succès`;
        notifyUsers = await getUsersByRoles({ db, roleIds: [1, 2] });
        if (mail.indexed_by) {
          const indexer = await getUserByUsername({ db, username: mail.indexed_by });
          if (indexer) notifyUsers.push(indexer);
        }
        break;

      case 'Validation':
        type = 'en_attente_validation';
        titre = '⏳ Validation du traitement requise';
        message = `Le courrier "${mail.subject}" a été traité. Validation du traitement requise avant archivage.`;
        notifyUsers = await getUsersByRoles({ db, roleIds: [1, 2] });
        break;

      case 'Retourné':
        type = 'courrier_retourne';
        titre = '🔙 Courrier retourné';
        message = `Le courrier "${mail.subject}" a été retourné à l’indexation. Motif: ${details.returnComment || 'Non spécifié'}`;
        if (mail.indexed_by) {
          const indexer = await getUserByUsername({ db, username: mail.indexed_by });
          if (indexer) notifyUsers = [indexer];
        }
        break;

      case 'Archivé':
        type = 'archivage';
        titre = '📦 Courrier archivé';
        message = `Le courrier "${mail.subject}" a été archivé${details.classeur ? ` dans le classeur "${details.classeur}"` : ''}`;
        notifyUsers = await getUsersByRoles({ db, roleIds: [1, 2] });
        if (mail.assigned_to) {
          const assigned = await getUserByUsername({ db, username: mail.assigned_to });
          if (assigned) notifyUsers.push(assigned);
        }
        break;

      case 'Rejeté':
        type = 'rejet';
        titre = '❌ Courrier rejeté';
        message = `Le courrier "${mail.subject}" a été rejeté. Raison: ${details.rejectionReason || 'Non spécifiée'}`;
        if (mail.indexed_by) {
          const indexer = await getUserByUsername({ db, username: mail.indexed_by });
          if (indexer) notifyUsers = [indexer];
        }
        break;

      default:
        type = 'nouveau_courrier';
        titre = '📨 Nouveau courrier';
        message = `Nouveau courrier reçu: "${mail.subject}" de ${mail.sender}`;
        notifyUsers = await getUsersByRoles({ db, roleIds: [1, 2, 7] });
        break;
    }

    const uniqueUsers = [...new Map((notifyUsers || []).map((u) => [u.id, u])).values()];
    for (const user of uniqueUsers) {
      await createNotificationInternal({
        db,
        userId: user.id,
        type,
        titre,
        message,
        mailId,
      });
    }

    console.log(`✅ Notifications créées pour ${uniqueUsers.length} utilisateur(s) - ${titre}`);
  } catch (error) {
    console.error('Erreur notification changement état:', error);
  }
}

async function countUnread({ db, userId }) {
  const row = await dbGet(
    db,
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND lu = 0',
    [userId],
  );
  return { count: row?.count || 0 };
}

async function listNotifications({ db, userId, limit }) {
  const rows = await dbAll(
    db,
    `SELECT n.*, 
            i.ref_code, i.subject, i.sender 
     FROM notifications n
     LEFT JOIN incoming_mails i ON n.mail_id = i.id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  return rows || [];
}

async function markAllRead({ db, userId }) {
  const result = await dbRun(
    db,
    'UPDATE notifications SET lu = 1 WHERE user_id = ? AND lu = 0',
    [userId],
  );
  return { message: `${result.changes} notification(s) marquée(s) comme lue(s)` };
}

async function markRead({ db, userId, id }) {
  const result = await dbRun(
    db,
    'UPDATE notifications SET lu = 1 WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!result.changes) {
    const err = new Error('Notification non trouvée');
    err.status = 404;
    throw err;
  }
  return { message: 'Notification marquée comme lue' };
}

async function deleteNotification({ db, userId, id }) {
  const result = await dbRun(
    db,
    'DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!result.changes) {
    const err = new Error('Notification non trouvée');
    err.status = 404;
    throw err;
  }
  return { message: 'Notification supprimée avec succès' };
}

async function createNotification({ db, body }) {
  const { user_id, type, titre, message, mail_id } = body;
  const result = await dbRun(
    db,
    'INSERT INTO notifications (user_id, type, titre, message, mail_id) VALUES (?, ?, ?, ?, ?)',
    [user_id, type, titre, message, mail_id || null],
  );
  return { id: result.lastID, message: 'Notification créée avec succès' };
}

module.exports = {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
  deleteNotification,
  createNotification,
  createNotificationInternal,
  notifyMailStatusChange,
  getUsersByRoles,
};
