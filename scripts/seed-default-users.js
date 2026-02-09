const path = require('path')
const crypto = require('crypto')
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')

const dbPath = path.join(__dirname, '..', '..', 'databasepnda.db')
const db = new sqlite3.Database(dbPath)

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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

function generatePassword() {
  // 18 chars ~120 bits; safe default, printable.
  return crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14) + 'A!'
}

async function ensureUsersRoleColumn() {
  const cols = await dbAll('PRAGMA table_info(users)')
  const hasRoleId = cols.some((c) => c && c.name === 'role_id')
  if (!hasRoleId) {
    await dbRun(`ALTER TABLE users ADD COLUMN role_id INTEGER DEFAULT 2`)
    console.log("✅ Colonne users.role_id ajoutée (DEFAULT 2).")
  }
}

async function ensureAdminRoleId() {
  await dbRun(`UPDATE users SET role_id = 1 WHERE username = 'admin' AND (role_id IS NULL OR role_id != 1)`)
}

async function createUserIfMissing({ username, email, role_id }) {
  const existing = await dbGet('SELECT id, username, role_id FROM users WHERE username = ? OR email = ? LIMIT 1', [
    username,
    email,
  ])

  if (existing) {
    // Optionally correct role_id if user exists but role differs
    if (existing.role_id !== role_id) {
      await dbRun('UPDATE users SET role_id = ? WHERE id = ?', [role_id, existing.id])
      console.log(`ℹ️ role_id mis à jour pour ${existing.username} → ${role_id}`)
    } else {
      console.log(`ℹ️ Utilisateur existe déjà: ${existing.username}`)
    }
    return { created: false, username: existing.username }
  }

  const password = generatePassword()
  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(password, salt)

  const result = await dbRun('INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)', [
    username,
    email,
    hash,
    role_id,
  ])

  return { created: true, id: result.lastID, username, email, role_id, password }
}

async function main() {
  try {
    console.log('🔧 Seed des comptes par rôle…')

    await ensureUsersRoleColumn()
    await ensureAdminRoleId()

    // role_id mapping (backend/utils/rbac.js)
    // 1 admin, 2 coordonnateur, 4 comptable, 5 caisse, 6 tresorerie, 7 secretariat, 8 logisticien, 9 assistant_admin, 10 receptionniste
    const usersToCreate = [
      { username: 'coordonnateur', email: 'coordonnateur@realcom.cd', role_id: 2 },
      { username: 'comptable', email: 'comptable@realcom.cd', role_id: 4 },
      { username: 'caisse', email: 'caisse@realcom.cd', role_id: 5 },
      { username: 'tresorerie', email: 'tresorerie@realcom.cd', role_id: 6 },
      { username: 'logisticien', email: 'logisticien@realcom.cd', role_id: 8 },
      { username: 'assistantadmin', email: 'assistantadmin@realcom.cd', role_id: 9 },
      // déjà créés selon toi, mais on garantit leur présence
      { username: 'secretaire', email: 'secretaire@realcom.cd', role_id: 7 },
      { username: 'receptionniste', email: 'receptionniste@realcom.cd', role_id: 10 },
    ]

    const created = []
    for (const u of usersToCreate) {
      const r = await createUserIfMissing(u)
      if (r.created) created.push(r)
    }

    console.log('\n✅ Seed terminé.')
    if (created.length) {
      console.log('\n🔐 Identifiants générés (à noter maintenant):')
      for (const u of created) {
        console.log(`- ${u.username} (${u.email}) [role_id=${u.role_id}] => ${u.password}`)
      }
      console.log('\n⚠️ Change ces mots de passe après la première connexion.')
    } else {
      console.log('ℹ️ Aucun nouvel utilisateur créé (déjà présents).')
    }
  } catch (e) {
    console.error('❌ Seed échoué:', e)
    process.exitCode = 1
  } finally {
    db.close()
  }
}

main()
