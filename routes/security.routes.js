const router = require('express').Router()

const authenticateToken = require('../middlewares/authenticateToken')
const { authorize } = require('../middlewares/authorize')

let db

// ✅ Liste des alertes
router.get(
  '/alerts',
  authenticateToken,
  authorize('dashboard.widget.security_alerts.view'),
  (req, res) => {
    db.all(
      `SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 20`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows || [])
      }
    )
  }
)

// ✅ Marquer comme vu
router.post(
  '/alerts/:id/seen',
  authenticateToken,
  authorize('dashboard.widget.security_alerts.view'),
  (req, res) => {
  db.run(
    `UPDATE security_alerts
     SET status='seen', updated_at=CURRENT_TIMESTAMP
     WHERE id = ?`,
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.sendStatus(204)
    }
  )
})

// ✅ Résoudre
router.post(
  '/alerts/:id/resolve',
  authenticateToken,
  authorize('dashboard.widget.security_alerts.view'),
  (req, res) => {
  db.run(
    `UPDATE security_alerts
     SET status='resolved', updated_at=CURRENT_TIMESTAMP
     WHERE id = ?`,
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.sendStatus(204)
    }
  )
})

module.exports = (database) => {
  db = database
  return router
}

