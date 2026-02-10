# Persistence SQLite sur Railway avec Volume

## ⚠️ Problème: SQLite non-persistant par défaut

Par défaut, Railway utilise un système de fichiers **éphémère**. À chaque déploiement:
- Le fichier `data/mails.db3` est recréé vide
- Toutes les données sont perdues
- Les migrations se réexécutent

## ✅ Solution: Créer un Volume Railway

### Étape 1: Créer le Volume

1. Allez dans **Railway Dashboard** → Votre projet → Service backend
2. Cliquez sur **Variables** (ou **Settings**)
3. Cherchez la section **Volumes** ou **Storage**
4. Cliquez sur **New Volume** ou **Add Volume**
5. Configurez:
   - **Mount Path**: `/app/data`
   - **Size**: 1 GB (ou plus selon vos besoins)
6. Cliquez sur **Create**

### Étape 2: Vérifier la variable SQLITE_DB_PATH

Assurez-vous que la variable d'environnement pointe vers le volume:

```bash
SQLITE_DB_PATH=./data/mails.db3
```

Ou mieux, utilisez le chemin absolu:
```bash
SQLITE_DB_PATH=/app/data/mails.db3
```

### Étape 3: Redéployer

Railway redéploiera automatiquement. Cette fois:
- Le dossier `/app/data` sera persistant
- La base de données survivra aux redéploiements
- Les migrations ne réexécuteront que les nouvelles migrations

## 🔍 Vérification

### Logs de démarrage

Cherchez dans les Deploy Logs:
```
✅ Connexion SQLite établie: /app/data/mails.db3
```

### Test de persistence

1. Créez des données via l'API
2. Redéployez l'application
3. Vérifiez que les données sont toujours présentes

## 🚨 Alternative: PostgreSQL (Recommandé pour production)

Pour une vraie production, utilisez PostgreSQL au lieu de SQLite:

### Avantages
- ✅ Hébergé et géré par Railway
- ✅ Backups automatiques
- ✅ Scalabilité
- ✅ Pas de problème de volume

### Configuration

1. Dans Railway Dashboard, ajoutez un nouveau service **PostgreSQL**
2. Connectez-le à votre backend
3. Railway créera automatiquement les variables:
   - `DATABASE_URL`
   - `POSTGRES_HOST`
   - `POSTGRES_PORT`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`

4. Ajoutez la variable:
   ```
   DB_TYPE=postgres
   ```

5. Installez le driver PostgreSQL:
   ```bash
   npm install pg
   ```

6. Adaptez `db/index.js` pour supporter PostgreSQL (déjà prévu dans le code)

## 📖 Ressources

- [Railway Volumes Documentation](https://docs.railway.app/reference/volumes)
- [Railway PostgreSQL](https://docs.railway.app/databases/postgresql)

## ⚙️ Configuration actuelle

Votre backend utilise actuellement:
- **DB Type**: SQLite
- **Path**: `./data/mails.db3` (défini dans `.env`)
- **Persistence**: ⚠️ **NON** (volume nécessaire)

## 🎯 Actions recommandées

1. **Court terme** (SQLite + Volume):
   - [ ] Créez un volume Railway monté sur `/app/data`
   - [ ] Vérifiez que `SQLITE_DB_PATH=/app/data/mails.db3`
   - [ ] Redéployez et testez la persistence

2. **Long terme** (PostgreSQL):
   - [ ] Ajoutez un service PostgreSQL dans Railway
   - [ ] Configurez `DB_TYPE=postgres`
   - [ ] Migrez les données SQLite → PostgreSQL
   - [ ] Supprimez le volume SQLite
