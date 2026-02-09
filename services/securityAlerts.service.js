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

async function listSecurityAlerts({ db, limit = 50, severity, status }) {
  const tableRow = await dbGet(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name='security_alerts'",
    [],
  );
  if (!tableRow) {
    return [];
  }

  const conditions = [];
  const params = [];

  if (severity) {
    conditions.push('severity = ?');
    params.push(severity);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT id, type, title, message, severity, status, source, meta, created_at, updated_at
    FROM security_alerts
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ?
  `;
  params.push(Number(limit));

  return dbAll(db, sql, params);
}

module.exports = {
  listSecurityAlerts,
};
