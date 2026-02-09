// 📝 Winston Logger Configuré (Phase 4)
// Logging structuré avec rotation et niveaux
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Format custom pour logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format console (colorisé)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Transport: Rotation quotidienne (fichiers)
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../logs/application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m', // 20MB par fichier
  maxFiles: '14d', // Garder 14 jours
  format: customFormat,
  level: 'info'
});

// Transport: Erreurs séparées
const errorFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../logs/error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d', // Garder erreurs 30 jours
  format: customFormat,
  level: 'error'
});

// Transport: Événements sécurité
const securityFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../logs/security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d', // Garder logs sécurité 90 jours
  format: customFormat,
  level: 'warn'
});

// Créer logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'adiutorai-api' },
  transports: [
    fileRotateTransport,
    errorFileTransport,
    securityFileTransport
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/exceptions.log') 
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/rejections.log') 
    })
  ]
});

// Ajouter console en développement
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 🔒 Fonctions utilitaires pour logging sécurité

logger.security = (event, details) => {
  logger.warn('SECURITY_EVENT', {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.auth = (action, user, success, details = {}) => {
  logger.info('AUTH', {
    action,
    user: user?.username || user?.email || 'unknown',
    userId: user?.id,
    success,
    ...details
  });
};

logger.encryption = (operation, filename, success, details = {}) => {
  logger.info('ENCRYPTION', {
    operation, // 'encrypt', 'decrypt'
    filename,
    success,
    ...details
  });
};

logger.signature = (operation, objectName, success, details = {}) => {
  logger.info('SIGNATURE', {
    operation, // 'sign', 'verify'
    objectName,
    success,
    ...details
  });
};

logger.timestamp = (operation, hash, success, details = {}) => {
  logger.info('TIMESTAMP', {
    operation, // 'create', 'verify'
    hash,
    success,
    ...details
  });
};

logger.minio = (operation, bucket, objectName, details = {}) => {
  logger.info('MINIO', {
    operation, // 'upload', 'archive', 'verify'
    bucket,
    objectName,
    ...details
  });
};

logger.audit = (action, user, resource, details = {}) => {
  logger.info('AUDIT', {
    action,
    user: user?.username || user?.email,
    userId: user?.id,
    resource,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// 📊 Stream pour Morgan (HTTP access logs)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
