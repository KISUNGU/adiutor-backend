// 📊 Monitoring Prometheus (Phase 4)
// Collecte métriques sécurité pour Grafana dashboards
const promClient = require('prom-client');

// Créer registre Prometheus
const register = new promClient.Registry();

// Métriques par défaut (CPU, mémoire, etc.)
promClient.collectDefaultMetrics({ register });

// 📈 Compteurs (Counters) - Valeurs qui ne font qu'augmenter

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total des requêtes HTTP',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

const authAttemptsTotal = new promClient.Counter({
  name: 'auth_attempts_total',
  help: 'Total des tentatives d\'authentification',
  labelNames: ['method', 'status'], // 'jwt', 'oauth' / 'success', 'failure'
  registers: [register]
});

const rateLimitHitsTotal = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Nombre de fois où rate limit a été déclenché',
  labelNames: ['limiter'], // 'global', 'login'
  registers: [register]
});

const fileOperationsTotal = new promClient.Counter({
  name: 'file_operations_total',
  help: 'Total des opérations fichiers',
  labelNames: ['operation', 'status'], // 'upload', 'encrypt', 'sign' / 'success', 'failure'
  registers: [register]
});

const encryptionOperationsTotal = new promClient.Counter({
  name: 'encryption_operations_total',
  help: 'Total des opérations de chiffrement',
  labelNames: ['operation'], // 'encrypt', 'decrypt'
  registers: [register]
});

const signatureOperationsTotal = new promClient.Counter({
  name: 'signature_operations_total',
  help: 'Total des opérations de signature',
  labelNames: ['operation'], // 'sign', 'verify'
  registers: [register]
});

const timestampOperationsTotal = new promClient.Counter({
  name: 'timestamp_operations_total',
  help: 'Total des opérations d\'horodatage',
  labelNames: ['operation', 'status'], // 'create', 'verify' / 'success', 'failure'
  registers: [register]
});

const minioOperationsTotal = new promClient.Counter({
  name: 'minio_operations_total',
  help: 'Total des opérations MinIO',
  labelNames: ['operation', 'bucket'], // 'upload', 'archive', 'verify'
  registers: [register]
});

const securityEventsTotal = new promClient.Counter({
  name: 'security_events_total',
  help: 'Total des événements de sécurité',
  labelNames: ['type', 'severity'], // 'unauthorized_access', 'invalid_signature' / 'low', 'medium', 'high'
  registers: [register]
});

// 📉 Jauges (Gauges) - Valeurs qui peuvent monter/descendre

const activeUsers = new promClient.Gauge({
  name: 'active_users',
  help: 'Nombre d\'utilisateurs actifs (sessions)',
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Connexions HTTP actives',
  registers: [register]
});

const uploadQueueSize = new promClient.Gauge({
  name: 'upload_queue_size',
  help: 'Taille de la file d\'attente uploads',
  registers: [register]
});

// ⏱️ Histogrammes (Histograms) - Distribution des valeurs

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10], // Buckets en secondes
  registers: [register]
});

const encryptionDuration = new promClient.Histogram({
  name: 'encryption_duration_seconds',
  help: 'Durée du chiffrement en secondes',
  labelNames: ['operation'], // 'encrypt', 'decrypt'
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const signatureDuration = new promClient.Histogram({
  name: 'signature_duration_seconds',
  help: 'Durée de signature/vérification en secondes',
  labelNames: ['operation'], // 'sign', 'verify'
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

const timestampDuration = new promClient.Histogram({
  name: 'timestamp_duration_seconds',
  help: 'Durée des opérations timestamp en secondes',
  labelNames: ['operation'],
  buckets: [0.5, 1, 2, 5, 10, 30], // TSA peut prendre du temps
  registers: [register]
});

const fileSizeBytes = new promClient.Histogram({
  name: 'file_size_bytes',
  help: 'Taille des fichiers uploadés en bytes',
  labelNames: ['type'], // 'pdf', 'docx', 'image'
  buckets: [1024, 10240, 102400, 1024000, 10240000, 20971520], // 1KB à 20MB
  registers: [register]
});

// 📊 Résumés (Summaries) - Quantiles de distribution

const apiResponseTime = new promClient.Summary({
  name: 'api_response_time_seconds',
  help: 'Temps de réponse API (quantiles)',
  labelNames: ['endpoint'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register]
});

// 🛠️ Helpers pour mesurer le temps

function startTimer() {
  return process.hrtime.bigint();
}

function endTimer(start) {
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e9; // Convertir en secondes
}

// 🔧 Middleware Express pour tracking automatique

function metricsMiddleware(req, res, next) {
  const start = startTimer();
  
  // Incrémenter compteur connexions actives
  activeConnections.inc();
  
  // Intercepter la fin de la requête
  res.on('finish', () => {
    try {
      const duration = endTimer(start);
      const path = (req.route ? req.route.path : req.path) || 'unknown';
      const method = req.method || 'UNKNOWN';
      const status = res.statusCode || 500;
      
      // Enregistrer durée
      httpRequestDuration.labels(method, path, status).observe(duration);
      
      // Enregistrer requête
      httpRequestsTotal.labels(method, path, status).inc();
      
      // Temps de réponse API
      apiResponseTime.labels(path).observe(duration);
      
      // Décrémenter connexions actives
      activeConnections.dec();
    } catch (error) {
      console.error('Erreur metrics middleware:', error.message);
      // Toujours décrémenter même en cas d'erreur
      try { activeConnections.dec(); } catch (_) {}
    }
  });
  
  next();
}

// 📊 Fonctions utilitaires

function recordAuthAttempt(method, success) {
  authAttemptsTotal.labels(method, success ? 'success' : 'failure').inc();
}

function recordRateLimitHit(limiter) {
  rateLimitHitsTotal.labels(limiter).inc();
}

function recordFileOperation(operation, success) {
  fileOperationsTotal.labels(operation, success ? 'success' : 'failure').inc();
}

function recordEncryption(operation, durationSeconds) {
  encryptionOperationsTotal.labels(operation).inc();
  if (durationSeconds) {
    encryptionDuration.labels(operation).observe(durationSeconds);
  }
}

function recordSignature(operation, durationSeconds) {
  signatureOperationsTotal.labels(operation).inc();
  if (durationSeconds) {
    signatureDuration.labels(operation).observe(durationSeconds);
  }
}

function recordTimestamp(operation, success, durationSeconds) {
  timestampOperationsTotal.labels(operation, success ? 'success' : 'failure').inc();
  if (durationSeconds) {
    timestampDuration.labels(operation).observe(durationSeconds);
  }
}

function recordMinioOperation(operation, bucket) {
  minioOperationsTotal.labels(operation, bucket).inc();
}

function recordSecurityEvent(type, severity) {
  securityEventsTotal.labels(type, severity).inc();
}

function recordFileSize(type, sizeBytes) {
  fileSizeBytes.labels(type).observe(sizeBytes);
}

function setActiveUsers(count) {
  activeUsers.set(count);
}

function setUploadQueueSize(size) {
  uploadQueueSize.set(size);
}

// 📤 Exporter métriques Prometheus

async function getMetrics() {
  return register.metrics();
}

module.exports = {
  register,
  metricsMiddleware,
  startTimer,
  endTimer,
  
  // Fonctions d'enregistrement
  recordAuthAttempt,
  recordRateLimitHit,
  recordFileOperation,
  recordEncryption,
  recordSignature,
  recordTimestamp,
  recordMinioOperation,
  recordSecurityEvent,
  recordFileSize,
  setActiveUsers,
  setUploadQueueSize,
  
  // Export métriques
  getMetrics
};
