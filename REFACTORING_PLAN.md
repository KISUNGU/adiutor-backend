# Plan de Refactorisation de la Base de Données

## 📊 Analyse des Redondances Identifiées

### 1. **Structure Organisationnelle Éparpillée**

#### Tables concernées:
- `users` (8 lignes) - Utilisateurs système
- `personnel` (49 lignes) - Personnel de l'organisation
- `departements` (5 lignes) - Départements
- `sous_departements` (15 lignes) - Sous-départements
- `services` (11 lignes) - Services
- `unites` (?) - Unités
- `fonctions` (30 lignes) - Fonctions/postes
- `roles` (10 lignes) - Rôles système
- `user_profiles` (2 lignes) - Profils utilisateurs étendus

#### Problèmes identifiés:
1. **Duplication users/personnel**: Personnel organisationnel vs utilisateurs système
2. **Confusion roles/fonctions**: Rôles système vs fonctions organisationnelles
3. **Hiérarchie floue**: departements, sous_departements, services, unites
4. **Profils fragmentés**: user_profiles séparé de users

### 2. **Tables d'Archives Redondantes**

#### Tables concernées:
- `archives` (table principale)
- `archives_caisse`
- `archives_comptable`
- `archives_coordo`
- `archives_finance`
- `archives_it`
- `archives_juridique`
- `archives_logistique`
- `archives_raf`
- `archives_rh`
- `archives_tresorerie`

#### Problème: 
Au lieu d'une table avec un champ `service_destination`, il y a 11 tables séparées.

### 3. **Tables de Courrier Dupliquées**

- `incoming_mails` (actif)
- `old_incoming_mails` (legacy)
- `mails` (?)
- `Suivi_Courrier` (?)

---

## 🎯 Proposition de Refactorisation

### Phase 1: Restructuration de l'Organisation (PRIORITÉ HAUTE)

#### A. Fusionner `users` et `personnel`

**Nouvelle structure `users` (étendue):**
```sql
CREATE TABLE users_new (
    -- Identité système
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    
    -- Informations personnelles
    full_name TEXT NOT NULL,
    phone TEXT,
    
    -- Organisation
    fonction_id INTEGER REFERENCES fonctions(id),
    departement_id INTEGER REFERENCES departements(id),
    sous_departement_id INTEGER REFERENCES sous_departements(id),
    service_id INTEGER REFERENCES services(id),
    unite_id INTEGER REFERENCES unites(id),
    
    -- Profil
    bio TEXT,
    position TEXT,  -- Titre court
    avatar TEXT,
    
    -- Préférences
    preferences TEXT,  -- JSON
    notification_settings TEXT,  -- JSON
    
    -- Statut
    is_active INTEGER DEFAULT 1,
    is_system_user INTEGER DEFAULT 1,  -- Distinguer personnel qui n'a pas accès système
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);
```

**Migration:**
1. Créer `users_new`
2. Migrer données de `users` (priorité)
3. Ajouter données de `personnel` non présentes dans `users`
4. Fusionner `user_profiles`
5. Renommer `users` → `users_old`, `users_new` → `users`

#### B. Clarifier `roles` vs `fonctions`

**Garder séparés mais bien définis:**

- **`roles`**: Rôles système (permissions applicatives)
  - admin, coordonnateur, raf, comptable, caissier, tresorier, secretariat, receptionniste
  
- **`fonctions`**: Fonctions organisationnelles (hiérarchie métier)
  - Directeur, Chef de service, Assistant, etc.

**Relation:** Un user a 1 role (système) + 1 fonction (organisationnelle)

#### C. Hiérarchie Organisationnelle Claire

**Option 1: Structure unifiée (RECOMMANDÉ)**
```sql
CREATE TABLE organizational_units (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,  -- Ex: "COORD", "FIN-COMPTA"
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'departement', 'service', 'sous_departement', 'unite'
    parent_id INTEGER REFERENCES organizational_units(id),  -- Hiérarchie
    level INTEGER NOT NULL,  -- 1=dept, 2=service, 3=sous-dept, 4=unite
    description TEXT,
    responsable_user_id INTEGER REFERENCES users(id),
    is_active INTEGER DEFAULT 1,
    ordre INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Option 2: Tables séparées mais liées (ACTUEL AMÉLIORÉ)**
- Garder `departements`, `services`, `sous_departements`, `unites`
- Ajouter clés étrangères explicites
- Ajouter `departements.responsable_id` → `users(id)`

### Phase 2: Consolidation des Archives

#### Fusionner toutes les tables `archives_*`

**Nouvelle structure:**
```sql
ALTER TABLE archives ADD COLUMN service_destination TEXT;  -- Ou service_id

-- Migrer données
INSERT INTO archives SELECT *, 'CAISSE' as service_destination FROM archives_caisse;
INSERT INTO archives SELECT *, 'COMPTABLE' as service_destination FROM archives_comptable;
-- etc.

-- Supprimer anciennes tables
DROP TABLE archives_caisse;
DROP TABLE archives_comptable;
-- etc.
```

### Phase 3: Nettoyage des Tables de Courrier

**Décisions à prendre:**
1. Que faire avec `old_incoming_mails` ?
   - Archiver et supprimer si données migrées
   - Ou garder pour historique

2. `mails` et `Suivi_Courrier` : utilisés ?
   - Si non utilisés → supprimer

---

## 📋 Plan de Migration

### Étape 1: Audit et Sauvegarde
```bash
cp databasepnda.db databasepnda.db.backup_$(date +%Y%m%d_%H%M%S)
```

### Étape 2: Migration Users/Personnel
1. Créer `users_new`
2. Migrer + valider
3. Basculer

### Étape 3: Restructuration Hiérarchie
1. Choisir Option 1 ou 2
2. Créer tables/colonnes
3. Migrer données
4. Mettre à jour références

### Étape 4: Consolidation Archives
1. Ajouter colonne `service_destination`
2. Migrer données des 11 tables
3. Supprimer anciennes tables

### Étape 5: Nettoyage
1. Supprimer tables obsolètes
2. Optimiser index
3. Vacuum database

---

## ⚠️ Impacts sur le Code

### Backend à modifier:
- Routes utilisant `personnel` → utiliser `users`
- Routes d'archives par service → adapter requêtes
- Authentification: vérifier `users.is_active`

### Frontend à modifier:
- Composants affichant personnel
- Sélecteurs de département/service
- Pages d'archives

---

## 🚀 Recommandation

**Ordre d'exécution suggéré:**

1. **URGENT**: Fusionner users/personnel (impact modéré, gain élevé)
2. **RECOMMANDÉ**: Consolider archives (impact faible, gain élevé)
3. **OPTIONNEL**: Restructurer hiérarchie organisationnelle (impact élevé, gain moyen)

Voulez-vous que je génère les scripts de migration pour la Phase 1 (users/personnel) ?
