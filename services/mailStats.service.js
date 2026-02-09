function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function getMailStatistics({ db, period }) {
  const cols = await dbAll(db, 'PRAGMA table_info(incoming_mails)');
  const colNames = (cols || []).map((c) => c.name);

  if (!colNames.includes('statut_global')) {
    const err = new Error("La colonne 'statut_global' n'existe pas dans incoming_mails.");
    err.code = 'SCHEMA_MISMATCH';
    err.details = { existingColumns: colNames };
    throw err;
  }

  const dateField = colNames.includes('date_reception')
    ? 'date_reception'
    : colNames.includes('mail_date')
      ? 'mail_date'
      : null;

  let where = '';
  const params = [];

  if (dateField && period !== 'all') {
    if (period === 'today') {
      where = `WHERE date(${dateField}) = date('now')`;
    } else if (period === '7d') {
      where = `WHERE date(${dateField}) >= date('now', '-7 day')`;
    } else if (period === '30d') {
      where = `WHERE date(${dateField}) >= date('now', '-30 day')`;
    }
  }

  const sql = `
    SELECT statut_global, COUNT(*) as count
    FROM incoming_mails
    ${where}
    GROUP BY statut_global
  `;

  const rows = await dbAll(db, sql, params);

  const stats = { total: 0, acquired: 0, indexed: 0, inTreatment: 0, treated: 0, archived: 0 };

  (rows || []).forEach((row) => {
    const count = Number(row.count || 0);
    stats.total += count;

    const rawStatus = String(row.statut_global || '').toLowerCase();
    const status = rawStatus
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (status.includes('acquis')) {
      stats.acquired += count;
    } else if (status.includes('index')) {
      stats.indexed += count;
    } else if (status.includes('validation')) {
      stats.inTreatment += count;
    } else if (status.includes('traitement') || status.includes('en traitement')) {
      stats.inTreatment += count;
    } else if (status.includes('traite')) {
      stats.treated += count;
    } else if (status.includes('archive')) {
      stats.archived += count;
    } else {
      // unknown status ignored
    }
  });

  return stats;
}

function getQuickActions() {
  return [
    { label: 'Nouveau Courrier Entrant', icon: 'cilInbox', route: '/courrier-entrant/acquisition', color: 'info' },
    { label: 'Nouveau Courrier Sortant', icon: 'cilPaperPlane', route: '/courrier-sortant/envoi', color: 'warning' },
    { label: 'Créer Courrier Interne', icon: 'cilSwapHorizontal', route: '/courrier-interne/nouveau', color: 'success' },
    { label: 'Courriers à traiter', icon: 'cilTask', route: '/courrier-entrant/traitement', color: 'danger' },
    { label: 'À valider', icon: 'cilCheckCircle', route: '/courrier-sortant/validation', color: 'secondary' },
    { label: 'Recherche avancée', icon: 'cilSearch', route: '/recherche', color: 'dark' },
  ];
}

module.exports = {
  getMailStatistics,
  getQuickActions,
};
