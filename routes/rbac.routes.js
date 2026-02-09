const router = require('express').Router()
const sqlite3 = require('sqlite3').verbose()



const authenticateToken = require('../middlewares/authenticateToken')

const path = require('path')
const db = new sqlite3.Database(path.join(__dirname, '..', 'databasepnda.db'))

// role_id -> role (adapte si tes IDs diffèrent)
const ROLE_MAP = {
  1: 'admin',
  2: 'coordonnateur',
  3: 'raf',
  4: 'comptable',
  5: 'caisse',
  6: 'tresorerie',
  7: 'secretariat',
}

const { roleNameFromId } = require('../utils/rbac')

router.get('/me', authenticateToken, (req, res) => {
  try {
    const role_id = req.user?.role_id
    if (!role_id) return res.status(400).json({ error: "role_id manquant dans le JWT" })

    const ROLE_MAP = { 1:'admin', 2:'coordonnateur', 3:'raf', 4:'comptable', 5:'caisse', 6:'tresorerie', 7:'secretariat' }
    const role = ROLE_MAP[Number(role_id)] || 'user'

    db.all(
      `SELECT permission_code FROM role_permissions WHERE role = ?`,
      [role],
      (err, rows) => {
        if (err) {
          console.error('RBAC SQL error:', err.message)
          return res.status(500).json({
            error: 'RBAC SQL error',
            details: err.message,
            hint: "Vérifie que les tables permissions/role_permissions existent et que le chemin DB est correct."
          })
        }

        res.json({
          role,
          permissions: (rows || []).map(r => r.permission_code)
        })
      }
    )
  } catch (e) {
    console.error('RBAC /me error:', e)
    res.status(500).json({ error: 'RBAC server error', details: String(e?.message || e) })
  }
})


module.exports = router
