const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'databasepnda.db'));
const { auditLog } = require('./audit');
const { roleNameFromId } = require('../utils/rbac');

module.exports.authorize = (permission) => {
  return async (req, res, next) => {
    // Utilise le mapping basé sur role_id
    const role = roleNameFromId(req.user?.role_id, req.user?.role);
    if (!role) return res.sendStatus(401);

    db.get(
      `SELECT 1 FROM role_permissions
       WHERE role = ? AND (permission_code = ? OR permission_code = 'all.*')`,
      [role, permission],
      async (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!row) {
          await auditLog(req, {
            action: 'PERMISSION_DENIED',
            module: 'rbac',
            severity: 'high',
            success: false,
            meta: { permission }
          });
          return res.sendStatus(403);
        }

        next();
      }
    );
  };
};
