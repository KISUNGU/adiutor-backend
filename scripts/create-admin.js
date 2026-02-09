const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const path = require('path')

// Utiliser le même chemin que db/index.js
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'databasepnda.db')
const db = new sqlite3.Database(DB_PATH)
console.log('📂 Utilisation DB:', DB_PATH)

const username = 'admin'
const email = 'admin@realcom.cd'
const password = 'admin4321'
const roleName = 'admin'

// Utilitaires avec promesses
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

async function initDatabase() {
  console.log('🔧 Création des tables si absentes...')

  // Créer la table roles
  await dbRun(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `)

  // Créer la table users
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Créer la table de liaison (many-to-many)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `)

  console.log('✅ Tables créées ou déjà existantes.')
}

async function createAdmin() {
  try {
    await initDatabase()

    // 1. Créer le rôle "admin"
    let role = await dbGet(`SELECT id FROM roles WHERE name = ?`, [roleName])
    let roleId
    if (!role) {
      const result = await dbRun(`INSERT INTO roles (name) VALUES (?)`, [roleName])
      roleId = result.lastID
      console.log('✅ Rôle "admin" créé.')
    } else {
      roleId = role.id
      console.log('ℹ️ Rôle "admin" déjà existant.')
    }

    // 2. Hacher le mot de passe
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)

    // 3. Créer l'utilisateur
    let user
    try {
      const result = await dbRun(
        `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
        [username, email, hash]
      )
      user = { id: result.lastID }
      console.log('✅ Utilisateur admin créé.')
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('⚠️ Utilisateur admin déjà existant.')
        user = await dbGet(`SELECT id FROM users WHERE username = ?`, [username])
        if (!user) {
          throw new Error('Utilisateur introuvable après erreur d’unicité.')
        }
      } else {
        throw err
      }
    }

    // 4. Lier utilisateur et rôle
    try {
      await dbRun(
        `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
        [user.id, roleId]
      )
      console.log('✅ Rôle admin attribué.')
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) {
        throw err
      }
      console.log('ℹ️ Lien utilisateur/rôle déjà existant.')
    }

    console.log('\n🔐 Identifiants admin :')
    console.log(`   ➤ Nom d’utilisateur : ${username}`)
    console.log(`   ➤ Mot de passe : ${password}`)

  } catch (error) {
    console.error('❌ Erreur lors de la création de l’admin :', error.message)
  } finally {
    db.close()
  }
}

createAdmin()