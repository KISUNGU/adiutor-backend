-- ============================================================================
-- MIGRATION: Fusion de 'users' et 'personnel' + 'user_profiles'
-- Date: 2026-01-11
-- Objectif: Créer une table users unifiée avec toutes les informations
-- ============================================================================

-- Étape 1: Sauvegarde (à faire avant)
-- cp databasepnda.db databasepnda.db.backup_YYYYMMDD_HHMMSS

-- Étape 2: Créer la nouvelle table users (structure étendue)
CREATE TABLE IF NOT EXISTS users_unified (
    -- Identité système
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,  -- Hash bcrypt
    
    -- Informations personnelles
    full_name TEXT,
    phone TEXT,
    
    -- Organisation (références aux tables existantes)
    fonction_id INTEGER REFERENCES fonctions(id),
    departement_id INTEGER REFERENCES departements(id),
    sous_departement_id INTEGER REFERENCES sous_departements(id),
    service_id INTEGER REFERENCES services(id),
    unite_id INTEGER,  -- Pas de FK si la table unites n'existe pas encore
    
    -- Rôle système (permissions applicatives)
    role_id INTEGER REFERENCES roles(id),
    
    -- Profil étendu
    bio TEXT,
    position TEXT,  -- Titre/poste court (ex: "Coordonnateur", "Chef Comptable")
    avatar TEXT,
    
    -- Préférences (JSON)
    preferences TEXT,
    notification_settings TEXT,
    
    -- Statut
    is_active INTEGER DEFAULT 1,
    is_system_user INTEGER DEFAULT 1,  -- 1 = a accès au système, 0 = personnel sans accès
    
    -- Personnel ID original (pour traçabilité)
    legacy_personnel_id INTEGER,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    -- Contraintes
    UNIQUE(username),
    CHECK(email LIKE '%@%')
);

-- Étape 3: Migrer les utilisateurs existants (table 'users')
-- Ces utilisateurs ont déjà accès au système
INSERT INTO users_unified (
    id,
    username,
    email,
    password,
    full_name,
    role_id,
    phone,
    bio,
    position,
    avatar,
    preferences,
    notification_settings,
    created_at,
    is_active,
    is_system_user
)
SELECT 
    u.id,
    u.username,
    u.email,
    u.password,
    u.username as full_name,  -- Par défaut, username = nom complet
    u.role_id,
    up.phone,
    up.bio,
    up.position,
    up.avatar,
    up.preferences,
    up.notification_settings,
    u.created_at,
    1 as is_active,
    1 as is_system_user
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id;

-- Étape 4: Migrer le personnel non présent dans users
-- Ces personnes sont dans l'organisation mais n'ont pas (encore) accès système
INSERT INTO users_unified (
    username,
    email,
    password,
    full_name,
    phone,
    fonction_id,
    departement_id,
    sous_departement_id,
    unite_id,
    is_active,
    is_system_user,
    legacy_personnel_id
)
SELECT 
    COALESCE(p.email, 'personnel_' || p.id || '@local'),  -- username = email ou généré
    COALESCE(p.email, 'personnel_' || p.id || '@local'),  -- email obligatoire
    '$2b$10$PLACEHOLDER_PASSWORD_HASH',  -- Mot de passe par défaut à changer
    p.name as full_name,
    p.phone,
    p.fonctions_id,
    p.departement_id,
    p.sous_departement_id,
    p.unite_id,
    1 as is_active,
    0 as is_system_user,  -- Pas d'accès système par défaut
    p.id as legacy_personnel_id
FROM personnel p
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.email = p.email
)
AND p.email IS NOT NULL;  -- Ne migrer que ceux avec un email

-- Étape 5: Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_users_unified_email ON users_unified(email);
CREATE INDEX IF NOT EXISTS idx_users_unified_username ON users_unified(username);
CREATE INDEX IF NOT EXISTS idx_users_unified_role_id ON users_unified(role_id);
CREATE INDEX IF NOT EXISTS idx_users_unified_departement_id ON users_unified(departement_id);
CREATE INDEX IF NOT EXISTS idx_users_unified_fonction_id ON users_unified(fonction_id);
CREATE INDEX IF NOT EXISTS idx_users_unified_is_active ON users_unified(is_active);
CREATE INDEX IF NOT EXISTS idx_users_unified_is_system_user ON users_unified(is_system_user);

-- Étape 6: Créer une vue pour compatibilité ascendante (optionnel)
CREATE VIEW IF NOT EXISTS personnel_view AS
SELECT 
    id,
    full_name as name,
    email,
    phone,
    fonction_id as fonctions_id,
    departement_id,
    sous_departement_id,
    unite_id
FROM users_unified;

-- ============================================================================
-- VALIDATION POST-MIGRATION
-- ============================================================================

-- Vérifier le nombre d'enregistrements
SELECT 'Total users_unified:' as check_name, COUNT(*) as count FROM users_unified
UNION ALL
SELECT 'Users with system access:', COUNT(*) FROM users_unified WHERE is_system_user = 1
UNION ALL
SELECT 'Personnel without system access:', COUNT(*) FROM users_unified WHERE is_system_user = 0
UNION ALL
SELECT 'Original users table:', COUNT(*) FROM users
UNION ALL
SELECT 'Original personnel table:', COUNT(*) FROM personnel;

-- Vérifier qu'il n'y a pas de doublons d'email
SELECT 'Duplicate emails:' as check_name, COUNT(*) - COUNT(DISTINCT email) as count 
FROM users_unified;

-- Lister les utilisateurs migrés
SELECT 
    id,
    username,
    email,
    CASE WHEN is_system_user = 1 THEN 'Système' ELSE 'Personnel' END as type,
    position,
    CASE WHEN is_active = 1 THEN 'Actif' ELSE 'Inactif' END as statut
FROM users_unified
ORDER BY is_system_user DESC, id
LIMIT 20;

-- ============================================================================
-- ÉTAPES MANUELLES APRÈS MIGRATION
-- ============================================================================

-- 1. Vérifier les résultats ci-dessus
-- 2. Tester l'authentification avec les comptes existants
-- 3. Si tout fonctionne, basculer:
--    - RENAME TABLE users TO users_old;
--    - RENAME TABLE users_unified TO users;
--    - Mettre à jour le code backend pour utiliser les nouveaux champs
-- 4. Après validation complète (1-2 semaines):
--    - DROP TABLE users_old;
--    - DROP TABLE personnel;
--    - DROP TABLE user_profiles;
--    - DROP VIEW personnel_view; (si plus utilisé)
