const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const readline = require('readline-sync')
const path = require('path')

try {
  const dbPath = path.resolve('../databasepnda.db') // ← adapte si nécessaire
  console.log('📂 Base utilisée :', dbPath)

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) throw new Error('Erreur ouverture DB : ' + err.message)
  })

  const username = readline.question('👤 Nom d’utilisateur : ')
  const email = readline.question('📧 Email : ')
  const password = readline.question('🔐 Mot de passe : ', { hideEchoBack: true })
  const roleName = readline.question('🎖️ Rôle (admin / indexeur / user) : ', {
    defaultInput: 'user',
  })

  const salt = bcrypt.genSaltSync(10)
  const hashedPassword = bcrypt.hashSync(password, salt)

  db.get(`SELECT id FROM roles WHERE name = ?`, [roleName], (err, row) => {
    if (err) {
      console.error('❌ Erreur recherche rôle :', err.message)
      db.close()
      return
    }

    if (!row) {
      console.error(`❌ Rôle "${roleName}" introuvable dans la table roles.`)
      db.close()
      return
    }

    const roleId = row.id

    db.run(
      `INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)`,
      [username, email, hashedPassword, roleId],
      function (err) {
        if (err) {
          console.error('❌ Erreur insertion :', err.message)
        } else {
          console.log(`✅ Utilisateur "${username}" créé avec le rôle "${roleName}".`)
        }
        db.close()
      }
    )
  })
} catch (err) {
  console.error('❌ Erreur inattendue :', err.message)
}
