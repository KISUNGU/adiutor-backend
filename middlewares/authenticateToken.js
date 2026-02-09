const jwt = require('jsonwebtoken')

const secretsRaw = process.env.JWT_SECRET_KEYS || process.env.JWT_SECRET_KEY || ''
const SECRET_KEYS = secretsRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!SECRET_KEYS.length) {
  throw new Error('Missing required env var: JWT_SECRET_KEY')
}

module.exports = function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: "Token d'authentification manquant." })
  }

  const tryVerify = (idx) => {
    if (idx >= SECRET_KEYS.length) {
      return res.status(401).json({ error: "Token invalide ou expiré." })
    }
    jwt.verify(token, SECRET_KEYS[idx], (err, user) => {
      if (err) return tryVerify(idx + 1)

      // Normalisation: compat anciens tokens
      if (user && typeof user === 'object') {
        if (user.id == null && user.userId != null) user.id = user.userId
        if (user.role_id == null && user.roleId != null) user.role_id = user.roleId
      }

      req.user = user
      return next()
    })
  }

  tryVerify(0)
}
