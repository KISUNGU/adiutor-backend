-- ============================================================================
-- MIGRATION: Consolidation des tables archives_*
-- Date: 2026-01-11
-- Objectif: Fusionner les 11 tables d'archives en une seule avec un champ service
-- ============================================================================

-- Étape 1: Vérifier la structure actuelle de la table archives
-- (Devrait déjà exister avec toutes les colonnes nécessaires)

-- Étape 2: Ajouter la colonne service_destination si elle n'existe pas
ALTER TABLE archives ADD COLUMN service_destination TEXT;

-- Étape 3: Créer un index pour optimiser les requêtes par service
CREATE INDEX IF NOT EXISTS idx_archives_service ON archives(service_destination);

-- Étape 4: Migrer les données des tables archives_*
-- Important: Adapter les colonnes selon la structure réelle de chaque table

-- Migration archives_caisse
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'CAISSE' as service_destination
FROM archives_caisse;

-- Migration archives_comptable
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'COMPTABLE' as service_destination
FROM archives_comptable;

-- Migration archives_coordo
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'COORDINATION' as service_destination
FROM archives_coordo;

-- Migration archives_finance
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'FINANCE' as service_destination
FROM archives_finance;

-- Migration archives_it
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'IT' as service_destination
FROM archives_it;

-- Migration archives_juridique
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'JURIDIQUE' as service_destination
FROM archives_juridique;

-- Migration archives_logistique
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'LOGISTIQUE' as service_destination
FROM archives_logistique;

-- Migration archives_raf
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'RAF' as service_destination
FROM archives_raf;

-- Migration archives_rh
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'RH' as service_destination
FROM archives_rh;

-- Migration archives_tresorerie
INSERT INTO archives (
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    service_destination
)
SELECT 
    ref_code, subject, sender, recipient, mail_date, date_reception,
    file_path, summary, classeur, archived_at, archived_by,
    'TRESORERIE' as service_destination
FROM archives_tresorerie;

-- ============================================================================
-- VALIDATION POST-MIGRATION
-- ============================================================================

-- Compter les archives par service
SELECT 
    service_destination,
    COUNT(*) as total
FROM archives
GROUP BY service_destination
ORDER BY service_destination;

-- Vérifier les totaux
SELECT 'Total archives consolidées:' as check_name, COUNT(*) FROM archives
UNION ALL
SELECT 'archives_caisse (original):', COUNT(*) FROM archives_caisse
UNION ALL
SELECT 'archives_comptable (original):', COUNT(*) FROM archives_comptable
UNION ALL
SELECT 'archives_coordo (original):', COUNT(*) FROM archives_coordo
UNION ALL
SELECT 'archives_finance (original):', COUNT(*) FROM archives_finance
UNION ALL
SELECT 'archives_it (original):', COUNT(*) FROM archives_it
UNION ALL
SELECT 'archives_juridique (original):', COUNT(*) FROM archives_juridique
UNION ALL
SELECT 'archives_logistique (original):', COUNT(*) FROM archives_logistique
UNION ALL
SELECT 'archives_raf (original):', COUNT(*) FROM archives_raf
UNION ALL
SELECT 'archives_rh (original):', COUNT(*) FROM archives_rh
UNION ALL
SELECT 'archives_tresorerie (original):', COUNT(*) FROM archives_tresorerie;

-- ============================================================================
-- NETTOYAGE (À FAIRE APRÈS VALIDATION)
-- ============================================================================

-- ATTENTION: Ne supprimer les tables qu'après avoir validé que tout fonctionne!
-- Décommenter uniquement après validation complète:

-- DROP TABLE IF EXISTS archives_caisse;
-- DROP TABLE IF EXISTS archives_comptable;
-- DROP TABLE IF EXISTS archives_coordo;
-- DROP TABLE IF EXISTS archives_finance;
-- DROP TABLE IF EXISTS archives_it;
-- DROP TABLE IF EXISTS archives_juridique;
-- DROP TABLE IF EXISTS archives_logistique;
-- DROP TABLE IF EXISTS archives_raf;
-- DROP TABLE IF EXISTS archives_rh;
-- DROP TABLE IF EXISTS archives_tresorerie;

-- ============================================================================
-- MISES À JOUR NÉCESSAIRES DANS LE CODE
-- ============================================================================

/*
BACKEND (server.js):

1. Routes d'archivage:
   Avant: INSERT INTO archives_caisse ...
   Après: INSERT INTO archives (... , service_destination) VALUES (..., 'CAISSE')

2. Routes de récupération:
   Avant: SELECT * FROM archives_caisse WHERE ...
   Après: SELECT * FROM archives WHERE service_destination = 'CAISSE' AND ...

3. Routes globales:
   SELECT * FROM archives ORDER BY archived_at DESC
   -- Possibilité de filtrer par service avec WHERE service_destination = ?

FRONTEND:

1. Composants d'archives:
   - Ajouter un filtre par service_destination
   - Adapter les appels API pour passer le service en paramètre

2. Pages spécifiques par service:
   - Utiliser un filtre au lieu de tables différentes
   - Exemple: /archives?service=CAISSE au lieu de /archives/caisse
*/
