# 🗄️ Connexion Base de Données - Documentation

## Vue d'ensemble

Le module [db/index.js](./index.js) fournit une **connexion SQLite unique** pour toute l'application, avec optimisations critiques pour la **stabilité multi-utilisateurs** et la **compatibilité Docker**.

---

## 🎯 Objectifs

### 1. Singleton Pattern
- ✅ **Une seule connexion** SQLite pour toute l'app
- ✅ Évite les problèmes de verrouillage concurrent
- ✅ Meilleure gestion de la mémoire

### 2. PRAGMA Optimisés
- ✅ **WAL mode** activé (Write-Ahead Logging)
- ✅ **busy_timeout** = 5000ms (évite SQLITE_BUSY)
- ✅ **foreign_keys** = ON (intégrité référentielle)

### 3. Compatible Docker
- ✅ Chemin DB via **variable d'environnement**
- ✅ Création automatique du dossier `data/`
- ✅ Volume persistant : `./data:/app/data`

### 4. Prêt PostgreSQL
- ✅ Variable `DB_TYPE` pour basculer vers PG
- ✅ Gestion d'erreur si PG non implémenté
- ✅ Architecture modulaire (facile d'ajouter PG Pool)

---

## 📁 Structure

```
backend/
├── db/
│   ├── index.js          ← Connexion unique SQLite (ce fichier)
│   ├── migrations.js     ← CREATE TABLE + ALTER TABLE
│   └── sql-compat.js     ← Abstraction SQLite/PostgreSQL
├── data/
│   ├── .gitkeep          ← Dossier versionné (mais pas les .db)
│   └── databasepnda.db   ← Base SQLite (ignoré par .gitignore)
└── .env
    └── SQLITE_DB_PATH=./data/databasepnda.db
```

---

## 🔧 Configuration

### Variables d'Environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `DB_TYPE` | `sqlite` | Type de DB (`sqlite` ou `postgres`) |
| `SQLITE_DB_PATH` | `./data/databasepnda.db` | Chemin du fichier SQLite |

### Exemple `.env`

```bash
# Type de base de données
DB_TYPE=sqlite

# Chemin SQLite (relatif au dossier backend/)
SQLITE_DB_PATH=./data/databasepnda.db

# Pour PostgreSQL (futur)
# DB_TYPE=postgres
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# POSTGRES_DATABASE=adiutorai
# POSTGRES_USER=adiutorai_user
# POSTGRES_PASSWORD=secure_password
```

---

## 💻 Utilisation

### Import Standard

```javascript
// Dans n'importe quel fichier backend
const db = require('./db/index');

// Requête simple
db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
  if (err) return console.error(err);
  console.log(row);
});

// Requête multiple
db.all(`SELECT * FROM mails WHERE status = ?`, ['PENDING'], (err, rows) => {
  if (err) return console.error(err);
  console.log(rows);
});

// Insertion
db.run(
  `INSERT INTO mails (subject, status) VALUES (?, ?)`,
  ['Test', 'DRAFT'],
  function (err) {
    if (err) return console.error(err);
    console.log('Inserted ID:', this.lastID);
  }
);
```

### ⚠️ Ce qu'il NE FAUT PAS faire

```javascript
// ❌ JAMAIS créer une deuxième connexion
const sqlite3 = require('sqlite3');
const db2 = new sqlite3.Database('./data/databasepnda.db'); // ❌ INTERDIT

// ❌ JAMAIS modifier les PRAGMA après initialisation
db.run(`PRAGMA journal_mode = DELETE;`); // ❌ DANGEREUX

// ❌ JAMAIS fermer la connexion manuellement
db.close(); // ❌ Géré automatiquement par les signaux SIGINT/SIGTERM
```

---

## 🔒 PRAGMA Expliqués

### 1. `PRAGMA journal_mode = WAL`

**Objectif:** Activer le mode Write-Ahead Logging.

**Avantages:**
- ✅ **Lectures simultanées** pendant qu'un writer écrit
- ✅ **Meilleures performances** (pas de blocage lecteurs)
- ✅ **Atomicité** garantie (ACID)

**Inconvénients:**
- ⚠️ Crée des fichiers `-wal` et `-shm` temporaires
- ⚠️ Nécessite Linux/Mac ou Windows avec filesystem supportant mmap

**Pourquoi obligatoire ?**  
En mode `DELETE` (par défaut), SQLite verrouille toute la DB pour chaque écriture. Avec plusieurs utilisateurs simultanés, vous auriez des **SQLITE_BUSY** constamment.

### 2. `PRAGMA busy_timeout = 5000`

**Objectif:** Attendre 5 secondes avant retourner `SQLITE_BUSY`.

**Comportement:**
- Si la DB est verrouillée, SQLite **réessaie automatiquement** pendant 5s
- Évite de planter immédiatement sur concurrence temporaire

**Exemple:**
```
Requête A: INSERT INTO ... (2 secondes)
Requête B: SELECT ...      (arrive pendant l'INSERT)
  → Sans busy_timeout: ERREUR SQLITE_BUSY immédiate
  → Avec busy_timeout=5000: Attend 2s, puis exécute SELECT
```

### 3. `PRAGMA foreign_keys = ON`

**Objectif:** Activer les contraintes de clés étrangères.

**Pourquoi désactivé par défaut ?**  
Compatibilité historique avec vieux schémas SQLite.

**Impact:**
```sql
CREATE TABLE mails (id INTEGER PRIMARY KEY);
CREATE TABLE attachments (
  mail_id INTEGER,
  FOREIGN KEY (mail_id) REFERENCES mails(id) ON DELETE CASCADE
);

-- Sans foreign_keys=ON:
DELETE FROM mails WHERE id = 1;
-- attachments orphelins restent ❌

-- Avec foreign_keys=ON:
DELETE FROM mails WHERE id = 1;
-- attachments supprimés automatiquement (CASCADE) ✅
```

---

## 🐳 Compatibilité Docker

### Volume Persistant

Dans `docker-compose.yml`:
```yaml
backend:
  volumes:
    - ./backend/data:/app/data  # ← Données persistantes hors container
```

**Pourquoi important ?**
- Sans volume, la DB est **détruite** à chaque `docker-compose down`
- Avec volume, les données **survivent** aux redémarrages

### Contrainte `replicas: 1`

```yaml
backend:
  deploy:
    replicas: 1  # ⚠️ OBLIGATOIRE pour SQLite
```

**Raison:**  
SQLite ne supporte qu'un **seul processus d'écriture**. Si vous scalez à `replicas: 2+`, vous aurez:
- ❌ Corruption de la base de données
- ❌ Erreurs `database is locked`
- ❌ Perte de données

**Solution pour scaler:**  
Migrer vers PostgreSQL (voir [POSTGRESQL_MIGRATION_PREP.md](../../POSTGRESQL_MIGRATION_PREP.md)).

---

## 🚨 Troubleshooting

### Erreur : `database is locked`

**Cause:** Plusieurs processus écrivent simultanément.

**Solutions:**
1. Vérifier qu'aucun autre processus n'a ouvert la DB :
   ```powershell
   Get-Process | Where-Object { $_.Path -like '*node*' }
   ```
2. Supprimer les fichiers `-wal` et `-shm` :
   ```bash
   rm data/databasepnda.db-wal
   rm data/databasepnda.db-shm
   ```
3. Vérifier que WAL mode est activé :
   ```sql
   PRAGMA journal_mode;  -- Doit retourner "wal"
   ```

### Erreur : `SQLITE_BUSY`

**Cause:** Timeout de 5s dépassé.

**Solutions:**
1. Augmenter `busy_timeout` dans `db/index.js` :
   ```javascript
   db.run(`PRAGMA busy_timeout = 10000;`); // 10s
   ```
2. Optimiser les requêtes longues (ajouter indexes) :
   ```sql
   CREATE INDEX idx_mails_status ON incoming_mails(statut_global);
   ```

### Erreur : `ENOENT` (fichier introuvable)

**Cause:** Dossier `data/` n'existe pas.

**Solution:**  
Le module crée automatiquement le dossier. Vérifier les permissions :
```bash
ls -la backend/data/
```

### Erreur : `EACCES` (permission denied)

**Cause:** Utilisateur Docker n'a pas accès au volume.

**Solution (Docker):**
```dockerfile
# Dans Dockerfile
RUN chown -R node:node /app/data
USER node
```

---

## 📊 Monitoring

### Vérifier le Mode WAL

```javascript
db.get(`PRAGMA journal_mode;`, [], (err, row) => {
  console.log('Journal mode:', Object.values(row)[0]); // "wal"
});
```

### Vérifier la Taille du Cache

```javascript
db.get(`PRAGMA cache_size;`, [], (err, row) => {
  const pages = Math.abs(Object.values(row)[0]);
  console.log(`Cache: ${pages} pages (~${pages * 4}KB)`);
});
```

### Statistiques WAL

```javascript
db.get(`PRAGMA wal_checkpoint(FULL);`, [], (err, row) => {
  console.log('WAL checkpoint:', row); // { busy: 0, log: X, checkpointed: Y }
});
```

---

## 🔄 Migration PostgreSQL

Quand `DB_TYPE=postgres` sera implémenté :

1. **Modifier `db/index.js`** :
   ```javascript
   const { Pool } = require('pg');
   const pool = new Pool({
     host: process.env.POSTGRES_HOST,
     port: 5432,
     database: process.env.POSTGRES_DATABASE,
     user: process.env.POSTGRES_USER,
     password: process.env.POSTGRES_PASSWORD,
   });
   module.exports = pool;
   ```

2. **Adapter les requêtes** :
   ```javascript
   // SQLite: placeholders ?
   db.run(`INSERT INTO users (name) VALUES (?)`, [name]);
   
   // PostgreSQL: placeholders $1, $2...
   pool.query(`INSERT INTO users (name) VALUES ($1)`, [name]);
   ```

3. **Supprimer contrainte Docker** :
   ```yaml
   backend:
     deploy:
       replicas: 10  # ✅ Maintenant possible avec PostgreSQL
   ```

---

## 📚 Références

- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [SQLite PRAGMA](https://www.sqlite.org/pragma.html)
- [Node.js sqlite3 Driver](https://github.com/TryGhost/node-sqlite3)
- [PostgreSQL Node.js](https://node-postgres.com/)

---

**Maintenu par:** AdiutrAI Team  
**Dernière mise à jour:** 2026-02-05
