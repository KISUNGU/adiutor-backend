# Configuration Railway - Variables d'environnement requises

## Variables OBLIGATOIRES

Ces variables doivent être configurées dans Railway > Variables pour que le serveur démarre :

### 1. JWT_SECRET_KEY
Clé secrète pour les tokens JWT (128 caractères hex).

**Générer localement :**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Exemple de valeur :**
```
fbc2717c6e0d4520278cda9a8800f0dab84787267a73b94c672ce122cc35d728b78face8c427ce6934b5b02abe8163c6e35266f9e681a241cdfc48cf3e784253
```

### 2. ENCRYPTION_MASTER_KEY
Clé de chiffrement AES-256-GCM (32 bytes en base64).

**Générer localement :**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Exemple de valeur :**
```
d8V8ZXMcMJmMdegsAXofptMiXA3GxNIWQtnWX//hhJE=
```

## Variables OPTIONNELLES

### Base de données
```bash
DB_TYPE=sqlite
SQLITE_DB_PATH=/app/data/mails.db3  # Utiliser chemin absolu pour Railway Volume
```

**⚠️ IMPORTANT**: SQLite nécessite un Volume Railway pour être persistant !
Voir [RAILWAY_SQLITE_PERSISTENCE.md](RAILWAY_SQLITE_PERSISTENCE.md) pour la configuration.

### Serveur
```bash
PORT=4000  # Railway définit automatiquement PORT - NE PAS définir sur Railway
ALLOWED_ORIGIN=https://votre-frontend.vercel.app,tauri://localhost
LOG_LEVEL=info
```

**Note**: `ALLOWED_ORIGIN` peut contenir plusieurs origines séparées par des virgules.
Incluez `tauri://localhost` si vous utilisez Tauri pour l'application desktop.

### OpenAI (optionnel)
```bash
OPENAI_API_KEY=sk-xxxxx
VECTOR_DB_DIR=./vector_store
```

### MinIO (optionnel)
```bash
MINIO_ENABLED=false
```

### OAuth (optionnel)
```bash
SESSION_SECRET=<même valeur que JWT_SECRET_KEY ou générer une nouvelle>
```

## Configuration Railway (Interface Web)

1. Allez dans **Railway Dashboard** > Votre projet > **Variables**
2. Cliquez sur **New Variable**
3. Ajoutez au minimum :
   - `JWT_SECRET_KEY` = [valeur générée ci-dessus]
   - `ENCRYPTION_MASTER_KEY` = [valeur générée ci-dessus]
4. Ajoutez les autres variables selon vos besoins
5. Cliquez sur **Deploy** pour redémarrer avec les nouvelles variables

## Vérification

Après déploiement, testez :
```bash
curl https://adiutor-backend.up.railway.app/
# Devrait retourner : "Bienvenue dans le backend des courriers !"

curl https://adiutor-backend.up.railway.app/health
# Devrait retourner : {"status":"ok","timestamp":"..."}
```

## Logs Railway

Si le serveur ne démarre toujours pas :
1. Allez dans **Railway Dashboard** > **Deployments**
2. Cliquez sur le dernier déploiement
3. Consultez les **Build Logs** et **Deploy Logs**
4. Cherchez les lignes commençant par `❌ Missing required env var:`
5. Si vous voyez `❌ ERREUR CRITIQUE: Migrations échouées`, vérifiez que le répertoire `data/` est créé

## Solutions aux erreurs courantes

### Erreur 404 "Application not found"

Cette erreur signifie que Railway ne peut pas atteindre votre application. Causes possibles :

1. **Le build a échoué**
   - Vérifiez les Build Logs dans Railway
   - Assurez-vous que `npm ci --legacy-peer-deps` réussit

2. **Le serveur ne démarre pas**
   - Consultez les Deploy Logs
   - Cherchez les messages d'erreur au démarrage
   - Vérifiez que `JWT_SECRET_KEY` et `ENCRYPTION_MASTER_KEY` sont bien définis

3. **Le domaine n'est pas configuré**
   - Allez dans **Settings** > **Networking**
   - Vérifiez que le domaine `.up.railway.app` est actif
   - Si besoin, cliquez sur **Generate Domain**

4. **Le port n'est pas correctement configuré**
   - Railway définit automatiquement la variable `PORT`
   - Ne définissez PAS `PORT` dans les variables d'environnement
   - Le serveur doit écouter sur `0.0.0.0` (déjà configuré)

### Le serveur crash au démarrage

Vérifiez dans Deploy Logs si vous voyez :
- `❌ Missing required env var: JWT_SECRET_KEY` → Ajoutez la variable
- `❌ ERREUR CRITIQUE: Migrations échouées` → Vérifiez les permissions du volume
- `OPENAI_API_KEY: Not loaded` → OK si vous n'utilisez pas OpenAI
- `EADDRINUSE` → Le port est déjà utilisé (redéployez)

### Variables à NE PAS définir sur Railway

- `PORT` - Railway le définit automatiquement
- `DB_TYPE` - Par défaut `sqlite` (OK pour Railway)
- `SQLITE_DB_PATH` - Par défaut `./data/mails.db3` (OK)

## Checklist de déploiement

- [ ] Variables `JWT_SECRET_KEY` et `ENCRYPTION_MASTER_KEY` définies
- [ ] Variable `ALLOWED_ORIGIN` définie avec l'URL du frontend
- [ ] Domaine Railway généré et actif
- [ ] Build Logs montrent `success`
- [ ] Deploy Logs montrent `✅ SERVER SUCCESSFULLY STARTED AND LISTENING`
- [ ] Test: `curl https://votre-app.up.railway.app/` retourne "Bienvenue..."
- [ ] Test: `curl https://votre-app.up.railway.app/health` retourne `{"status":"ok"}`
