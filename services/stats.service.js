function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function getCourriersStats({ db }) {
  const [totalIncoming, totalOutgoing, totalExternal, totalInternal] = await Promise.all([
    dbGet(db, 'SELECT COUNT(id) AS count FROM incoming_mails'),
    dbGet(db, 'SELECT COUNT(id) AS count FROM outgoing_mails'),
    dbGet(db, 'SELECT COUNT(id) AS count FROM correspondances_externes'),
    dbGet(db, 'SELECT COUNT(id) AS count FROM correspondances_internes'),
  ]);

  return [
    {
      color: 'info',
      title: 'Courriers Entrants',
      value: (totalIncoming?.count || 0).toString(),
      change: '+5.1%',
      direction: 'up',
      data: [10, 20, 15, 25, 22, 30],
    },
    {
      color: 'warning',
      title: 'Courriers Sortants',
      value: (totalOutgoing?.count || 0).toString(),
      change: '-1.5%',
      direction: 'down',
      data: [30, 25, 20, 18, 25, 28],
    },
    {
      color: 'success',
      title: 'Correspondances Externes',
      value: (totalExternal?.count || 0).toString(),
      change: '+12.5%',
      direction: 'up',
      data: [5, 15, 10, 18, 15, 25],
    },
    {
      color: 'primary',
      title: 'Correspondances Internes',
      value: (totalInternal?.count || 0).toString(),
      change: '+3.2%',
      direction: 'up',
      data: [2, 5, 8, 12, 10, 15],
    },
  ];
}

async function getMonthlyStats({ db }) {
  const incoming = await dbAll(
    db,
    `
      SELECT 
        strftime('%Y-%m', date_reception) as month,
        COUNT(*) as count
      FROM incoming_mails
      WHERE date_reception >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `,
  );

  const archived = await dbAll(
    db,
    `
      SELECT 
        strftime('%Y-%m', date_archivage) as month,
        COUNT(*) as count
      FROM incoming_mails
      WHERE statut_global = 'Archivé' AND date_archivage >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `,
  );

  return { incoming, archived };
}

async function getByClasseurStats({ db }) {
  return dbAll(
    db,
    `
      SELECT 
        classeur,
        COUNT(*) as count
      FROM incoming_mails
      WHERE classeur IS NOT NULL AND classeur != ''
      GROUP BY classeur
      ORDER BY count DESC
      LIMIT 10
    `,
  );
}

async function getTopSendersStats({ db }) {
  const cols = await dbAll(db, 'PRAGMA table_info(incoming_mails)');
  const colNames = (cols || []).map((c) => c.name);
  if (!colNames.includes('sender')) {
    return [];
  }

  return dbAll(
    db,
    `
      SELECT
        COALESCE(NULLIF(TRIM(sender), ''), 'Inconnu') AS sender,
        COUNT(*) AS count
      FROM incoming_mails
      GROUP BY sender
      ORDER BY count DESC
      LIMIT 10
    `,
  );
}

async function getKpisStats({ db }) {
  const [totalRow, archRow, pendRow, delayRow] = await Promise.all([
    dbGet(db, 'SELECT COUNT(*) as count FROM incoming_mails'),
    dbGet(db, "SELECT COUNT(*) as count FROM incoming_mails WHERE statut_global = 'Archivé'"),
    dbGet(
      db,
      "SELECT COUNT(*) as count FROM incoming_mails WHERE statut_global = 'Acquis' OR statut_global = 'Indexé'",
    ),
    dbGet(
      db,
      `
        SELECT AVG(julianday(date_archivage) - julianday(date_reception)) as avg_days
        FROM incoming_mails
        WHERE statut_global = 'Archivé' AND date_archivage IS NOT NULL AND date_reception IS NOT NULL
      `,
    ),
  ]);

  const total = totalRow?.count || 0;
  const archived = archRow?.count || 0;
  const archiveRate = total > 0 ? ((archived / total) * 100).toFixed(1) : 0;

  return {
    totalCourriers: total,
    archived: archived,
    pending: pendRow?.count || 0,
    archiveRate: parseFloat(archiveRate),
    avgProcessingDays: delayRow?.avg_days ? parseFloat(delayRow.avg_days.toFixed(1)) : 0,
  };
}

async function getDashboardKpis({ db, user, getExpectedServiceForRole }) {
  const isPrivilegedRead = user && (user.role_id === 1 || user.role_id === 2 || user.role_id === 7);
  const expectedSvc = getExpectedServiceForRole(user?.role_id);
  const username = String(user?.username || '').trim();
  const userId = user?.id != null ? String(user.id).trim() : '';

  const incomingConditions = [];
  const incomingParams = [];

  if (!isPrivilegedRead && expectedSvc) {
    incomingConditions.push(`UPPER(TRIM(assigned_service)) = ?`);
    incomingParams.push(expectedSvc);
  }

  if (!isPrivilegedRead) {
    incomingConditions.push(
      `(assigned_to IS NULL OR TRIM(assigned_to) = '' OR LOWER(TRIM(assigned_to)) = 'admin' OR TRIM(assigned_to) = ? OR TRIM(assigned_to) = ?)`
    );
    incomingParams.push(username, userId);
  }

  const incomingWhere = incomingConditions.length ? `WHERE ${incomingConditions.join(' AND ')}` : '';

  const incomingTodayRow = await dbGet(
    db,
    `SELECT COUNT(*) AS count FROM incoming_mails ${incomingWhere}${incomingWhere ? ' AND' : ' WHERE'} date(date_reception) = date('now')`,
    [...incomingParams],
  );

  const outgoingTodayRow = await dbGet(
    db,
    `SELECT COUNT(*) AS count FROM outgoing_mails WHERE date(mail_date) = date('now')`,
    [],
  );

  const pendingRow = await dbGet(
    db,
    `SELECT COUNT(*) AS count FROM incoming_mails ${incomingWhere}${incomingWhere ? ' AND' : ' WHERE'} statut_global IN ('Indexé', 'En Traitement')`,
    [...incomingParams],
  );

  const circulationRow = await dbGet(
    db,
    `SELECT COUNT(*) AS count FROM incoming_mails ${incomingWhere}${incomingWhere ? ' AND' : ' WHERE'} statut_global IN ('Traité', 'Validation')`,
    [...incomingParams],
  );

  const toArchiveRow = await dbGet(
    db,
    `SELECT COUNT(*) AS count FROM incoming_mails ${incomingWhere}${incomingWhere ? ' AND' : ' WHERE'} statut_global = 'Traité'`,
    [...incomingParams],
  );

  const assignedTasksRow = await dbGet(
    db,
    `SELECT COUNT(*) AS count
     FROM incoming_mails
     WHERE (TRIM(assigned_to) = ? OR TRIM(assigned_to) = ?)
       AND statut_global IN ('Indexé', 'En Traitement', 'Traité', 'Validation')`,
    [username, userId],
  );

  const dueSoonRows = await (async () => {
    const conditions = [...incomingConditions];
    const params = [...incomingParams];
    conditions.push(`response_required = 1`);
    conditions.push(`response_due IS NOT NULL`);
    conditions.push(`date(response_due) >= date('now') AND date(response_due) <= date('now', '+7 day')`);
    conditions.push(`(response_outgoing_id IS NULL OR response_outgoing_id = 0)`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return dbAll(
      db,
      `SELECT id, ref_code, subject, response_due, assigned_service, assigned_to
       FROM incoming_mails
       ${where}
       ORDER BY date(response_due) ASC
       LIMIT 10`,
      params,
    );
  })();

  let comptaPendingCount = 0;
  let comptaPendingAmount = 0;
  let comptaValidationCount = 0;
  let comptaJournalDraftCount = 0;
  let comptaJournalTotalCount = 0;

  const CAISSE_MAX_AMOUNT = 250;
  let caisse = { balance: 0, todayCount: 0, todayAmount: 0, pendingCount: 0 };
  let tresorerie = { balance: 0, todayCount: 0, todayAmount: 0, pendingCount: 0 };

  try {
    const comptaConditions = [];
    const comptaParams = [];
    comptaConditions.push(`UPPER(TRIM(m.assigned_service)) = 'COMPTABLE'`);
    if (!isPrivilegedRead) {
      comptaConditions.push(
        `(m.assigned_to IS NULL OR TRIM(m.assigned_to) = '' OR LOWER(TRIM(m.assigned_to)) = 'admin' OR TRIM(m.assigned_to) = ? OR TRIM(m.assigned_to) = ?)`
      );
      comptaParams.push(username, userId);
    }

    const comptaWhere = comptaConditions.length ? `WHERE ${comptaConditions.join(' AND ')}` : '';

    const pendingCountRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count
       FROM incoming_mails m
       ${comptaWhere}${comptaWhere ? ' AND' : ' WHERE'} m.statut_global IN ('Indexé', 'En Traitement')`,
      comptaParams,
    );
    comptaPendingCount = Number(pendingCountRow?.count || 0);

    const pendingAmountRow = await dbGet(
      db,
      `SELECT COALESCE(SUM(ci.montant_ttc), 0) AS total
       FROM compta_intakes ci
       JOIN incoming_mails m ON m.id = ci.mail_id
       ${comptaWhere}${comptaWhere ? ' AND' : ' WHERE'} m.statut_global IN ('Indexé', 'En Traitement')`,
      comptaParams,
    );
    comptaPendingAmount = Number(pendingAmountRow?.total || 0);

    const validationCountRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count
       FROM incoming_mails m
       ${comptaWhere}${comptaWhere ? ' AND' : ' WHERE'} m.statut_global = 'Validation'`,
      comptaParams,
    );
    comptaValidationCount = Number(validationCountRow?.count || 0);

    const journalTotalRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count FROM journal_entries WHERE 1=1`,
      [],
    );
    comptaJournalTotalCount = Number(journalTotalRow?.count || 0);

    const journalDraftRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count
       FROM journal_entries
       WHERE COALESCE(NULLIF(TRIM(status), ''), 'DRAFT') = 'DRAFT'`,
      [],
    );
    comptaJournalDraftCount = Number(journalDraftRow?.count || 0);
  } catch (_) {
    // si la table compta_intakes n'existe pas encore, on garde 0
  }

  try {
    const caisseBalanceRow = await dbGet(
      db,
      `SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS total
       FROM paiements
       WHERE COALESCE(NULLIF(TRIM(compte), ''), 'Compte courant') = 'Caisse'`,
      [],
    );
    caisse.balance = Number(caisseBalanceRow?.total || 0);

    const caisseTodayRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count, COALESCE(SUM(ABS(COALESCE(amount, 0))), 0) AS total
       FROM paiements
       WHERE COALESCE(NULLIF(TRIM(compte), ''), 'Compte courant') = 'Caisse'
         AND date(COALESCE(date, datetime('now'))) = date('now')
         AND ABS(COALESCE(amount, 0)) <= ?`,
      [CAISSE_MAX_AMOUNT],
    );
    caisse.todayCount = Number(caisseTodayRow?.count || 0);
    caisse.todayAmount = Number(caisseTodayRow?.total || 0);

    const caissePendingRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count
       FROM paiements
       WHERE COALESCE(NULLIF(TRIM(compte), ''), 'Compte courant') = 'Caisse'
         AND ABS(COALESCE(amount, 0)) <= ?
         AND COALESCE(NULLIF(TRIM(status), ''), 'BROUILLARD') = 'BROUILLARD'`,
      [CAISSE_MAX_AMOUNT],
    );
    caisse.pendingCount = Number(caissePendingRow?.count || 0);

    const tresBalanceRow = await dbGet(
      db,
      `SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS total
       FROM paiements
       WHERE COALESCE(NULLIF(TRIM(compte), ''), 'Compte courant') <> 'Caisse'`,
      [],
    );
    tresorerie.balance = Number(tresBalanceRow?.total || 0);

    const tresTodayRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count, COALESCE(SUM(ABS(COALESCE(amount, 0))), 0) AS total
       FROM paiements
       WHERE COALESCE(NULLIF(TRIM(compte), ''), 'Compte courant') <> 'Caisse'
         AND date(COALESCE(date, datetime('now'))) = date('now')`,
      [],
    );
    tresorerie.todayCount = Number(tresTodayRow?.count || 0);
    tresorerie.todayAmount = Number(tresTodayRow?.total || 0);

    const tresPendingRow = await dbGet(
      db,
      `SELECT COUNT(*) AS count
       FROM paiements
       WHERE COALESCE(NULLIF(TRIM(compte), ''), 'Compte courant') <> 'Caisse'
         AND COALESCE(NULLIF(TRIM(status), ''), 'BROUILLARD') = 'BROUILLARD'`,
      [],
    );
    tresorerie.pendingCount = Number(tresPendingRow?.count || 0);
  } catch (_) {
    // tables finance peuvent ne pas exister dans des DB anciennes
  }

  return {
    incomingToday: Number(incomingTodayRow?.count || 0),
    outgoingToday: Number(outgoingTodayRow?.count || 0),
    pendingTreatment: Number(pendingRow?.count || 0),
    inCirculation: Number(circulationRow?.count || 0),
    toArchive: Number(toArchiveRow?.count || 0),
    assignedTasks: Number(assignedTasksRow?.count || 0),
    dueSoon: dueSoonRows,
    compta: {
      pendingCount: comptaPendingCount,
      pendingAmount: comptaPendingAmount,
      validationCount: comptaValidationCount,
      journalDraftCount: comptaJournalDraftCount,
      journalTotalCount: comptaJournalTotalCount,
    },
    finance: {
      caisse,
      tresorerie,
    },
  };
}

module.exports = {
  getCourriersStats,
  getMonthlyStats,
  getByClasseurStats,
  getTopSendersStats,
  getKpisStats,
  getDashboardKpis,
};
