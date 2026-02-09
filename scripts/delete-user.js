const sqlite3 = require('sqlite3').verbose()
const readline = require('readline-sync')

const db = new sqlite3.Database('./databasepnda.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) return console.error('❌ Erreur ouverture DB:', err.message)
})
db.configure('busyTimeout', 3000)

const username = readline.question('👤 Nom d’utilisateur à supprimer : ')

db.run(`DELETE FROM users WHERE username = ?`, [username], function (err) {
  if (err) {
    console.error('❌ Erreur suppression :', err.message)
  } else if (this.changes === 0) {
    console.log(`⚠️ Aucun utilisateur trouvé avec le nom "${username}".`)
  } else {
    console.log(`✅ Utilisateur "${username}" supprimé avec succès.`)
  }
  db.close()
})
