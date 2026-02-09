const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database('../databasepnda.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) return console.error('❌ Erreur ouverture DB :', err.message)
})

const roles = ['admin', 'indexeur', 'user']

db.all(`SELECT COUNT(*) AS count FROM roles`, [], (err, rows) => {
  if (err) {
    console.error('❌ Erreur lecture table roles :', err.message)
    db.close()
    return
  }

  const count = rows[0].count
  if (count > 0) {
    console.log(`ℹ️ La table roles contient déjà ${count} rôle(s).`)
    db.close()
    return
  }

  const stmt = db.prepare(`INSERT INTO roles (name) VALUES (?)`)
  roles.forEach((role) => {
    stmt.run(role)
  })
  stmt.finalize(() => {
    console.log('✅ Rôles initiaux insérés :', roles.join(', '))
    db.close()
  })
})
