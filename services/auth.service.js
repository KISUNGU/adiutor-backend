const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { normalizeEmail, normalizeUsername } = require('../utils/auth');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function buildRoleId(role, role_id) {
  const ROLE_NAME_TO_ID = {
    ADMIN: 1,
    COORDONNATEUR: 2,
    RAF: 3,
    COMPTABLE: 4,
    CAISSE: 5,
    TRESORERIE: 6,
    SECRETAIRE: 7,
    LOGISTICIEN: 8,
    ASSISTANT_ADMIN: 9,
    RECEPTIONNISTE: 10,
  };

  let finalRoleId = 10;
  if (typeof role_id === 'number') {
    finalRoleId = role_id;
  } else if (typeof role === 'string') {
    const upper = role.toUpperCase();
    if (ROLE_NAME_TO_ID[upper]) finalRoleId = ROLE_NAME_TO_ID[upper];
  }
  return finalRoleId;
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

async function verifyPasswordWithMigration(db, userId, storedHashOrPassword, providedPassword) {
  const stored = storedHashOrPassword == null ? '' : String(storedHashOrPassword);
  const provided = providedPassword == null ? '' : String(providedPassword);

  try {
    const isMatch = await bcrypt.compare(provided, stored);
    if (isMatch) return true;
  } catch (_) {
    // ignore invalid hash
  }

  if (stored && provided && stored === provided) {
    try {
      const newHash = await bcrypt.hash(provided, 10);
      await dbRun(db, 'UPDATE users SET password = ? WHERE id = ?', [newHash, userId]);
    } catch (_) {
      // ignore migration failure
    }
    return true;
  }

  return false;
}

async function createUserAsAdmin({ db, creator, username, email, password, role, role_id, logUserRoleAudit }) {
  if (!creator || (creator.role_id !== 1 && creator.role_id !== 2)) {
    const err = new Error('Accès interdit (admin ou coordonnateur requis).');
    err.status = 403;
    throw err;
  }

  const usernameNorm = normalizeUsername(username);
  const emailNorm = normalizeEmail(email);
  if (!usernameNorm || !emailNorm || !password) {
    const err = new Error('Champs requis manquants (username/email/password).');
    err.status = 400;
    throw err;
  }

  const existing = await dbGet(
    db,
    'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?))',
    [emailNorm, usernameNorm],
  );
  if (existing) {
    const err = new Error('Email ou nom d’utilisateur déjà utilisé.');
    err.status = 409;
    throw err;
  }

  const finalRoleId = buildRoleId(role, role_id);
  const hash = await bcrypt.hash(String(password), 10);
  await dbRun(db, 'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)', [
    usernameNorm,
    emailNorm,
    hash,
    finalRoleId,
  ]);

  const createdUser = await dbGet(db, 'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))', [emailNorm]);
  if (createdUser?.id && typeof logUserRoleAudit === 'function') {
    try {
      await logUserRoleAudit({
        actor_user_id: creator.id,
        target_user_id: createdUser.id,
        action: 'CREATE_USER',
        old_role_id: null,
        new_role_id: finalRoleId,
        metadata: { username: usernameNorm, email: emailNorm },
      });
    } catch (_) {
      // ignore audit errors
    }
  }

  return { id: createdUser?.id, username: usernameNorm, email: emailNorm, role_id: finalRoleId };
}

async function loginUser({ db, email, username, password }) {
  const emailNorm = normalizeEmail(email);
  const usernameNorm = normalizeUsername(username);
  const useEmail = !!emailNorm;

  if ((!emailNorm && !usernameNorm) || !password) {
    const err = new Error("Identifiant (email ou nom d'utilisateur) et mot de passe requis.");
    err.status = 400;
    throw err;
  }

  const sql = useEmail
    ? 'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))'
    : 'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))';
  const identifier = useEmail ? emailNorm : usernameNorm;

  const user = await dbGet(db, sql, [identifier]);
  if (!user) {
    const err = new Error('Identifiants incorrects.');
    err.status = 401;
    throw err;
  }

  const isMatch = await verifyPasswordWithMigration(db, user.id, user.password, password);

  return user;
}

async function issueRefreshToken({ db, userId, ttlDays = 7, ip, userAgent }) {
  const token = generateRefreshToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  await dbRun(
    db,
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)` ,
    [userId, tokenHash, expiresAt, ip || null, userAgent || null],
  );

  return { token, expires_at: expiresAt };
}

async function rotateRefreshToken({ db, refreshToken, ip, userAgent, ttlDays = 7 }) {
  const tokenHash = sha256(refreshToken);
  const row = await dbGet(
    db,
    `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?`,
    [tokenHash],
  );

  if (!row || row.revoked_at) {
    const err = new Error('Refresh token invalide.');
    err.status = 401;
    throw err;
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    const err = new Error('Refresh token expiré.');
    err.status = 401;
    throw err;
  }

  const next = await issueRefreshToken({ db, userId: row.user_id, ttlDays, ip, userAgent });
  await dbRun(
    db,
    `UPDATE refresh_tokens SET revoked_at = datetime('now'), replaced_by = ? WHERE id = ?`,
    [sha256(next.token), row.id],
  );

  return { user_id: row.user_id, refresh: next };
}

async function revokeRefreshToken({ db, refreshToken }) {
  const tokenHash = sha256(refreshToken);
  await dbRun(
    db,
    `UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash],
  );
}

async function cleanupExpiredRefreshTokens({ db, maxRevokedAgeDays = 30 }) {
  const cutoff = new Date(Date.now() - maxRevokedAgeDays * 24 * 60 * 60 * 1000).toISOString();
  await dbRun(
    db,
    `DELETE FROM refresh_tokens
     WHERE (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now'))
        OR (revoked_at IS NOT NULL AND datetime(revoked_at) < datetime(?))`,
    [cutoff],
  );
}

module.exports = {
  normalizeEmail,
  normalizeUsername,
  createUserAsAdmin,
  loginUser,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  cleanupExpiredRefreshTokens,
};
