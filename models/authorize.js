const db = require('const db = new sqlite3.Database('./databasepnda.db')')
const { auditLog } = require('./audit')

module.exports.authorize = (permission) => {
  return async (req, res, next) => {
    const role = req.user?.role
    if (!role) return res.sendStatus(401)

    const row = await db.get(
      `SELECT 1 FROM role_permissions
       WHERE role = ? AND permission_code = ?`,
      [role, permission]
    )

    if (!row) {
      await auditLog(req, {
        action: 'PERMISSION_DENIED',
        module: 'rbac',
        severity: 'high',
        success: false,
        meta: { permission }
      })
      return res.sendStatus(403)
    }

    next()
  }
}
