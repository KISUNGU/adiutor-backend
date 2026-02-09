const db = require('const db = new sqlite3.Database('./databasepnda.db')')

module.exports.auditLog = async (req, data) => {
  try {
    const user = req.user || {}
    await db.run(
      `INSERT INTO audit_logs
       (user_id, user_email, action, module, entity_type, entity_id,
        severity, success, ip, user_agent, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id || null,
        user.email || null,
        data.action,
        data.module || null,
        data.entity_type || null,
        data.entity_id || null,
        data.severity || 'info',
        data.success !== false ? 1 : 0,
        req.ip,
        req.headers['user-agent'],
        JSON.stringify(data.meta || {})
      ]
    )
  } catch (e) {
    console.error('AUDIT ERROR', e)
  }
}
