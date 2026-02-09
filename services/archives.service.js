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

async function getArchivesCount({ db }) {
  const row = await dbGet(db, 'SELECT COUNT(*) as count FROM archives');
  return { total_archives: row?.count || 0 };
}

async function getArchivesSimple({ db }) {
  const sql = `
    SELECT 
      a.id,
      a.reference,
      COALESCE(a.type, 'Courrier Entrant') as type,
      a.date,
      a.description,
      COALESCE(a.category, 'INCONNU') as category,
      COALESCE(a.classeur, 'Non classé') as classeur,
      a.file_path,
      COALESCE(a.status, 'Archivé') as status,
      COALESCE(a.sender, 'Inconnu') as sender,
      COALESCE(a.service_code, '') as service_code,
      a.incoming_mail_id,
      a.date as created_at,
      a.date as updated_at,
      (
        SELECT COUNT(*)
        FROM archive_annexes ax
        WHERE ax.archive_id = a.id
      ) AS annex_count
    FROM archives a
    ORDER BY a.date DESC
    LIMIT 100
  `;

  return dbAll(db, sql, []);
}

async function getArchivesPublic({ db }) {
  const sql = `
    SELECT 
      a.id,
      a.reference,
      COALESCE(a.type, 'Courrier Entrant') as type,
      a.date,
      a.description,
      COALESCE(a.category, 'INCONNU') as category,
      COALESCE(a.classeur, 'Non classé') as classeur,
      a.file_path,
      COALESCE(a.status, 'Archivé') as status,
      COALESCE(a.sender, 'Inconnu') as sender,
      COALESCE(a.service_code, '') as service_code,
      a.incoming_mail_id,
      a.date as created_at,
      a.date as updated_at,
      (
        SELECT COUNT(*)
        FROM archive_annexes ax
        WHERE ax.archive_id = a.id
      ) AS annex_count
    FROM archives a
    ORDER BY a.date DESC
    LIMIT 100
  `;

  return dbAll(db, sql, []);
}

async function getArchivesAll({ db }) {
  return dbAll(
    db,
    'SELECT id, reference, type, date, description, category, status FROM archives ORDER BY date DESC LIMIT 20',
    [],
  );
}

async function listArchives({ db, filters }) {
  const { service, category, type, status, limit = 100, page = 1 } = filters;

  let sql = `
    SELECT
      a.id,
      a.reference,
      a.type,
      a.date,
      a.description,
      a.category,
      a.classeur,
      a.file_path,
      COALESCE(a.status, 'Archivé') AS status,
      CASE
        WHEN a.sender IS NULL OR TRIM(a.sender) = '' OR a.sender IN ('Inconnu', 'Unknown', 'Interne / N/A')
          THEN COALESCE(NULLIF(TRIM(im.sender), ''), 'Inconnu')
        ELSE a.sender
      END AS sender,
      COALESCE(im.assigned_service, a.service_code, '') AS service_code,
      im.id AS incoming_mail_id,
      im.ref_code AS original_ref,
      im.subject AS original_subject,
      (
        SELECT COUNT(*)
        FROM archive_annexes ax
        WHERE ax.archive_id = a.id
      ) AS annex_count,
      a.created_at,
      a.updated_at
    FROM archives a
    LEFT JOIN incoming_mails im ON im.id = a.incoming_mail_id
    WHERE 1=1
  `;

  const params = [];

  if (service && service !== 'ALL') {
    sql += ' AND (im.assigned_service = ? OR a.service_code = ?)';
    params.push(service, service);
  }

  if (category) {
    sql += ' AND a.category = ?';
    params.push(category);
  }

  if (type) {
    sql += ' AND a.type = ?';
    params.push(type);
  }

  if (status) {
    sql += ' AND COALESCE(a.status, "Archivé") = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.date DESC, a.created_at DESC';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const rows = await dbAll(db, sql, params);

  let countSql = 'SELECT COUNT(*) as total FROM archives a WHERE 1=1';
  const countParams = [];

  if (service && service !== 'ALL') {
    countSql +=
      ' AND EXISTS (SELECT 1 FROM incoming_mails im WHERE im.id = a.incoming_mail_id AND im.assigned_service = ?)';
    countParams.push(service);
  }

  if (category) {
    countSql += ' AND a.category = ?';
    countParams.push(category);
  }

  if (type) {
    countSql += ' AND a.type = ?';
    countParams.push(type);
  }

  if (status) {
    countSql += ' AND COALESCE(a.status, "Archivé") = ?';
    countParams.push(status);
  }

  const countRow = await dbGet(db, countSql, countParams);
  const total = countRow?.total || 0;

  return {
    rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)) || 1,
    },
  };
}

async function getArchiveCounts({ db }) {
  const sql = `
    SELECT 
      service_code,
      COUNT(*) as total
    FROM archives_general
    GROUP BY service_code
    ORDER BY service_code
  `;

  try {
    const rows = await dbAll(db, sql, []);
    return rows || [];
  } catch (err) {
    if (String(err.message || '').toLowerCase().includes('no such table')) {
      return [];
    }
    throw err;
  }
}

async function getArchiveAnnexes({ db, id }) {
  const sql = `SELECT id, file_path, original_filename, file_type, file_size, created_at FROM archive_annexes WHERE archive_id = ? ORDER BY created_at ASC`;
  return dbAll(db, sql, [id]);
}

module.exports = {
  getArchivesCount,
  getArchivesSimple,
  getArchivesPublic,
  getArchivesAll,
  listArchives,
  getArchiveCounts,
  getArchiveAnnexes,
};
