const router = require('express').Router()
const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const authenticateToken = require('../middlewares/authenticateToken')
const { authorize } = require('../middlewares/authorize')

let db;

function daysFromPeriod(period) {
  if (!period) return 7
  const p = String(period).toLowerCase().trim()
  if (p === 'today') return 1
  if (p === '7d') return 7
  if (p === '30d') return 30
  if (p === '90d') return 90
  if (p === 'all') return 3650
  const n = parseInt(p.replace('d',''), 10)
  return Number.isFinite(n) && n > 0 ? n : 7
}

// ✅ Actions récentes (timeline)
router.get('/actions', authenticateToken, authorize('dashboard.widget.timeline.view'), (req, res) => {
  const hasPagination =
    req.query.page != null ||
    req.query.limit != null ||
    req.query.search != null ||
    req.query.startDate != null ||
    req.query.endDate != null

  if (hasPagination) {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 30
    const offset = (page - 1) * limit
    const search = req.query.search || ''
    const { startDate, endDate } = req.query

    const whereConditions = []
    const params = []

    if (search) {
      const like = `%${search}%`
      whereConditions.push(`(action LIKE ? OR user_name LIKE ? OR details LIKE ?)`) 
      params.push(like, like, like)
    }

    if (startDate) {
      whereConditions.push('timestamp >= date(?)')
      params.push(startDate)
    }
    if (endDate) {
      whereConditions.push('timestamp <= date(?)')
      params.push(endDate)
    }

    const where = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    db.all(
      `
        SELECT * FROM mail_history
        ${where}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ events: rows || [], hasMore: (rows || []).length === limit })
      }
    )
    return
  }

  const days = daysFromPeriod(req.query.period)
  const limit = Math.min(Number(req.query.limit || 50), 100)

  const sinceExpr = `-${days} days`

  const sqlAuditLogs = `
    SELECT id, action, module, severity, success, ip, user_id, meta, created_at
    FROM audit_logs
    WHERE created_at >= datetime('now', ?)
    ORDER BY created_at DESC
    LIMIT ?
  `

  const sqlUserRoleAudit = `
    SELECT
      ua.id,
      ua.actor_user_id,
      ua.target_user_id,
      ua.action,
      ua.old_role_id,
      ua.new_role_id,
      ua.metadata,
      ua.created_at,
      actor.username as actor_username,
      target.username as target_username
    FROM user_role_audit ua
    LEFT JOIN users actor ON actor.id = ua.actor_user_id
    LEFT JOIN users target ON target.id = ua.target_user_id
    WHERE ua.created_at >= datetime('now', ?)
    ORDER BY ua.created_at DESC
    LIMIT ?
  `

  db.all(sqlAuditLogs, [sinceExpr, limit], (err1, auditRows) => {
    if (err1) {
      console.error('AUDIT /actions audit_logs SQL error:', err1.message)
      return res.status(500).json({ error: err1.message })
    }

    db.all(sqlUserRoleAudit, [sinceExpr, limit], (err2, roleRows) => {
      if (err2) {
        console.error('AUDIT /actions user_role_audit SQL error:', err2.message)
        return res.status(500).json({ error: err2.message })
      }

      const safeParseJson = (s) => {
        if (!s) return null
        try { return JSON.parse(s) } catch { return null }
      }

      const normalizedAuditLogs = (auditRows || []).map(r => {
        const meta = safeParseJson(r.meta)
        return {
          timestamp: r.created_at,
          action: r.action || 'Action',
          user_name: meta?.user_name || meta?.username || null,
          details: meta?.details || meta?.description || null,
          color: (String(r.severity || '').toLowerCase() === 'high') ? 'danger' : 'primary',
        }
      })

      const normalizedRoleAudit = (roleRows || []).map(r => {
        const metadata = safeParseJson(r.metadata)
        const actor = r.actor_username || metadata?.actor_username || metadata?.actor || null
        const target = r.target_username || metadata?.username || metadata?.target_username || null

        let details = null
        if (r.action === 'CREATE_USER') {
          details = target ? `Création de l’utilisateur ${target}` : 'Création d’un utilisateur'
        } else if (r.action === 'CHANGE_ROLE') {
          const who = target ? `pour ${target}` : ''
          const fromTo = (r.old_role_id || r.new_role_id)
            ? `(${r.old_role_id ?? '—'} → ${r.new_role_id ?? '—'})`
            : ''
          details = `Changement de rôle ${who} ${fromTo}`.trim()
        } else {
          details = metadata ? JSON.stringify(metadata) : null
        }

        return {
          timestamp: r.created_at,
          action: r.action || 'Action',
          user_name: actor,
          details,
          color: 'info',
        }
      })

      const merged = [...normalizedRoleAudit, ...normalizedAuditLogs]
        .filter(e => e.timestamp)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit)

      return res.json(merged)
    })
  })
})

// ✅ Logs (si tu l’utilises)
router.get('/logs', authenticateToken, authorize('dashboard.widget.audit.view'), (req, res) => {
  db.all(
    `SELECT id, action, module, severity, success, ip, user_id, meta, created_at
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT 100`,
    [],
    (err, rows) => {
      if (err) {
        console.error('AUDIT /logs SQL error:', err.message)
        return res.status(500).json({ error: err.message })
      }
      res.json(rows || [])
    }
  )
})

module.exports = (database) => {
  db = database;
  return router;
}
