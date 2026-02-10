// ...existing code...
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { queryMemoryStore, buildMemoryStore } = require('./ai/memory-vector-store');
const dbFunctions = require('./dbFunctions');

// ✅ ÉTAPE 2: Imports ensure* supprimés (migrations centralisées dans db/migrations.js)
// const ensureCourriersSortantsTable = require('./db/ensureCourriersSortants');
// const ensureIncomingMailsTable = require('./db/ensureIncomingMails');
// const ensureHistoryTables = require('./db/ensureHistoryTables');
// const ensureArchivesTable = require('./db/ensureArchives');
// const ensureArchivesMigration = require('./db/ensureArchivesMigration');
// const ensureServicesTable = require('./db/ensureServices');
// const ensureRolesTable = require('./db/ensureRoles');
// const ensureRolePermissionsTable = require('./db/ensureRolePermissions');
// const { ensureMailSharesTables } = require('./db/ensureMailShares');
// const runMigrations = require('./db/runMigrations');

const { getConversationHistory, saveMessage, listEquipments, getUserFromDatabase } = dbFunctions;
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const express = require('express');
const path = require('path');

// ✅ ÉTAPE 1: Connexion DB centralisée
const db = require('./db/index');
dbFunctions.setDb(db);

// ⚠️ TEMPORAIRE: Pour compatibilité avec routes anciennes
// TODO: Refactorer secretariat.routes.js pour ne plus créer de connexions temporaires
const sqlite3 = require('sqlite3').verbose();
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, 'data', 'databasepnda.db');

const { generateUniqueReference } = require('./utils/referenceGenerator');

// ✅ ÉTAPE 2: Import migrations centralisées
const { runAllMigrations } = require('./db/migrations');

// ✅ ÉTAPE 3: Import schedulers centralisés
const { startAllSchedulers } = require('./jobs/schedulers');

// ✅ ÉTAPE 4: Import services documents (PDF, QR, OCR, IA)
const documentsService = require('./services/documents.service');

// ✅ Wrappers pour compatibilité avec les routes existantes
const analyzeDocumentAsync = documentsService.analyzeDocumentAsync;
const generateMailQRCode = documentsService.generateMailQRCode;
const generateARPDF = documentsService.generateARPDF;
const extractTextFromPDF = documentsService.extractTextFromPDF;
const extractTextFromDocx = documentsService.extractTextFromDocx;
const extractTextFromFile = documentsService.extractTextFromFile;
const extractTextWithOCR = documentsService.extractTextWithOCR;
const callAISummary = documentsService.callAISummary;
const convertDocxToPDF = documentsService.convertDocxToPDF;
const getAllPDFContent = documentsService.getAllPDFContent;

// Migrations comptabilité exécutées plus tard (après création tables)
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const fsPromises = require('fs/promises');
let PDFParse = null;
try {
  ({ PDFParse } = require('pdf-parse'));
} catch (err) {
  console.warn(
    '⚠️ pdf-parse indisponible: extraction PDF désactivée. Cause:',
    err?.message || err
  );
  PDFParse = null;
}
const mammoth = require('mammoth'); // .docx extraction
const WordExtractor = require('word-extractor'); // .doc extraction
const { fromPath } = require('pdf2pic');
const Tesseract = require('tesseract.js');
const winston = require('winston');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const crypto = require('crypto'); // 🔒 Hash SHA-256 pour intégrité fichiers
const helmet = require('helmet'); // 🔒 Headers sécurisés
const rateLimit = require('express-rate-limit'); // 🔒 Protection anti-brute force
const { analyzeDocument } = require('./ai/documentAnalyzer');
const {
  indexDocument,
  semanticSearch,
  findSimilarDocuments,
  reindexAllDocuments,
} = require('./ai/semanticSearch');
const axios = require('axios')
require('dotenv').config()

// Configuration n8n (API REST)
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678'
const N8N_API_KEY = process.env.N8N_API_KEY || null
const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE || 'http://localhost:5678/webhook'

const n8nWorkflowsConfig = [
  {
    id: 'auto-archive',
    name: 'Archivage Automatique',
    description: 'Archive automatiquement les courriers traités',
    tags: ['archive', 'automatisation'],
    active: true,
    webhookPath: '/auto-archive', // donnera http://localhost:5678/webhook/auto-archive
  },
  {
    id: 'urgent-mail-alert',
    name: 'Alertes Courriers Urgents',
    description: 'Détecte et notifie les courriers prioritaires',
    tags: ['alerte', 'urgent'],
    active: true,
    webhookPath: '/urgent-mail-alert',
  },
  {
    id: 'monthly-report',
    name: 'Rapport Mensuel',
    description: 'Génère et distribue le rapport mensuel',
    tags: ['rapport', 'mensuel'],
    active: false,
    webhookPath: '/monthly-report',
  },
  {
    id: 'data-sync',
    name: 'Synchronisation Données',
    description: 'Synchronise les données entre systèmes',
    tags: ['sync', 'données'],
    active: true,
    webhookPath: '/data-sync',
  },
  {
    id: 'backup-validation',
    name: 'Validation Sauvegardes',
    description: 'Vérifie l\'intégrité des sauvegardes',
    tags: ['sauvegarde', 'sécurité'],
    active: true,
    webhookPath: '/backup-validation',
  },
]


// 🔒 PHASE 2: MinIO (Stockage WORM) et OAuth 2.0
let minioConfig = null;
const MINIO_ENABLED = String(process.env.MINIO_ENABLED || '').toLowerCase() === 'true'

if (MINIO_ENABLED) {
  try {
    minioConfig = require('./config/minio.config');
    console.log('✅ MinIO activé (stockage S3/WORM)');
  } catch (err) {
    console.warn('⚠️ MinIO activé mais non initialisable, fallback fichiers local:', err?.message || err)
    minioConfig = null
  }
} else {
  console.log('ℹ️ MinIO désactivé (MINIO_ENABLED!=true) : mode fichiers local')
}

const { passport } = require('./config/oauth.config');
const session = require('express-session');

// 🔒 PHASE 4: Monitoring, Logging, Timestamp
const metrics = require('./monitoring/metrics');
const logger = require('./utils/logger');
const requestLogger = require('./middlewares/requestLogger');
const errorHandler = require('./middlewares/errorHandler');
const timestampModule = require('./security/timestamp');

// ✅ ÉTAPE 2: Exécuter TOUTES les migrations (centralisées dans db/migrations.js)
// Inclut: tables principales, migrations générales, comptabilité
runAllMigrations(db)
  .then(() => {
    console.log('✅ Toutes les migrations terminées avec succès');
    
    // Démarrer le serveur uniquement après les migrations
    console.log('🚀 Préparation du démarrage du serveur...');
    app.use(errorHandler);
    
    // Railway nécessite d'écouter sur 0.0.0.0 pour accepter les connexions externes
    const host = process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : 'localhost';
    const server = app.listen(port, host, () => {
      logger.info(`✅ Serveur démarré sur http://${host}:${port}`);
      logger.info('🎯 Le serveur est maintenant en écoute...');
      logger.info('📊 Métriques Prometheus: http://' + host + ':' + port + '/metrics');
      logger.info('💚 Healthcheck: http://' + host + ':' + port + '/health');
      console.log('✅ SERVER SUCCESSFULLY STARTED AND LISTENING ON', host, ':', port);
    });
    
    logger.info('📝 app.listen() appelé, en attente de connexion au port...');
    
    // ✅ ÉTAPE 3: Démarrage des tâches planifiées (jobs/schedulers.js)
    try {
      startAllSchedulers(db, {
        createNotification,
        createAlertIfNotExists,
        dbGet,
        dbAll,
        upsertAlertByType,
        resolveAlertsByType,
        cleanupExpiredRefreshTokens: () => cleanupExpiredRefreshTokens({ db }),
        logger
      });
    } catch (e) {
      console.error('❌ Schedulers init failed:', e?.message || e);
    }
  })
  .catch((err) => {
    logger.error('Migrations failed', { error: err.message, stack: err.stack });
    console.error('❌ ERREUR CRITIQUE: Migrations échouées, serveur non démarré');
    process.exit(1);
  });

// const Tesseract = require('tesseract.js'); // Pour OCR si nécessaire
const { PDFDocument, StandardFonts } = require('pdf-lib'); // Pour manipulation avancée des PDF
const QRCode = require('qrcode'); // Génération QR Code
// LibreOffice non disponible - conversion PDF désactivée
// const libre = require('libreoffice-convert');
// libre.convertAsync = require('util').promisify(libre.convert);

const app = express();
const port = process.env.PORT || 4000;

// 🔴🔴🔴 DEBUG: SERVER STARTED - UPDATED CODE RUNNING 🔴🔴🔴
console.log('🔴🔴🔴 SERVER STARTED - UPDATED CODE RUNNING - TIMESTAMP:', new Date().toISOString(), '🔴🔴🔴');

// Add error handlers to catch crashes (centralized)
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT_EXCEPTION', {
    message: err?.message,
    stack: err?.stack,
    type: err?.constructor?.name,
  });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED_REJECTION', {
    message: reason?.message || String(reason),
    stack: reason?.stack,
  });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Not loaded');
// Logger externe déjà importé depuis ./utils/logger (Phase 4). Suppression de l'ancienne définition locale.

const { parseOfficeAsync } = require('officeparser');

const libre = require('libreoffice-convert');
const util = require('util');
const convertAsync = util.promisify(libre.convert);

async function extractMetadataFromDocx(filePath) {
  try {
    const data = await parseOfficeAsync(filePath);
    return { text: data.text, metadata: data.metadata }; // Métadonnées comme auteur, date, etc.
  } catch (error) {
    logger.error('Erreur extraction métadonnées DOCX', { filePath, error: error.message });
    return { text: '', metadata: {} };
  }
}
// FIN extractMetadataFromDocx

// Chemin absolu pour le répertoire d'uploads
const uploadsDir = path.join(__dirname, 'uploads'); 

const jwt = require("jsonwebtoken");
const { normalizeEmail, normalizeUsername } = require('./utils/auth');
const validate = require('./middlewares/validate');
const {
  mailIdParam,
} = require('./validators/financeMail.validators');
const {
  mailValidateValidator,
} = require('./validators/mailValidation.validators');
const {
  mailArchiveValidator,
} = require('./validators/mailArchive.validators');
const {
  archivesListValidator,
  archiveIdParam,
} = require('./validators/archives.validators');
const {
  pvCategoryParam,
} = require('./validators/content.validators');
const {
  sessionIdParam,
  userIdParam,
  messageCreateValidator,
} = require('./validators/messages.validators');
const {
  interneIdParam,
  interneStatsValidator,
  interneCreateValidator,
} = require('./validators/correspondancesInternes.validators');
const {
  externeIdParam,
  externeCreateValidator,
  externeBulkValidator,
} = require('./validators/correspondancesExternes.validators');
const {
  securityAlertsListValidator,
} = require('./validators/securityAlerts.validators');
const {
  cleanupIdParam,
} = require('./validators/cleanup.validators');
const {
  serviceIdParam,
  serviceCreateValidator,
  serviceUpdateValidator,
  serviceListValidator,
} = require('./validators/services.validators');
const { rolePermissionValidator } = require('./validators/admin.validators');
const {
  notificationIdParam,
  notificationCreateValidator,
} = require('./validators/notifications.validators');
const {
  mailIdParam: qrMailIdParam,
} = require('./validators/qrCode.validators');
const {
  mailStatisticsValidator,
} = require('./validators/mailStats.validators');
const {
  searchMemoryValidator,
} = require('./validators/searchMemory.validators');

function requireEnv(name) {
  const val = process.env[name];
  if (typeof val !== 'string' || !val.trim()) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

// P0: no default secrets in code
const SECRET_KEY = requireEnv('JWT_SECRET_KEY');
requireEnv('ENCRYPTION_MASTER_KEY');
const SESSION_SECRET = (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) || SECRET_KEY;

// Centralized JWT auth middleware (normalized req.user.id / req.user.role_id)
const authenticateToken = require('./middlewares/authenticateToken');
const authRoutes = require('./routes/auth.routes');
const { cleanupExpiredRefreshTokens } = require('./services/auth.service');
const notificationsRoutes = require('./routes/notifications.routes');
const mailValidationRoutes = require('./routes/mailValidation.routes');
const workflowRoutes = require('./routes/workflow.routes');
const mailArchiveRoutes = require('./routes/mailArchive.routes');
const aiAnnexeRoutes = require('./routes/aiAnnexe.routes');
const aiSemanticRoutes = require('./routes/aiSemantic.routes');
const archivesRoutes = require('./routes/archives.routes');
const miscRoutes = require('./routes/misc.routes');
const documentsRoutes = require('./routes/documents.routes');
const debugRoutes = require('./routes/debug.routes');
const contentRoutes = require('./routes/content.routes');
const messagesRoutes = require('./routes/messages.routes');
const correspondancesInternesRoutes = require('./routes/correspondancesInternes.routes');
const correspondancesExternesRoutes = require('./routes/correspondancesExternes.routes');
const securityAlertsRoutes = require('./routes/securityAlerts.routes');
const cleanupRoutes = require('./routes/cleanup.routes');
const qrCodeRoutes = require('./routes/qrCode.routes');
const mailStatsRoutes = require('./routes/mailStats.routes');
const statsRoutes = require('./routes/stats.routes');
const procurementRoutes = require('./routes/procurement.routes');
const secretariatRoutes = require('./routes/secretariat.routes');
const courriersSortantsRoutes = require('./routes/courriersSortants.routes');
const n8nRoutes = require('./routes/n8n.routes');
const storageRoutes = require('./routes/storage.routes');
const timestampRoutes = require('./routes/timestamp.routes');
const dashboardAiRoutes = require('./routes/dashboardAi.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
const historyRoutes = require('./routes/history.routes');
const searchMemoryRoutes = require('./routes/searchMemory.routes');
const searchRoutes = require('./routes/search.routes');
const hrRoutes = require('./routes/hr.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const filesRoutes = require('./routes/files.routes');
const dossiersRoutes = require('./routes/dossiers.routes');
const agentRoutes = require('./routes/agent.routes');
const extractPdfRoutes = require('./routes/extractPdf.routes');
const aiQueryRoutes = require('./routes/aiQuery.routes');
const uploadRoutes = require('./routes/upload.routes');
const {
  createNotificationInternal,
  notifyMailStatusChange: notifyMailStatusChangeService,
  getUsersByRoles: getUsersByRolesService,
} = require('./services/notifications.service');
const servicesRoutes = require('./routes/services.routes');
const adminRolesPermissionsRoutes = require('./routes/adminRolesPermissions.routes');
const adminUsersRoutes = require('./routes/adminUsers.routes');
const rbacMeRoutes = require('./routes/rbacMe.routes');
const healthRoutes = require('./routes/health.routes');

// 🌐 CORS: activer tôt avec préflight explicite pour Vite (5173)
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'ETag'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));
// Répondre aux préflights sur toutes les routes
// Preflight handler compatible Express 5 (éviter path-to-regexp wildcard)
const allowedOrigins = new Set(corsOptions.origin);
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const reqOrigin = req.headers.origin;
    if (reqOrigin && allowedOrigins.has(reqOrigin)) {
      res.header('Access-Control-Allow-Origin', reqOrigin);
    }
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(204);
  }
  next();
});

// Middleware pour logger toutes les requêtes
app.use(requestLogger);

// Body parsers (doivent être déclarés avant les routes qui lisent req.body)
app.use(express.json({ limit: '10mb' })); // Limite payload JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuration multer pour upload de fichiers
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const refCode = req.body.ref_code || `doc-${Date.now()}`;
      const safeRefCode = refCode.replace(/[\/\\]/g, '-');
      const extension = path.extname(file.originalname);
      cb(null, `${safeRefCode}_${Date.now()}${extension}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez .doc, .docx, .pdf, .jpg, .jpeg ou .png.'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ✅ PRAGMA déjà appliqués dans db/index.js (WAL, busy_timeout, foreign_keys)

// Créer le dossier avatars s'il n'existe pas
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
  console.log("Dossier 'uploads/avatars' créé.");
}

const { getFrontendRole, getPermissions, getUIConfig, PERMISSIONS_BY_ROLE_ID } = require('./rbac/permissions.map')

// RBAC /me déplacé vers rbacMeRoutes


// app.use('/api/rbac', require('./routes/rbac.routes'))
app.use('/api/audit', require('./routes/audit.routes')(db))
app.use('/api/security', require('./routes/security.routes')(db))


// Debug endpoints (désactivés par défaut)
const DEBUG_ENDPOINTS_ENABLED = process.env.ENABLE_DEBUG_ENDPOINTS === 'true'
function requireDebugEnabled(req, res, next) {
  if (!DEBUG_ENDPOINTS_ENABLED) {
    return res.status(404).json({ error: 'Not found' })
  }
  return next()
}

// === Rôles et autorisations ===
// Hypothèse de mappage role_id -> rôle métier (ajustable selon votre BDD):
// 1: admin, 2: coordonnateur, 3: raf, 4-6: user (anciens compta/caisse/trésor), 7: secretariat, 8: logisticien, 9: assistant_admin, 10: receptionniste
const ROLE_MAP = {
  1: 'admin',
  2: 'coordonnateur',
  3: 'raf',
  4: 'user',  // Ancien COMPTABLE -> user simple
  5: 'user',  // Ancien CAISSE -> user simple
  6: 'user',  // Ancien TRESORERIE -> user simple
  7: 'secretariat',
  8: 'logisticien',
  9: 'assistant_admin',
  10: 'receptionniste',
};

// Mappage role_id -> nom de rôle frontend (majuscules pour correspondre aux layouts)
const FRONTEND_ROLE_MAP = {
  1: 'ADMIN',
  2: 'COORDONNATEUR',
  3: 'SECRETAIRE',  // RAF → SECRETAIRE
  4: 'USER',          // Ancien COMPTABLE → USER
  5: 'USER',          // Ancien CAISSE → USER
  6: 'USER',          // Ancien TRESORERIE → USER
  7: 'SECRETAIRE',    // SECRETARIAT → SECRETAIRE
  8: 'ACQUEREUR',     // Nouvel ajout pour acquéreurs
};

const { roleNameFromId } = require('./utils/rbac');

function getRoleName(user = {}) {
  if (user?.role) return String(user.role).toLowerCase();
  return roleNameFromId(user?.role_id);
}



function authorizeRoles(allowedRoles = []) {
  return (req, res, next) => {
    const user = req.user || {}
    const roleName = String(getRoleName(user) || 'user').toLowerCase()
    const roleId = user.role_id

    // Admin / Coordonnateur = accès global
    if (roleName === 'admin' || roleName === 'coordonnateur') {
      return next()
    }

    const aliasMap = {
      secretaire: 'secretariat',
      'secrétaire': 'secretariat',
    }

    const normalizedAllowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
      .map((r) => {
        if (typeof r === 'number') return { kind: 'id', value: r }

        const raw = String(r).trim().toLowerCase()
        if (!raw) return null

        if (/^\d+$/.test(raw)) return { kind: 'id', value: Number(raw) }

        const aliased = aliasMap[raw] || raw
        return { kind: 'name', value: aliased }
      })
      .filter(Boolean)

    const allowedByName = normalizedAllowed.some((a) => a.kind === 'name' && a.value === roleName)
    const allowedById = roleId != null && normalizedAllowed.some((a) => a.kind === 'id' && a.value === Number(roleId))

    if (allowedByName || allowedById) {
      return next()
    }

    return res.status(403).json({ error: `Accès refusé (rôle requis: ${(allowedRoles || []).join(', ')})` })
  }
}



const mailValidationRouter = mailValidationRoutes({
  authenticateToken,
  validate,
  mailIdParam,
  mailValidateValidator,
  dbGet,
  dbRun,
  canTransition,
  canUserValidateAssignedService,
  recordHistory,
  archiveIncomingMail,
  notifyMailStatusChange,
})
app.use('/api', mailValidationRouter)

const workflowRouter = workflowRoutes({
  authenticateToken,
  dbGet,
  dbAll,
})
app.use('/api', workflowRouter)

const mailArchiveRouter = mailArchiveRoutes({
  authenticateToken,
  authorizeAdmin,
  validate,
  mailIdParam,
  mailArchiveValidator,
  dbGet,
  dbAll,
  dbRun,
  archiveIncomingMail,
  canUserValidateAssignedService,
  recordEntityHistory,
})
app.use('/api', mailArchiveRouter)

const aiAnnexeRouter = aiAnnexeRoutes({
  authenticateToken,
  db,
  PDFDocument,
  StandardFonts,
  path,
  fs,
})
app.use('/api', aiAnnexeRouter)

const aiSemanticRouter = aiSemanticRoutes({
  authenticateToken,
  authorizeRoles,
  upload,
  db,
  path,
  fsPromises,
  PDFDocument,
  StandardFonts,
  mammoth,
  WordExtractor,
  semanticSearch,
  findSimilarDocuments,
  reindexAllDocuments,
  analyzeDocumentAsync,
  extractTextWithOCR,
})
app.use('/api', aiSemanticRouter)

const archivesRouter = archivesRoutes({
  authenticateToken,
  requireDebugEnabled,
  validate,
  archivesListValidator,
  archiveIdParam,
  db,
  logger,
  upload,
  path,
  extractTextFromFile,
  convertDocxToPDF,
  baseDir: __dirname,
})
app.use('/api', archivesRouter)

const miscRouter = miscRoutes({
  authenticateToken,
  db,
  logger,
})
app.use('/api', miscRouter)

const documentsRouter = documentsRoutes({
  authenticateToken,
  db,
})
app.use('/api/documents', documentsRouter)

const debugRouter = debugRoutes({
  authenticateToken,
  requireDebugEnabled,
})
app.use('/api', debugRouter)

const contentRouter = contentRoutes({
  authenticateToken,
  validate,
  pvCategoryParam,
  db,
})
app.use('/api', contentRouter)

const messagesRouter = messagesRoutes({
  authenticateToken,
  validate,
  sessionIdParam,
  userIdParam,
  messageCreateValidator,
  dbAll,
  dbRun,
})
app.use('/api', messagesRouter)

const correspondancesInternesRouter = correspondancesInternesRoutes({
  authenticateToken,
  authorizeRoles,
  validate,
  interneIdParam,
  interneStatsValidator,
  interneCreateValidator,
  upload,
  db,
  baseDir: __dirname,
})
app.use('/api', correspondancesInternesRouter)

const correspondancesExternesRouter = correspondancesExternesRoutes({
  authenticateToken,
  validate,
  externeIdParam,
  externeCreateValidator,
  externeBulkValidator,
  upload,
  db,
})
app.use('/api', correspondancesExternesRouter)

const securityAlertsRouter = securityAlertsRoutes({
  authenticateToken,
  validate,
  securityAlertsListValidator,
  db,
})
app.use('/api', securityAlertsRouter)

const cleanupRouter = cleanupRoutes({
  authenticateToken,
  validate,
  idParam: cleanupIdParam,
  db,
  logAction,
})
app.use('/api', cleanupRouter)

const qrCodeRouter = qrCodeRoutes({
  authenticateToken,
  validate,
  mailIdParam: qrMailIdParam,
  db,
  baseDir: __dirname,
  appUrl: process.env.APP_URL || 'http://localhost:5174',
})
app.use('/api', qrCodeRouter)

const mailStatsRouter = mailStatsRoutes({
  authenticateToken,
  validate,
  mailStatisticsValidator,
  db,
})
app.use('/api', mailStatsRouter)

const statsRouter = statsRoutes({
  authenticateToken,
  db,
  getExpectedServiceForRole,
})
app.use('/api', statsRouter)

const procurementRouter = procurementRoutes({
  authenticateToken,
  upload,
  db,
  logAction,
})
app.use('/api', procurementRouter)

const secretariatRouter = secretariatRoutes({
  authenticateToken,
  upload,
  db,
  extractTextFromPDF,
  callAISummary,
  fs,
  path,
  baseDir: __dirname,
  sqlite3,
  dbPath: DB_PATH,
  pdfParse: PDFParse,
  PDFParse,
  extractTextWithOCR,
  analyzeDocumentAsync,
  analyzeDocument,
  generateUniqueReference,
})
app.use('/api', secretariatRouter)

const courriersSortantsRouter = courriersSortantsRoutes({
  db,
  authenticateToken,
  authorizeRoles,
  upload,
  generateUniqueReference,
  recordEntityHistory,
  extractTextFromFile,
  analyzeDocumentAsync,
  baseDir: __dirname,
})
app.use('/api', courriersSortantsRouter)

const n8nRouter = n8nRoutes({
  authenticateToken,
  authorizeAdmin,
  axios,
  n8nWorkflowsConfig,
  n8nWebhookBase: N8N_WEBHOOK_BASE,
})
app.use('/api', n8nRouter)

const storageRouter = storageRoutes({
  authenticateToken,
  authorizeRoles,
  upload,
  minioConfig,
  fs,
  fsPromises,
  path,
  crypto,
  baseDir: __dirname,
  resolveAlertsByType,
  upsertAlertByType,
})
app.use('/api', storageRouter)

const timestampRouter = timestampRoutes({
  authenticateToken,
  authorizeRoles,
  metrics,
  logger,
  timestampModule,
  minioConfig,
  fs,
  path,
})
app.use('/api', timestampRouter)

const dashboardAiRouter = dashboardAiRoutes({
  authenticateToken,
  axios,
})
app.use('/api', dashboardAiRouter)

const monitoringRouter = monitoringRoutes({
  authenticateToken,
  authorizeRoles,
  metrics,
  logger,
  minioConfig,
  passport,
  db,
})
app.use('/', monitoringRouter)

const historyRouter = historyRoutes({
  authenticateToken,
  db,
})
app.use('/api', historyRouter)

const searchMemoryRouter = searchMemoryRoutes({
  authenticateToken,
  validate,
  searchMemoryValidator,
  queryMemoryStore,
})
app.use('/api', searchMemoryRouter)

const searchRouter = searchRoutes({
  authenticateToken,
  db,
})
app.use('/api', searchRouter)

const hrRouter = hrRoutes({
  authenticateToken,
  db,
  bcrypt,
})
app.use('/api', hrRouter)

const inventoryRouter = inventoryRoutes({
  authenticateToken,
  db,
})
app.use('/api', inventoryRouter)

const filesRouter = filesRoutes({
  authenticateToken,
  upload,
  db,
  path,
  extractTextFromFile,
})
app.use('/api', filesRouter)

const dossiersRouter = dossiersRoutes({
  authenticateToken,
  db,
})
app.use('/api', dossiersRouter)

const agentRouter = agentRoutes({
  authenticateToken,
  openai,
  db,
  getConversationHistory,
  saveMessage,
  listEquipments,
  getUserFromDatabase,
})
app.use('/api', agentRouter)

const extractPdfRouter = extractPdfRoutes({
  authenticateToken,
  upload,
  openai,
  path,
  fsPromises,
  PDFParse,
  extractTextWithOCR,
  calculateFileHash,
  baseDir: __dirname,
})
app.use('/api', extractPdfRouter)

const aiQueryRouter = aiQueryRoutes({
  authenticateToken,
  openai,
  logger,
  queryMemoryStore,
  getAllPDFContent,
  db,
})
app.use('/api', aiQueryRouter)

const uploadRouter = uploadRoutes({
  authenticateToken,
  authorizeAdmin,
  upload,
  path,
  extractTextFromPDF,
  db,
  logger,
  fsPromises,
  buildMemoryStore,
})
app.use('/api', uploadRouter)

const notificationsRouter = notificationsRoutes({
  db,
  authenticateToken,
  validate,
  notificationIdParam,
  notificationCreateValidator,
})
app.use('/api', notificationsRouter)

const servicesRouter = servicesRoutes({
  db,
  authenticateToken,
  validate,
  serviceIdParam,
  serviceCreateValidator,
  serviceUpdateValidator,
  serviceListValidator,
})
app.use('/api', servicesRouter)

const adminRolesPermissionsRouter = adminRolesPermissionsRoutes({
  authenticateToken,
  authorizeAdmin,
  validate,
  rolePermissionValidator,
  PERMISSIONS_BY_ROLE_ID,
  getFrontendRole,
})
app.use('/api', adminRolesPermissionsRouter)

const adminUsersRouter = adminUsersRoutes({
  authenticateToken,
  authorizeAdmin,
  db,
  dbGet,
  dbRun,
  bcrypt,
  normalizeUsername,
  normalizeEmail,
  getFrontendRole,
  getPermissions,
  getUIConfig,
  logUserRoleAudit,
})
app.use('/api', adminUsersRouter)

const rbacMeRouter = rbacMeRoutes({
  authenticateToken,
  getFrontendRole,
  getPermissions,
  getUIConfig,
})
app.use('/api', rbacMeRouter)

const healthRouter = healthRoutes({ db })
app.use('/api', healthRouter)

function generateArchiveReference(originalRef) {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  if (originalRef && originalRef.trim() !== '') {
    return `ARCH-${originalRef}-${year}${month}-${random}`;
  }
  
  return `ARCH-${date.getTime().toString().slice(-6)}-${year}${month}`;
}

// 🔒 SÉCURITÉ: Fonction pour calculer le hash SHA-256 d'un fichier
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

// 🔒 SÉCURITÉ: Fonction pour vérifier l'intégrité d'un fichier
async function verifyFileIntegrity(filePath, expectedHash) {
  try {
    const actualHash = await calculateFileHash(filePath);
    return actualHash === expectedHash;
  } catch (error) {
    console.error('Erreur vérification intégrité fichier:', error);
    return false;
  }
}

// ✅ Fonctions documents (PDF, QR, OCR, IA) déplacées dans services/documents.service.js

// === Garde de machine à états (transitions) ===
const ALLOWED_TRANSITIONS = {
  'Indexé': ['En Traitement'],
  // Après exécution du traitement, le courrier passe en "Validation" (étape dédiée hors Traitement).
  // On garde aussi 'Traité' en compatibilité historique.
  'En Traitement': ['Validation', 'Traité', 'A_Annotation_Coordo', 'Indexé', 'Rejeté', 'Transmis_Comptable', 'Transmis_Caisse', 'Transmis_Tresorerie'],
  'Traité': ['Validation', 'Indexé', 'Rejeté'],
  'Validation': ['Archivé', 'Indexé', 'Rejeté'],
  'A_Disposition_Service': ['En Traitement', 'Transmis_Comptable', 'Transmis_Caisse', 'Transmis_Tresorerie'],
  'Transmis_Comptable': ['Transmis_Caisse', 'Au_Service_Financier'],
  'Transmis_Caisse': ['Au_Service_Financier'],
  'Transmis_Tresorerie': ['Au_Service_Financier'],
  'Au_Service_Financier': ['A_Archiver'],
  'A_Archiver': ['Archivé'],
  'Exécuté': ['Archivé'] // Statut après exécution du traitement
};

function canTransition(fromState, toState) {
  if (fromState === toState) return true; // pas de changement (ex: archive-copy)
  const allowed = ALLOWED_TRANSITIONS[fromState] || [];
  return allowed.includes(toState);
}

// 🔒 SÉCURITÉ: Headers HTTP sécurisés (helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour compatibilité uploads
  crossOriginEmbedderPolicy: false,
  frameguard: false // ✅ Désactiver X-Frame-Options pour permettre l'affichage des PDFs en iframe
}));

// 🔒 SÉCURITÉ: Rate limiting global (500 requêtes par 15 min en développement)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Max 500 requêtes par IP (augmenté pour le développement)
  message: { error: 'Trop de requêtes, veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// 🔒 SÉCURITÉ: Rate limiting strict pour login (5 tentatives par 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true, // Ne compte que les échecs
  handler: (req, res) => {
    metrics.recordRateLimitHit('login');
    logger.security('RATE_LIMIT_HIT', { limiter: 'login', ip: req.ip });
    res.status(429).json({ error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
  }
});

// 📊 PHASE 4: Middleware monitoring Prometheus
app.use(metrics.metricsMiddleware);

// Middleware
app.use(express.json({ limit: '10mb' })); // Limite payload JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// CORS pour les fichiers statiques /uploads
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// 🔒 PHASE 2: Session pour OAuth 2.0
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS en production
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// 🔒 PHASE 2: Initialiser Passport pour OAuth
app.use(passport.initialize());
app.use(passport.session());

// Middleware pour passer la connexion db aux routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// 🔒 Middleware audit: enregistrer IP et User-Agent
app.use((req, res, next) => {
  req.clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  req.userAgent = req.headers['user-agent'];
  next();
});

// /api/health déplacé vers healthRoutes

// Routes utilisateur (profil, paramètres) - AVANT les autres routes pour éviter conflits
try {
  const userRoutes = require('./routes/user.routes');
  console.log('✅ Routes utilisateur chargées et montées sur /api/user');
} catch (error) {
  console.error('❌ Erreur chargement routes utilisateur:', error.message);
}

// Route correspondants (agents internes + partenaires)
const correspondantRoutes = require('./routes/correspondant.routes')(db);
app.use('/api', correspondantRoutes);

// Route Logistique (stocks, parc auto, IT, déploiements, dotations, acquisitions, quittances, assurances)
const logistiqueRoutes = require('./routes/logistique.routes')(db)
app.use('/api/logistique', logistiqueRoutes)

// Configuration pour les fichiers joints
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Utiliser la référence du courrier dans le nom du fichier pour l'unicité
    const refCode = req.body.ref_code || `doc-${Date.now()}`;
    const extension = path.extname(file.originalname);
    cb(null, `${refCode}_${Date.now()}${extension}`);
  }
});



// Création des tables
db.serialize(() => {
  // Table PAIEMENTS
  // Ajoute la colonne `compte` (si manquante) pour pouvoir filtrer la trésorerie par compte.
  db.run(`CREATE TABLE IF NOT EXISTS paiements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    compte TEXT DEFAULT 'Compte courant'
  )`);

  db.all(`PRAGMA table_info(paiements)`, [], (err, cols) => {
    if (err) {
      console.error("Erreur PRAGMA table_info(paiements):", err.message);
      return;
    }

    const hasCompte = (cols || []).some((c) => c && c.name === 'compte');
    if (!hasCompte) {
      db.run(`ALTER TABLE paiements ADD COLUMN compte TEXT DEFAULT 'Compte courant'`, (alterErr) => {
        if (alterErr) {
          console.error("Erreur ajout colonne paiements.compte:", alterErr.message);
          return;
        }
        db.run(`UPDATE paiements SET compte = 'Compte courant' WHERE compte IS NULL OR TRIM(compte) = ''`);
        console.log("✅ Colonne 'paiements.compte' ajoutée.");
      });
      return;
    }

    // Backfill pour les anciennes lignes
    db.run(`UPDATE paiements SET compte = 'Compte courant' WHERE compte IS NULL OR TRIM(compte) = ''`);
  });

  // Table USERS (utilise role_id existant, pas 'role')
  // Ne recrée pas la table si elle existe déjà avec role_id
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, table) => {
    if (table) {
      console.log("Table 'users' existe déjà.");

      // ✅ Correctif sécurité/compat: s'assurer que l'admin a bien role_id=1
      // (beaucoup d'installations historiques créent admin sans role_id explicite => default 2)
      db.run(
        `UPDATE users SET role_id = 1 WHERE username = 'admin' AND (role_id IS NULL OR role_id != 1)`,
        (fixErr) => {
          if (fixErr) console.error('Erreur correctif role_id admin:', fixErr.message)
        },
      )

      // Vérifier si l'admin existe
      db.get(`SELECT id, email, username FROM users WHERE username = ?`, ['admin'], (err, admin) => {
        if (err) {
          console.error("Erreur vérif admin:", err.message);
          return;
        }
        if (admin) {
          console.log(`Utilisateur 'admin' déjà présent (email: ${admin.email}).`);
        } else {
          // Admin existe dans les rôles mais pas dans la table users standard
          console.log("ℹ️ Admin géré par la table users - vérifiez create-admin.js");
        }
      });
    } else {
      // Créer la table si elle n'existe pas (cas très rare maintenant)
      db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role_id INTEGER DEFAULT 2,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (createErr) => {
        if (createErr) {
          console.error("Erreur création table users:", createErr.message);
        } else {
          console.log("Table 'users' créée.");
        }
      });
    }
  });

  // Table USER_ROLE_AUDIT (historique des changements de rôle et créations)
  db.run(`CREATE TABLE IF NOT EXISTS user_role_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- CREATE_USER | CHANGE_ROLE
    old_role_id INTEGER,
    new_role_id INTEGER,
    metadata TEXT, -- JSON additionnel (IP, user-agent, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) {
      console.error('Erreur création table user_role_audit:', err.message);
    } else {
      console.log("Table 'user_role_audit' prête.");
    }
  });

  // Table FINANCE_AUDIT (historique des modifications financières)
  db.run(`CREATE TABLE IF NOT EXISTS finance_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id INTEGER,
    username TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erreur création table finance_audit:', err.message);
    } else {
      console.log("Table 'finance_audit' prête.");
    }
  });

  // === Finances: paramètres (seuils) ===
  // Stockage clé/valeur simple pour les seuils financiers (trésorerie, alertes, etc.)
  db.run(
    `CREATE TABLE IF NOT EXISTS financial_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME,
      updated_by INTEGER
    )`,
    (err) => {
      if (err) {
        console.error("Erreur création table financial_settings:", err.message)
      }
    },
  )

  // === Comptabilité: règles de validation hiérarchique ===
  // Permet d'exiger un rôle minimum pour valider une écriture selon le journal et le montant.
  // Exemple: au-delà d'un certain montant, exiger 'admin' ou 'coordonnateur'.
  db.run(
    `CREATE TABLE IF NOT EXISTS compta_validation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal TEXT NOT NULL, -- ex: 'ACHATS', 'TRESORERIE', '*' (tous)
      min_amount REAL NOT NULL DEFAULT 0,
      required_role TEXT NOT NULL, -- ex: 'raf', 'admin', 'coordonnateur'
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error('Erreur création table compta_validation_rules:', err.message)
      }
    },
  )

  // Règle par défaut: RAF valide (tous journaux, à partir de 0). Peut être surchargée par des règles plus spécifiques.
  db.run(
    `INSERT OR IGNORE INTO compta_validation_rules (journal, min_amount, required_role, enabled) VALUES ('*', 0, 'raf', 1)`
  )

  // === Comptabilité: clôture mensuelle ===
  // Une clôture verrouille les transitions (contrôle/validation) pour un mois donné.
  // month: format 'YYYY-MM'
  db.run(
    `CREATE TABLE IF NOT EXISTS compta_month_closures (
      month TEXT PRIMARY KEY,
      closed INTEGER NOT NULL DEFAULT 0,
      closed_at DATETIME,
      closed_by INTEGER,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error('Erreur création table compta_month_closures:', err.message)
      }
    },
  )

  // === Finance: Audit log (traçabilité des modifications) ===
  db.run(
    `CREATE TABLE IF NOT EXISTS finance_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      user_id INTEGER,
      username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error('Erreur création table finance_audit_log:', err.message)
      }
    }
  )

  // Seuils par défaut (0 = désactivé pour WARNING, et CRITICAL déclenché seulement si solde < 0)
  db.run(
    `INSERT OR IGNORE INTO financial_settings (key, value, updated_at) VALUES ('tresorerie_solde_min_warning', '0', datetime('now'))`,
  )
  db.run(
    `INSERT OR IGNORE INTO financial_settings (key, value, updated_at) VALUES ('tresorerie_solde_min_critical', '0', datetime('now'))`,
  )


  // ✅ MIGRATIONS: Toutes gérées par db/migrations.js
  // Les appels individuels ont été supprimés (évite duplication)
  // Voir ligne 160-163 : runAllMigrations(db)

  // Table correspondances_internes (courriers/documents internes)
  db.run(`
    CREATE TABLE IF NOT EXISTS correspondances_internes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT,
      destinataire TEXT,
      objet TEXT NOT NULL,
      date TEXT NOT NULL,
      fonction TEXT,
      type_document TEXT NOT NULL,
      piece_jointe TEXT,
      metadata TEXT
    )
  `, (err) => {
    if (err) console.error("Erreur création table correspondances_internes:", err.message);
    else {
      console.log("Table 'correspondances_internes' prête.");
      db.all("PRAGMA table_info(correspondances_internes)", (perr, info) => {
        if (perr) return console.error("Erreur PRAGMA correspondances_internes:", perr.message);
        const has = (name) => info && info.some(c => c.name === name);
        const columnsToAdd = [
          { name: 'reference', type: 'TEXT' },
          { name: 'destinataire', type: 'TEXT' },
          { name: 'fonction', type: 'TEXT' },
          { name: 'type_document', type: 'TEXT' },
          { name: 'piece_jointe', type: 'TEXT' },
          { name: 'metadata', type: 'TEXT' },
          { name: 'statut_global', type: "TEXT DEFAULT 'Brouillon'" },
          { name: 'created_by', type: 'INTEGER' },
          { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        ];

        columnsToAdd.forEach((col) => {
          if (!has(col.name)) {
            db.run(`ALTER TABLE correspondances_internes ADD COLUMN ${col.name} ${col.type}`, (aerr) => {
              if (aerr) console.error(`Erreur ajout colonne ${col.name}:`, aerr.message);
            });
          }
        });
      });
    }
  });

  // Table Classement
  db.run(`
    CREATE TABLE IF NOT EXISTS Classement (
      id_classement INTEGER PRIMARY KEY,
      numero_classeur TEXT,
      intitule TEXT,
      detail_abbreviations TEXT
    )
  `, (err) => {
    if (err) {
      console.error("Erreur création table Classement:", err.message);
    } else {
      console.log("Table 'Classement' prête.");
      
      // Vérifier si la table est vide et insérer les données par défaut
      db.get("SELECT COUNT(*) as count FROM Classement", (cerr, row) => {
        if (cerr) {
          console.error("Erreur comptage Classement:", cerr.message);
        } else if (row.count === 0) {
          console.log("Insertion des classeurs par défaut...");
          
          const classeurs = [
            [1, '01', 'Document de base', 'Manuel des procédures, manuel d\'exécution du projet, arrêtés ministériels, etc'],
            [2, '02', 'PR DAIGL, CEPGL', 'La Communauté économique des pays des Grands Lacs'],
            [3, '03', 'Rapport audit externe', ''],
            [4, '04', 'Rapport d\'activité', ''],
            [5, '05', 'Manuel de procédure', ''],
            [6, '06', 'Audit internet et charge d\'audit interne', ''],
            [7, '07', 'Comité de pilotage', ''],
            [8, '08', 'PTBA', 'Plan de Travail de Budget Annuel'],
            [9, '09', 'Actes de cession materiels roulants', ''],
            [10, '10', 'Restructuration et extension PICAGEL', ''],
            [11, '11', 'Echo du PICAGEL', ''],
            [12, '12', 'Contrats pretataires', ''],
            [13, '13', 'RIKOLTO', 'Partenaire de Mise en œuvre du Projet'],
            [14, '14', 'SAGEC-KAT', 'Partenaire de Service'],
            [15, '15', 'Banque Mondiale', ''],
            [16, '16', 'FAO', ''],
            [17, '17', 'UNOPS', ''],
            [18, '18', 'VSF-B', 'Partenaire de Mise en œuvre du Projet'],
            [19, '19', 'IIATA', 'Partenaire de Mise en œuvre du Projet'],
            [20, '20', 'SAPHIR', 'Partenaire de Mise en œuvre du Projet'],
            [21, '21', 'SEANSEM', 'Patenaire Etatique de Mise en œuvre du Projet'],
            [22, '22', 'INERA', 'Patenaire Etatique de Mise en œuvre du Projet'],
            [23, '23', 'IGF, ARNP, ACE', 'IGF (Inspection Générale de Finance'],
            [24, '24', 'Administration Centrale, Autres ministères', ''],
            [25, '25', 'MINAGRI, MINDR, MIN P & EL', 'Minagri (Ministère d\'Agriculture), Mindr (Ministère de Développement Rural), MIN P & EL (Ministère de Pêche et Elevage)'],
            [26, '26', 'SG/AGRI', 'Secrétariat Général de l\'Agriculture'],
            [27, '27', 'SG/P & EL', 'Secrétariat Général de la Pêche et Elevage'],
            [28, '28', 'SG/ DR', 'Secrétariat Général de Développement Rural'],
            [29, '29', 'DIR Normatives du SG/AGRI', 'Direction Normative'],
            [30, '30', 'Direction et services Dev. Rural', ''],
            [31, '31', 'SNV/AGR', 'Service National de Vulgarisation'],
            [32, '32', 'Administration Provinciale', ''],
            [33, '33', 'Contentieux', ''],
            [34, '34', 'UPEP/TANGANIKA', 'Unité Provinciale d\'Exécution du Projet dans le Tanganyika (PICAGL)'],
            [35, '35', 'UPEP/SUD-KIVU', 'Unité Provinciale d\'Exécution du Projet dans le Sud-Kivu (PICAGL)'],
            [36, '36', 'Courrier reçu/Courriel/TDR/Invitation', ''],
            [37, '37', 'Correspondance externe', ''],
            [38, '38', 'Offre de servie', ''],
            [39, '39', 'Autres Factures', ''],
            [40, '40', 'Correspondance Interne', ''],
            [41, '41', 'Ordre de mission/Notes de service', ''],
            [42, '42', 'Alpha', ''],
            [43, '43', 'Beta', ''],
            [44, '44', 'NEW EKU/IT ENG', 'Partenaire de Service'],
            [45, '45', 'GARAGE', ''],
            [46, '46', 'UPEP TANGANIKA', ''],
            [47, '47', 'ADM PROV TANGANIKA & SUD-KIVU', ''],
            [48, '48', 'Ordre de Mission', ''],
            [49, '49', 'PARA ETATIQUE, OCC, DGDA, DGI, SONAS, STA', 'OCC (Office Congolaise de Contrôle), DGDA (Direction Générale de Doine et Assises), DGI (Direction Générale des Impots), SONAS (Service Nationale d\'Assurance)'],
            [50, '50', 'AG de voyage', 'Agence de Voyage'],
            [51, '51', 'Fournisseurs', ''],
            [52, '52', 'Evaluateurs', ''],
            [53, '53', 'Auditeur Externe', ''],
            [54, '54', 'Consultants', ''],
            [55, '55', 'NHIMO', 'Partenaire de Mise en œuvre du Projet'],
            [56, '56', 'HPP CONGO', 'Partenaire de Mise en œuvre du Projet'],
            [57, '57', 'ADSSE', 'Partenaire de Mise en œuvre du Projet'],
            [58, '58', 'UEFA', 'Partenaire de Mise en œuvre du Projet'],
            [59, '59', 'UBC', 'Partenaire de Mise en œuvre du Projet'],
            [60, '60', 'Projet et Programme', ''],
            [61, '61', 'Requetes, Avis à publier, Communiqué', ''],
            [62, '62', 'Rapport de mission collective', ''],
            [63, '63', 'Banque commerciale', ''],
            [64, '64', 'Bon de requisition fourniture', ''],
            [65, '65', 'ETS KOKO', 'Partenaire de Mise en œuvre du Projet'],
            [66, '66', 'Presse', ''],
            [67, '67', 'UGES/PICAGEL', 'Partenaire de Mise en œuvre du Projet'],
            [68, '68', 'MISSIONS DE SUPERVISION', ''],
            [69, '69', 'STAR-EST', 'Partenaire de Mise en œuvre du Projet'],
            [70, '70', 'Recrutement des personnes en conflit d\'intérêt', ''],
            [71, '71', 'Facture fournisseurs 1', ''],
            [72, '72', 'Facture fournisseurs 2', ''],
            [73, '73', 'Facture fournisseurs 3', ''],
            [74, '74', 'Facture staff 1', ''],
            [75, '75', 'Facture staff 2', ''],
            [76, '76', 'Facture Tanganika', ''],
            [77, '77', 'Facture UPEP/TANGANIKA', ''],
            [78, '78', 'Courrier reçu staff 1', ''],
            [79, '79', 'Courrier reçu staff 2', ''],
            [80, '80', 'Courrier reçu staff 3', ''],
            [81, '81', 'Const Inter & national', ''],
            [82, '82', 'Courriers internes expédiés', ''],
            [83, '83', 'SG Agri, PE EL, Developpement Rural', ''],
            [84, '84', 'Facture Fournisseurs 2', ''],
            [85, '85', 'Diverses correspondances', ''],
            [86, '86', 'Minagri', 'Ministère de l\'Agriculture'],
            [87, '87', 'Factures fournisseurs 2', ''],
            [88, '88', 'Factures sous-projets et autres UPEP Tanganika', ''],
            [89, '89', 'DIR & SERVICES Secrétariat Général de l\'Agriculture', ''],
            [90, '90', 'SAGEC-KAFI', 'Partenaire de Mise en œuvre du Projet'],
            [91, '91', 'Rapport Audit Ext', '']
          ];

          const insertStmt = db.prepare("INSERT INTO Classement (id_classement, numero_classeur, intitule, detail_abbreviations) VALUES (?, ?, ?, ?)");
          
          classeurs.forEach(classeur => {
            insertStmt.run(classeur, (ierr) => {
              if (ierr) console.error(`Erreur insertion classeur ${classeur[1]}:`, ierr.message);
            });
          });
          
          insertStmt.finalize(() => {
            console.log(`✅ ${classeurs.length} classeurs insérés avec succès.`);
          });
        } else {
          console.log(`Table Classement contient déjà ${row.count} entrées.`);
        }
      });
    }
  });

});

// Table des profils utilisateurs
db.run(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    phone TEXT,
    bio TEXT,
    position TEXT,
    department TEXT,
    avatar TEXT,
    preferences TEXT,
    notification_settings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) {
    console.error('Erreur création table user_profiles:', err.message);
  } else {
    console.log("Table 'user_profiles' prête.");
  }
});



// Configuration des workflows n8n déclenchables depuis le dashboard
/* n8nWorkflowsConfig moved to top */

// ✅ Fonctions extraction texte (PDF, DOCX) déplacées dans services/documents.service.js

// Upload fichiers déplacé vers filesRoutes

// Middleware pour enregistrer l'historique
const logHistory = (entityType, entityId, action, details) => {
  const timestamp = new Date().toISOString();
  db.run(
    `INSERT INTO history (entityType, entityId, action, details, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, action, details, timestamp],
    (err) => {
      if (err) console.error('Erreur lors de l\'enregistrement dans l\'historique :', err);
    }
  );
};

// Fonction pour vérifier si un nom d'expéditeur est un employé
async function isInternalSender(senderName) {
  if (!senderName) return false;
  
  // Utilise le nom complet ou le début du nom pour la recherche (insensible à la casse)
  const sql = `
    SELECT COUNT(id) AS count 
    FROM personnel_unified 
    WHERE name LIKE ? 
    COLLATE NOCASE
  `;
  // La recherche utilise le nom complet ou le début du nom pour plus de flexibilité
  const params = [`%${senderName.trim()}%`]; 
  
  try {
    const row = await new Promise((resolve, reject) => {
      // db.get est utilisé ici car on attend une seule ligne (le COUNT)
      db.get(sql, params, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    // Retourne true si au moins un employé correspond
    return row && row.count > 0;
  } catch (error) {
    console.error("Erreur lors de la vérification du personnel :", error.message);
    return false;
  }
}

/**
 * Fonction utilitaire pour enregistrer une action dans l'historique
 * @param {number} mailId - ID du courrier
 * @param {string} action - Description courte de l'action
 * @param {number} userId - ID de l'utilisateur
 * @param {string} userName - Nom de l'utilisateur
 * @param {string} details - Détails JSON ou texte de l'action
 * @param {Object} req - Objet requête Express pour extraire IP/User-Agent
 */
function recordHistory(mailId, action, userId, userName, details = null, req = null) {
  recordEntityHistory('incoming_mails', mailId, action, userId, userName, details, req);
  // Compat: conserver l'ancien historique incoming_mails si utilisé ailleurs.
  try {
    const enrichedDetails = normalizeHistoryDetails(details);
    const ipAddress = req?.clientIp || 'unknown';
    const userAgent = req?.userAgent || 'unknown';
    const actionData = `incoming_mails|${mailId}|${action}|${userId}|${userName}|${new Date().toISOString()}|${enrichedDetails}`;
    const actionHash = crypto.createHash('sha256').update(actionData).digest('hex');
    const sql = `INSERT INTO mail_history (mail_id, action, user_id, user_name, details, ip_address, user_agent, action_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [
      mailId, 
      action, 
      userId, 
      userName, 
      enrichedDetails, 
      ipAddress, 
      userAgent, 
      actionHash
    ], (err) => {
      if (err) console.error(`Erreur mail_history pour incoming ${mailId}:`, err.message);
    });
  } catch (e) {
    console.error('Erreur recordHistory compat:', e.message);
  }
}

function normalizeHistoryDetails(details) {
  if (details === undefined) return null;
  if (details === null) return null;
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
};

/**
 * Fonction de logging d'action générique (compatible avec cleanup/procurement routes)
 */
function logAction(entityType, entityId, action, details) {
  // Utilise 'SYSTEM' comme utilisateur par défaut car ces actions sont souvent déclenchées via des routes/services
  // qui ne passent pas explicitement l'utilisateur à cette fonction helper.
  recordEntityHistory(entityType, entityId, action, null, 'SYSTEM', details);
}

function recordEntityHistory(entityType, entityId, action, userId, userName, details = null, req = null) {
  const enrichedDetails = normalizeHistoryDetails(details);
  const ipAddress = req?.clientIp || 'unknown';
  const userAgent = req?.userAgent || 'unknown';
  const actionData = `${entityType}|${entityId}|${action}|${userId}|${userName}|${new Date().toISOString()}|${enrichedDetails}`;
  const actionHash = crypto.createHash('sha256').update(actionData).digest('hex');

  const sql = `INSERT INTO entity_history (entity_type, entity_id, action, user_id, user_name, details, ip_address, user_agent, action_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(
    sql,
    [String(entityType), String(entityId), action, userId ?? null, userName ?? null, enrichedDetails, ipAddress, userAgent, actionHash],
    (err) => {
      if (err) {
        // Ne doit jamais bloquer le workflow.
        console.error(`Erreur entity_history (${entityType}:${entityId}):`, err.message);
      }
    }
  );
}

function logUserRoleAudit({ actor_user_id, target_user_id, action, old_role_id = null, new_role_id = null, metadata = {} }) {
  return new Promise((resolve, reject) => {
    const metaJson = JSON.stringify(metadata);
    // Vérifier si la table user_role_audit existe, sinon la créer (devrait être fait par migrations mais sécurité)
    db.run(
      `CREATE TABLE IF NOT EXISTS user_role_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER,
        target_user_id INTEGER,
        action TEXT,
        old_role_id INTEGER,
        new_role_id INTEGER,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) {
            console.error('❌ Erreur checkUserRoleAuditTable:', err.message);
            return reject(err);
        }
        db.run(
            `INSERT INTO user_role_audit (actor_user_id, target_user_id, action, old_role_id, new_role_id, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
            [actor_user_id, target_user_id, action, old_role_id, new_role_id, metaJson],
            function(err2) {
              if (err2) {
                console.error('❌ Erreur audit user_role:', err2.message);
                return reject(err2);
              }
              resolve(this.lastID);
            }
          );
      }
    );
  });
}

// Routes API

const authRouter = authRoutes({
  db,
  authenticateToken,
  loginLimiter,
  jwtSecret: SECRET_KEY,
  getFrontendRole,
  getPermissions,
  getUIConfig,
  logUserRoleAudit,
});
app.use('/api', authRouter);
app.use('/api/auth', authRouter);


// Routes utilisateurs/admin déplacées vers adminUsersRoutes

// 🔒 PHASE 2: Routes OAuth 2.0
// Google OAuth
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Authentification réussie, créer un JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      SECRET_KEY,
      { expiresIn: '24h' }
    );
    // Rediriger vers le frontend avec le token
    res.redirect(`http://localhost:5174/#/oauth-callback?token=${token}`);
  }
);

// OAuth 2.0 Générique
app.get('/auth/oauth2',
  passport.authenticate('oauth2-generic')
);

app.get('/auth/oauth2/callback',
  passport.authenticate('oauth2-generic', { failureRedirect: '/login' }),
  (req, res) => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: req.user.id },
      SECRET_KEY,
      { expiresIn: '24h' }
    );
    res.redirect(`http://localhost:5174/#/oauth-callback?token=${token}`);
  }
);

// Logout OAuth
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Erreur logout' });
    res.json({ message: 'Déconnexion réussie' });
  });
});

// NOUVEAU: Route pour les actions d'administration (ex: obtenir tous les utilisateurs avec vérification de rôle)
function authorizeAdmin(req, res, next) {
  // role_id 1 = admin
  if (req.user.role_id !== 1 && req.user.role_id !== 2) {
    return res.status(403).json({ error: 'Accès refusé. Nécessite un rôle d\'administrateur.' });
  }
  next();
}

// Routes utilisateurs/admin déplacées vers adminUsersRoutes

// Route racine
app.get('/', (req, res) => {
  res.send('Bienvenue dans le backend des courriers !');
});

const incomingMailsRoutes = require('./routes/incomingMails.routes')({
  db,
  authenticateToken,
  upload,
  generateNextHumanNumber,
  generateUniqueReference,
  generateMailQRCode,
  generateARPDF,
  analyzeDocumentAsync,
  notifyMailStatusChange,
  recordHistory,
  canTransition,
  canUserValidateAssignedService,
  notifyServiceForward,
  recordEntityHistory,
  canUserViewIncomingMail,
  getExpectedServiceForRole,
  baseDir: __dirname,
});
app.use('/api', incomingMailsRoutes);

const mailSharesRoutes = require('./routes/mailShares.routes')({ db, authenticateToken });
app.use('/api', mailSharesRoutes);

function getRoleIdsForServiceCode(serviceCode) {
  const code = (serviceCode || '').toString().trim().toUpperCase();
  const map = {
    CAISSE: [5],
    COMPTABLE: [4],
    TRESORERIE: [6],
    RAF: [3],
  };
  return map[code] || [];
}

function canUserValidateAssignedService(user, assignedService) {
  const roleId = user?.role_id
  const svc = String(assignedService || '').trim().toUpperCase()

  // Admin uniquement
  if (roleId === 1) return true

  // Si pas de service assigné, on ne valide pas (sauf admin)
  if (!svc) return false

  // SEC: admin + secrétariat
  if (svc === 'SEC') return roleId === 7

  // Mapping strict service -> rôle attendu
  const roleIdToService = {
    2: 'COORDO',
    3: 'RAF',
    4: 'COMPTABLE',
    5: 'CAISSE',
    6: 'TRESORERIE',
    7: 'SEC',
    8: 'LOGISTIQUE',
  }
  return String(roleIdToService[roleId] || '').toUpperCase() === svc
}

function getExpectedServiceForRole(roleId) {
  const roleIdToService = {
    2: 'COORDO',
    3: 'RAF',
    4: 'COMPTABLE',
    5: 'CAISSE',
    6: 'TRESORERIE',
    7: 'SEC',
    8: 'LOGISTIQUE',
  }
  return String(roleIdToService[roleId] || '').trim().toUpperCase()
}

function canUserViewIncomingMail(user, mail) {
  // Lecture "Indexation" : admin + coordonnateur + secrétariat
  const isPrivilegedRead = user && (user.role_id === 1 || user.role_id === 2 || user.role_id === 7)
  if (isPrivilegedRead) return true

  const username = String(user?.username || '').trim()
  const userId = user?.id != null ? String(user.id).trim() : ''
  let assignedTo = String(mail?.assigned_to || '').trim()
  const mailSvc = String(mail?.assigned_service || '').trim().toUpperCase()

  // Compat historique: certains flux ont enregistré assigned_to='admin' comme placeholder.
  // Ne pas bloquer la lecture par les rôles service-spécifiques.
  if (assignedTo && assignedTo.toLowerCase() === 'admin') {
    assignedTo = ''
  }

  // Si le courrier est désigné à un utilisateur précis, seuls lui + admin/coordo peuvent le voir
  if (assignedTo) {
    const isMine = (username && assignedTo === username) || (userId && assignedTo === userId)
    if (!isMine) return false
  }

  // Si le courrier est assigné à un service, seul le rôle/service correspondant peut le voir
  if (mailSvc) {
    const expectedSvc = getExpectedServiceForRole(user?.role_id)
    if (!expectedSvc) return false
    return expectedSvc === mailSvc
  }

  // Pas de service: défaut = ne pas exposer aux rôles service-spécifiques
  const expectedSvc = getExpectedServiceForRole(user?.role_id)
  if (expectedSvc) return false

  return true
}

async function notifyServiceForward({ mailId, serviceCode, forwardedByUsername }) {
  const roleIds = getRoleIdsForServiceCode(serviceCode);
  if (!roleIds.length) return;

  const mail = await dbGet('SELECT id, ref_code, subject, sender FROM incoming_mails WHERE id = ?', [mailId]).catch(() => null);
  if (!mail) return;

  const users = await getUsersByRoles(roleIds).catch(() => []);
  if (!users.length) return;

  const code = (serviceCode || '').toString().trim().toUpperCase();
  const type = `transmis_${code.toLowerCase()}`;
  const titre = `📌 Courrier transmis à ${code}`;
  const message = `Réf: ${mail.ref_code || mail.id} — ${mail.subject || 'Sans objet'}${forwardedByUsername ? ` (par ${forwardedByUsername})` : ''}`;

  const uniqueUsers = [...new Map(users.map(u => [u.id, u])).values()];
  for (const u of uniqueUsers) {
    await createNotification(u.id, type, titre, message, mailId);
  }
}

// ==================== NOTIFICATIONS INTERNES ====================

function createNotification(user_id, type, titre, message, mail_id = null) {
  return createNotificationInternal({
    db,
    userId: user_id,
    type,
    titre,
    message,
    mailId: mail_id,
  });
}

function notifyMailStatusChange(mailId, status, assignedTo = null, details = {}) {
  return notifyMailStatusChangeService({ db, mailId, status, assignedTo, details });
}

function getUsersByRoles(roleIds) {
  return getUsersByRolesService({ db, roleIds });
}

// ✅ Fonction OCR déplacée dans services/documents.service.js

// Fonction utilitaire pour exécuter une requête GET avec une Promise
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      // 'row' sera soit l'objet utilisateur, soit undefined si non trouvé
      resolve(row); 
    });
  });
}

// Fonction utilitaire pour exécuter une requête ALL avec une Promise
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function formatHumanSequentialNumber(prefix, year, seq, pad = 6) {
  const y = String(year)
  const n = String(seq).padStart(pad, '0')
  return `${prefix}-${y}-${n}`
}

async function generateNextHumanNumber({ table, column, prefix, pad = 6, year = new Date().getFullYear() }) {
  const like = `${prefix}-${year}-%`
  const row = await dbGet(
    `SELECT ${column} as v
     FROM ${table}
     WHERE ${column} IS NOT NULL AND TRIM(${column}) <> '' AND ${column} LIKE ?
     ORDER BY ${column} DESC
     LIMIT 1`,
    [like]
  ).catch(() => null)

  let lastSeq = 0
  const v = (row?.v || '').toString().trim()
  if (v) {
    const m = v.match(/-(\d+)$/)
    if (m && m[1]) lastSeq = Number(m[1]) || 0
  }

  return formatHumanSequentialNumber(prefix, year, lastSeq + 1, pad)
}

async function ensureMailNumeroFinance(mailId) {
  const mail = await dbGet(
    `SELECT id, numero_finance FROM incoming_mails WHERE id = ?`,
    [Number(mailId)]
  ).catch(() => null)
  if (!mail) return null

  const existing = String(mail.numero_finance || '').trim()
  if (existing) return existing

  const numero = await generateNextHumanNumber({ table: 'incoming_mails', column: 'numero_finance', prefix: 'FIN' })
  await dbRun(
    `UPDATE incoming_mails
     SET numero_finance = ?
     WHERE id = ? AND (numero_finance IS NULL OR TRIM(numero_finance) = '')`,
    [numero, Number(mailId)]
  ).catch(() => {})
  return numero
}

// Fonction pour créer une alerte de sécurité si elle n'existe pas déjà récemment

function createAlertIfNotExists({ type, title, message, severity, meta }) {
  const metaStr = JSON.stringify(meta || {})
  db.get(
    `SELECT 1 FROM security_alerts
     WHERE type = ? AND status = 'new'
     AND created_at >= datetime('now','-30 minutes')`,
    [type],
    (err, row) => {
      if (err) return console.error(err)
      if (row) return
      db.run(
        `INSERT INTO security_alerts (type, title, message, severity, status, source, meta)
         VALUES (?, ?, ?, ?, 'new', 'detector', ?)`,
        [type, title, message, severity, metaStr]
      )
    }
  )
}

async function upsertAlertByType({ type, title, message, severity, meta, source = 'smart-detector' }) {
  const metaStr = JSON.stringify(meta || {})

  // Si une alerte existe déjà (new/seen), on met à jour au lieu de spammer
  const existing = await dbGet(
    `SELECT id, status FROM security_alerts
     WHERE type = ? AND status IN ('new','seen')
     ORDER BY created_at DESC
     LIMIT 1`,
    [type]
  ).catch(() => null)

  if (existing?.id) {
    await dbRun(
      `UPDATE security_alerts
       SET title = ?, message = ?, severity = ?, meta = ?, source = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, message, severity, metaStr, source, existing.id]
    )
    return
  }

  await dbRun(
    `INSERT INTO security_alerts (type, title, message, severity, status, source, meta, updated_at)
     VALUES (?, ?, ?, ?, 'new', ?, ?, CURRENT_TIMESTAMP)`,
    [type, title, message, severity, source, metaStr]
  )
}

async function resolveAlertsByType(type) {
  await dbRun(
    `UPDATE security_alerts
     SET status='resolved', updated_at=CURRENT_TIMESTAMP
     WHERE type = ? AND status IN ('new','seen')`,
    [type]
  ).catch(() => null)
}

async function detectWorkflowDelays() {
  // Détection simple: retards par statut (basée sur date_reception si dispo)
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, [])
    const names = new Set((cols || []).map(c => c.name))

    const statusExpr = names.has('statut_global')
      ? 'statut_global'
      : (names.has('status') ? 'status' : null)

    if (!statusExpr) return

    const dateField = names.has('date_reception') ? 'date_reception'
      : names.has('arrival_date') ? 'arrival_date'
      : names.has('mail_date') ? 'mail_date'
      : names.has('created_at') ? 'created_at'
      : null

    if (!dateField) return

    const rules = [
      { key: 'WORKFLOW_DELAY_ACQUIS', status: 'Acquis', days: 3 },
      { key: 'WORKFLOW_DELAY_INDEXE', status: 'Indexé', days: 5 },
      { key: 'WORKFLOW_DELAY_TRAITEMENT', status: 'En Traitement', days: 7 },
    ]

    for (const rule of rules) {
      const row = await dbGet(
        `SELECT COUNT(*) as c, MIN(${dateField}) as oldest
         FROM incoming_mails
         WHERE lower(${statusExpr}) = lower(?)
           AND datetime(COALESCE(${dateField}, datetime('now'))) <= datetime('now', ?)`,
        [rule.status, `-${rule.days} days`]
      ).catch(() => null)

      const count = Number(row?.c || 0)
      if (!count) {
        await resolveAlertsByType(rule.key)
        continue
      }

      const severity = count >= 20 ? 'high' : count >= 5 ? 'medium' : 'low'
      const oldest = row?.oldest || null

      await upsertAlertByType({
        type: rule.key,
        title: `Retard workflow: ${rule.status}`,
        message: `${count} courrier(s) au statut "${rule.status}" depuis plus de ${rule.days} jour(s).` + (oldest ? ` Plus ancien: ${oldest}.` : ''),
        severity,
        meta: { status: rule.status, threshold_days: rule.days, count, oldest },
      })
    }
  } catch (e) {
    console.error('❌ detectWorkflowDelays error:', e?.message || e)
  }
}

async function detectRejectionSpike() {
  // Pic de rejets sur 24h
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, [])
    const names = new Set((cols || []).map(c => c.name))
    const statusExpr = names.has('statut_global')
      ? 'statut_global'
      : (names.has('status') ? 'status' : null)
    const dateField = names.has('date_reception') ? 'date_reception'
      : names.has('arrival_date') ? 'arrival_date'
      : names.has('mail_date') ? 'mail_date'
      : names.has('created_at') ? 'created_at'
      : null

    if (!statusExpr || !dateField) return

    const row = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${statusExpr}) = lower('Rejeté')
         AND datetime(${dateField}) >= datetime('now', '-1 day')`,
      []
    ).catch(() => null)

    const count = Number(row?.c || 0)
    const type = 'REJECTION_SPIKE_24H'

    if (count >= 10) {
      await upsertAlertByType({
        type,
        title: 'Pic de rejets (24h)',
        message: `${count} courriers rejetés sur les dernières 24h.`,
        severity: count >= 25 ? 'high' : 'medium',
        meta: { window: '24h', count },
      })
    } else {
      await resolveAlertsByType(type)
    }
  } catch (e) {
    console.error('❌ detectRejectionSpike error:', e?.message || e)
  }
}

async function detectUrgentBacklog() {
  // Urgents en souffrance (basé sur ai_priority='urgent' si la colonne existe)
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, [])
    const names = new Set((cols || []).map(c => c.name))

    if (!names.has('ai_priority')) {
      await resolveAlertsByType('URGENT_BACKLOG').catch(() => {})
      return
    }

    const statusExpr = names.has('statut_global')
      ? 'statut_global'
      : (names.has('status') ? 'status' : null)

    const dateField = names.has('date_reception') ? 'date_reception'
      : names.has('arrival_date') ? 'arrival_date'
      : names.has('mail_date') ? 'mail_date'
      : names.has('created_at') ? 'created_at'
      : null

    if (!statusExpr || !dateField) return

    // On vise uniquement les statuts non finalisés
    const row = await dbGet(
      `SELECT COUNT(*) as c, MIN(${dateField}) as oldest
       FROM incoming_mails
       WHERE lower(ai_priority) = lower('urgent')
         AND lower(${statusExpr}) IN (lower('acquis'), lower('indexé'), lower('indexe'), lower('en traitement'))
         AND datetime(${dateField}) <= datetime('now', '-2 days')`,
      []
    ).catch(() => null)

    const count = Number(row?.c || 0)
    if (!count) {
      await resolveAlertsByType('URGENT_BACKLOG')
      return
    }

    await upsertAlertByType({
      type: 'URGENT_BACKLOG',
      title: 'Urgents en souffrance',
      message: `${count} courrier(s) marqués urgents ont plus de 48h sans finalisation (Acquis/Indexé/En Traitement).` + (row?.oldest ? ` Plus ancien: ${row.oldest}.` : ''),
      severity: count >= 10 ? 'high' : 'medium',
      meta: { count, threshold: '48h', oldest: row?.oldest || null },
    })
  } catch (e) {
    console.error('❌ detectUrgentBacklog error:', e?.message || e)
  }
}

async function detectResponseDueOverdue() {
  // Échéances dépassées (response_due) pour les courriers non archivés
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, [])
    const names = new Set((cols || []).map(c => c.name))

    if (!names.has('response_due')) {
      await resolveAlertsByType('RESPONSE_DUE_OVERDUE').catch(() => {})
      return
    }

    const statusExpr = names.has('statut_global')
      ? 'statut_global'
      : (names.has('status') ? 'status' : null)

    if (!statusExpr) return

    const row = await dbGet(
      `SELECT COUNT(*) as c, MIN(response_due) as oldest_due
       FROM incoming_mails
       WHERE response_due IS NOT NULL
         AND date(response_due) < date('now')
         AND lower(${statusExpr}) NOT IN (lower('archivé'), lower('archive'))`,
      []
    ).catch(() => null)

    const count = Number(row?.c || 0)
    if (!count) {
      await resolveAlertsByType('RESPONSE_DUE_OVERDUE')
      return
    }

    await upsertAlertByType({
      type: 'RESPONSE_DUE_OVERDUE',
      title: 'Échéances dépassées',
      message: `${count} courrier(s) ont une date de réponse attendue dépassée (response_due).` + (row?.oldest_due ? ` Plus ancienne échéance: ${row.oldest_due}.` : ''),
      severity: count >= 20 ? 'high' : 'medium',
      meta: { count, oldest_due: row?.oldest_due || null },
    })
  } catch (e) {
    console.error('❌ detectResponseDueOverdue error:', e?.message || e)
  }
}

async function detectAcquisitionSpike() {
  // Détection d'anomalie simple: volume "Acquis" sur 24h vs moyenne 7 jours précédents
  try {
    const cols = await dbAll(`PRAGMA table_info(incoming_mails)`, [])
    const names = new Set((cols || []).map(c => c.name))

    const statusExpr = names.has('statut_global')
      ? 'statut_global'
      : (names.has('status') ? 'status' : null)

    const dateField = names.has('date_reception') ? 'date_reception'
      : names.has('arrival_date') ? 'arrival_date'
      : names.has('mail_date') ? 'mail_date'
      : names.has('created_at') ? 'created_at'
      : null

    if (!statusExpr || !dateField) return

    const last24h = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${statusExpr}) = lower('acquis')
         AND datetime(${dateField}) >= datetime('now', '-1 day')`,
      []
    ).catch(() => null)

    const prev7d = await dbGet(
      `SELECT COUNT(*) as c
       FROM incoming_mails
       WHERE lower(${statusExpr}) = lower('acquis')
         AND datetime(${dateField}) >= datetime('now', '-8 day')
         AND datetime(${dateField}) < datetime('now', '-1 day')`,
      []
    ).catch(() => null)

    const c24 = Number(last24h?.c || 0)
    const c7 = Number(prev7d?.c || 0)
    const avg = c7 / 7

    const type = 'ACQUISITION_SPIKE'
    // garde-fous pour éviter le bruit sur petits volumes
    const isSpike = c24 >= 20 && avg > 0 && (c24 / avg) >= 2

    if (!isSpike) {
      await resolveAlertsByType(type)
      return
    }

    await upsertAlertByType({
      type,
      title: 'Pic d’acquisitions (24h)',
      message: `${c24} courriers "Acquis" sur 24h (≈ ${avg.toFixed(1)}/jour sur les 7 jours précédents).`,
      severity: (c24 / avg) >= 3 ? 'high' : 'medium',
      meta: { last_24h: c24, prev_7d_total: c7, prev_7d_avg_per_day: avg },
    })
  } catch (e) {
    console.error('❌ detectAcquisitionSpike error:', e?.message || e)
  }
}

function startSmartAlertsScheduler() {
  // Toutes les 5 minutes
  const run = async () => {
    await detectWorkflowDelays()
    await detectRejectionSpike()
    await detectUrgentBacklog()
    await detectResponseDueOverdue()
    await detectAcquisitionSpike()
  }
  run()
  setInterval(run, 5 * 60 * 1000)
}

// Détecter les tentatives de bruteforce

function detectBruteforce() {
  db.all(
    `SELECT ip, COUNT(*) as fails
     FROM audit_logs
     WHERE action = 'LOGIN_FAILED'
       AND created_at >= datetime('now','-10 minutes')
     GROUP BY ip
     HAVING fails >= 5`,
    [],
    (err, rows) => {
      if (err) return console.error(err)
      rows.forEach(r => {
        createAlertIfNotExists({
          type: 'BRUTE_FORCE_LOGIN',
          title: 'Tentatives de connexion suspectes',
          message: `Détection brute-force: ${r.fails} échecs de connexion en 10 min depuis IP ${r.ip}`,
          severity: 'high',
          meta: { ip: r.ip, fails: r.fails }
        })
      })
    }
  )
}

module.exports.startSecurityDetector = function startSecurityDetector() {
  setInterval(detectBruteforce, 60 * 1000) // chaque minute
  detectBruteforce()
}

/**
 * Archive an incoming mail by creating an `archives` row, copying annexes
 * to `archive_annexes`, updating archival timestamps/status and optionally
 * deleting the original incoming_mails row.
 *
 * options: { userId, userName, comment, category, classeur, deleteOriginal = true, req }
 */
async function archiveIncomingMail(mailId, options = {}) {
  const { userId, userName, comment, category, classeur, deleteOriginal = false, req } = options;

  try {
    // 1) Récupérer le courrier COMPLET
    const mail = await dbGet(`
      SELECT id, ref_code, subject, sender, date_reception, statut_global,
             comment, assigned_to, classeur, file_path, extracted_text,
             summary, type_courrier, recipient, date_indexation,
             assigned_service, service_orientation_dg, classification, ai_summary, ai_keywords,
             ai_priority, qr_code_path, ar_pdf_path, category
      FROM incoming_mails
      WHERE id = ?
    `, [mailId]);

    if (!mail) throw new Error('Courrier non trouvé');

    // 2) Expéditeur fallback si "Inconnu"
    let senderToArchive = mail.sender;
    if (!senderToArchive || senderToArchive === 'Inconnu' || senderToArchive === 'Unknown') {
      if (mail.extracted_text) {
        const senderMatch =
          mail.extracted_text.match(/Expéditeur[:\s]+([^\n]+)/i) ||
          mail.extracted_text.match(/De[:\s]+([^\n]+)/i) ||
          mail.extracted_text.match(/From[:\s]+([^\n]+)/i);

        if (senderMatch?.[1]) {
          senderToArchive = senderMatch[1].trim().substring(0, 200);
          console.log(`✅ Expéditeur extrait du texte: ${senderToArchive}`);
        }
      }
    }

    // 3) Référence archive unique
    const archiveReference = generateArchiveReference(mail.ref_code || mail.id);

    // 4) Date d’archive
    const archiveDate =
      (mail.date_reception && String(mail.date_reception).slice(0, 10)) ||
      new Date().toISOString().slice(0, 10);

    // 5) INSERT archives (schéma runtime: la table `archives` ne contient pas
    // pdf_path/type_courrier/archived_at/qr_code_path/ar_pdf_path/archived_by/archived_date)
    const insertSql = `
      INSERT INTO archives (
        reference,
        type,
        date,
        description,
        category,
        classeur,
        file_path,
        status,
        sender,
        service_code,
        incoming_mail_id,
        extracted_text,
        summary,
        classification,
        ai_summary,
        ai_keywords,
        ai_priority,
        executed_task,
        coordo_annotation,
        created_at,
        updated_at
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?,
        datetime('now'),
        datetime('now')
      )
    `;

    const insertParams = [
      archiveReference,
      mail.type_courrier || 'Courrier Entrant',
      archiveDate,
      mail.subject || 'Sans objet',
      category || mail.category || mail.classification || 'INCONNU',
      classeur || mail.classeur || null,
      mail.file_path || null,
      'Archivé',
      senderToArchive || mail.sender || 'Inconnu',
      mail.assigned_service || mail.service_orientation_dg || 'INCONNU',
      mailId,
      mail.extracted_text || null,
      mail.summary || mail.ai_summary || null,
      mail.classification || null,
      mail.ai_summary || null,
      mail.ai_keywords || null,
      mail.ai_priority || null,
      comment || null,
      null
    ];

    const result = await dbRun(insertSql, insertParams);
    const archiveId = result.lastID;

    // 6) Annexes
    const annexes = await dbAll('SELECT * FROM annexes WHERE incoming_mail_id = ?', [mailId]);
    if (annexes?.length) {
      for (const annexe of annexes) {
        await dbRun(`
          INSERT INTO archive_annexes (archive_id, file_path, original_filename, file_type, file_size)
          VALUES (?, ?, ?, ?, ?)
        `, [
          archiveId,
          annexe.file_path,
          annexe.original_filename,
          annexe.file_type,
          annexe.file_size
        ]);
      }
    }

    // 7) Mise à jour du courrier original
    if (deleteOriginal) {
      await dbRun(`
        UPDATE incoming_mails
        SET statut_global = 'Archivé',
            date_archivage = datetime('now'),
            numero_archivage_general = COALESCE(numero_archivage_general, ?),
            comment = COALESCE(?, comment)
        WHERE id = ?
      `, [archiveReference, comment || null, mailId]);
    } else {
      await dbRun(`
        UPDATE incoming_mails
        SET date_archivage = COALESCE(date_archivage, datetime('now')),
            numero_archivage_general = COALESCE(numero_archivage_general, ?)
        WHERE id = ?
      `, [archiveReference, mailId]);
    }

    // 8) Historique
    const historyDetails = JSON.stringify({
      archive_id: archiveId,
      archive_reference: archiveReference,
      sender_archived: senderToArchive || mail.sender,
      original_sender: mail.sender,
      archive_date: archiveDate
    });

    await recordHistory(mailId, 'Archivage du courrier', userId, userName, historyDetails, req);

    // 9) Notification
    notifyMailStatusChange(mailId, 'Archivé', null, {
      sender: senderToArchive || mail.sender,
      classeur: classeur || mail.classeur
    }).catch(err => console.error('Erreur notification archivage:', err));

    return { archiveId, archiveReference, sender: senderToArchive || mail.sender };
  } catch (error) {
    console.error('Erreur archiveIncomingMail:', error);
    throw error;
  }
}

// Routes finances settings/validation/closures/audit déplacées vers financeSettingsRoutes



// Routes functions/courriers reference/dossiers déplacées vers dossiersRoutes


// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  
  // Gestion spécifique des erreurs Multer
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: "Fichier trop volumineux. La taille maximale autorisée est de 20 Mo par fichier." 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ 
        error: "Trop de fichiers. Maximum 10 fichiers autorisés." 
      });
    }
    return res.status(400).json({ error: err.message });
  }
  
  // Utiliser le status code de l'erreur si défini (401, 403, 404, etc.)
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Une erreur inattendue est survenue.';
  
  res.status(statusCode).json({ error: message });
});

// ==================== SYSTÈME D'ALERTES ====================

// Fonction pour vérifier les courriers en retard
async function checkOverdueMails() {
  const today = moment().format('YYYY-MM-DD');

  const queryWithStatutGlobal = `SELECT id, subject, sender, response_due, assigned_to, statut_global as sg FROM incoming_mails WHERE response_due IS NOT NULL AND response_due < ? AND statut_global NOT IN ('Archivé','Rejeté')`;
  const queryWithStatus = `SELECT id, subject, sender, response_due, assigned_to, status as sg FROM incoming_mails WHERE response_due IS NOT NULL AND response_due < ? AND status NOT IN ('Archivé','Rejeté')`;

  const processRows = (overdueMails) => {
    if (overdueMails && overdueMails.length > 0) {
      console.log(`⚠️ ${overdueMails.length} courrier(s) en retard détecté(s)`);
      overdueMails.forEach(mail => {
        const daysOverdue = moment().diff(moment(mail.response_due), 'days');
        // Notifier l'utilisateur assigné
        if (mail.assigned_to) {
          db.get('SELECT id FROM users WHERE username = ?', [mail.assigned_to], (userErr, user) => {
            if (!userErr && user) {
              createNotification(
                user.id,
                'alerte_retard',
                '⚠️ Courrier en retard',
                `Le courrier "${mail.subject}" de ${mail.sender} est en retard de ${daysOverdue} jour(s). Date limite: ${moment(mail.response_due).format('DD/MM/YYYY')}`,
                mail.id
              ).catch(err => console.error('Erreur création alerte:', err));
            }
          });
        }
        // Notifier les admins (role_id = 1 pour admin)
        db.all('SELECT id FROM users WHERE role_id = ?', [1], (adminErr, admins) => {
          if (!adminErr && admins) {
            admins.forEach(admin => {
              createNotification(
                admin.id,
                'alerte_retard',
                '⚠️ Courrier en retard',
                `Le courrier "${mail.subject}" assigné à ${mail.assigned_to || 'Non assigné'} est en retard de ${daysOverdue} jour(s).`,
                mail.id
              ).catch(err => console.error('Erreur création alerte admin:', err));
            });
          }
        });
      });
    }
  };

  db.all(queryWithStatutGlobal, [today], (err, rows) => {
    if (err) {
      if (/no such column: statut_global/i.test(err.message)) {
        // Fallback si la colonne est nommée 'status'
        db.all(queryWithStatus, [today], (err2, rows2) => {
          if (err2) {
            console.error('Erreur vérification courriers en retard (fallback):', err2.message);
            return;
          }
          processRows(rows2);
        });
      } else {
        console.error('Erreur vérification courriers en retard:', err.message);
      }
      return;
    }
    processRows(rows);
  });
}

// Vérifier les courriers en retard toutes les heures
// ✅ Déplacé dans jobs/schedulers.js

// Vérifier au démarrage du serveur
// ✅ Déplacé dans jobs/schedulers.js

console.log('Reached end of file');

