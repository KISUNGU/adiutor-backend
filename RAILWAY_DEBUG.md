# Résolution du problème Railway 404

## Problème constaté

```bash
iwr "https://adiutor-backend.up.railway.app/"
# Erreur: {"status":"error","code":404,"message":"Application not found"}
```

## Serveur local fonctionne ✅

Le serveur démarre correctement en local et affiche:
```
✅ SERVER SUCCESSFULLY STARTED AND LISTENING ON localhost : 4000
```

Donc le code fonctionne. Le problème est côté Railway.

## Causes possibles

### 1. Variables d'environnement manquantes (PLUS PROBABLE)

Le serveur fait `process.exit(1)` si `JWT_SECRET_KEY` ou `ENCRYPTION_MASTER_KEY` sont manquantes.

**Solution:**
1. Ouvrez https://railway.app/dashboard
2. Sélectionnez votre projet `adiutor-backend`
3. Allez dans **Variables**
4. Vérifiez que ces variables existent:
   - `JWT_SECRET_KEY` (128 caractères hex)
   - `ENCRYPTION_MASTER_KEY` (44 caractères base64)
5. Si manquantes, ajoutez-les puis redéployez

### 2. Le domaine n'est pas configuré

**Solution:**
1. Dans Railway Dashboard > Votre projet
2. Allez dans **Settings** → **Networking**
3. Si aucun domaine n'apparaît:
   - Cliquez sur **Generate Domain**
   - Notez le nouveau domaine (sera différent de `.up.railway.app`)
4. Testez avec le nouveau domaine

### 3. Le build échoue

**Solution:**
1. Railway Dashboard > **Deployments**
2. Cliquez sur le dernier déploiement
3. Consultez **Build Logs**:
   - Cherchez des erreurs `npm install` ou `npm ci`
   - Vérifiez que le build se termine par `success`
4. Si échec, vérifiez que `nixpacks.toml` contient `--legacy-peer-deps`

### 4. Le serveur crash au démarrage

**Solution:**
1. Railway Dashboard > **Deployments** > Dernier déploiement
2. Consultez **Deploy Logs**
3. Cherchez:
   - `❌ Missing required env var:` → Ajoutez la variable manquante
   - `❌ ERREUR CRITIQUE: Migrations échouées` → Problème de base de données
   - `✅ SERVER SUCCESSFULLY STARTED` → Le serveur démarre (le problème est ailleurs)

### 5. Le port n'est pas correctement configuré

**Solution:**
- N'ajoutez PAS `PORT` dans les variables Railway
- Railway définit `PORT` automatiquement
- Le code écoute déjà sur `0.0.0.0` si `RAILWAY_ENVIRONMENT` existe

## Commandes de diagnostic

### En local
```bash
node diagnose-railway.js
```

### Tester Railway après corrections
```bash
# Test route racine
curl https://adiutor-backend.up.railway.app/

# Test healthcheck
curl https://adiutor-backend.up.railway.app/health

# Test avec PowerShell
iwr "https://adiutor-backend.up.railway.app/" -UseBasicParsing
```

## Checklist de débogage

- [ ] Exécuter `node diagnose-railway.js` en local
- [ ] Vérifier que `JWT_SECRET_KEY` est défini dans Railway Variables
- [ ] Vérifier que `ENCRYPTION_MASTER_KEY` est défini dans Railway Variables
- [ ] Vérifier que Railway > Settings > Networking a un domaine actif
- [ ] Consulter les Build Logs - chercher "success"
- [ ] Consulter les Deploy Logs - chercher "SERVER SUCCESSFULLY STARTED"
- [ ] Vérifier que `PORT` n'est PAS dans les variables (Railway le gère)
- [ ] Si tout est OK, régénérer le domaine dans Networking

## Si rien ne fonctionne

1. Supprimez le service existant dans Railway
2. Créez un nouveau service depuis votre repo GitHub
3. Ajoutez immédiatement les variables d'environnement:
   ```
   JWT_SECRET_KEY=<générer avec crypto.randomBytes(64).toString('hex')>
   ENCRYPTION_MASTER_KEY=<générer avec crypto.randomBytes(32).toString('base64')>
   ALLOWED_ORIGIN=https://votre-frontend.com
   ```
4. Railway déploiera automatiquement
5. Générez un domaine dans Settings > Networking
6. Testez le nouveau domaine

## Ressources

- [Railway Logs](https://railway.app/dashboard) (consultez toujours en premier)
- [Documentation Railway](https://docs.railway.app/)
- [nixpacks.toml](nixpacks.toml) - Config build
- [railway.json](railway.json) - Config déploiement
