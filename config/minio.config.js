// 🔒 Configuration MinIO (Stockage WORM - Write Once Read Many)
const Minio = require('minio');

const MINIO_ENABLED = String(process.env.MINIO_ENABLED || '').toLowerCase() === 'true'

// Configuration du client MinIO
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

// Nom du bucket principal (avec politique WORM)
const BUCKET_NAME = process.env.MINIO_BUCKET || 'adiutorai-documents';
const WORM_BUCKET = process.env.MINIO_WORM_BUCKET || 'adiutorai-archives';

/**
 * 🔒 Initialise les buckets MinIO avec politique WORM
 */
async function initializeMinIO() {
  try {
    // Vérifier/créer le bucket principal
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✅ Bucket MinIO créé: ${BUCKET_NAME}`);
    } else {
      console.log(`ℹ️ Bucket MinIO existant: ${BUCKET_NAME}`);
    }

    // Vérifier/créer le bucket WORM (archives immuables)
    const wormExists = await minioClient.bucketExists(WORM_BUCKET);
    if (!wormExists) {
      await minioClient.makeBucket(WORM_BUCKET, 'us-east-1');
      console.log(`✅ Bucket WORM créé: ${WORM_BUCKET}`);
      
      // 🔒 Appliquer politique de rétention (WORM)
      // Note: Nécessite MinIO en mode "governance" ou "compliance"
      // Pour l'instant, on utilise versioning + lifecycle policy
      await minioClient.setBucketVersioning(WORM_BUCKET, { Status: 'Enabled' });
      console.log(`🔒 Versioning activé sur ${WORM_BUCKET} (simulation WORM)`);
    } else {
      console.log(`ℹ️ Bucket WORM existant: ${WORM_BUCKET}`);
    }

    // Définir une politique d'accès publique en lecture pour le bucket principal (optionnel)
    // Pour les archives, on garde privé
    const publicPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
        }
      ]
    };

    // Appliquer seulement si MINIO_PUBLIC=true
    if (process.env.MINIO_PUBLIC_BUCKET === 'true') {
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(publicPolicy));
      console.log(`🌐 Bucket ${BUCKET_NAME} configuré en accès public (lecture)`);
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur initialisation MinIO:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.warn('⚠️ MinIO non accessible. Fonctionnement en mode fichiers local.');
      return false;
    }
    throw error;
  }
}

/**
 * 🔒 Upload un fichier vers MinIO avec calcul de hash
 * @param {string} filePath - Chemin local du fichier
 * @param {string} objectName - Nom de l'objet dans MinIO
 * @param {string} bucketName - Bucket cible (par défaut: BUCKET_NAME)
 * @param {object} metadata - Métadonnées additionnelles
 * @returns {Promise<{etag: string, versionId: string}>}
 */
async function uploadToMinIO(filePath, objectName, bucketName = BUCKET_NAME, metadata = {}) {
  const crypto = require('crypto');
  const fs = require('fs');

  // Calculer le hash SHA-256 avant upload
  const fileHash = await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

  // Enrichir les métadonnées
  const enrichedMetadata = {
    ...metadata,
    'x-amz-meta-sha256': fileHash,
    'x-amz-meta-upload-date': new Date().toISOString(),
    'x-amz-meta-original-path': filePath
  };

  // Upload vers MinIO
  const result = await minioClient.fPutObject(bucketName, objectName, filePath, enrichedMetadata);
  
  console.log(`✅ Fichier uploadé vers MinIO: ${bucketName}/${objectName} (hash: ${fileHash.substring(0, 16)}...)`);
  
  return {
    etag: result.etag,
    versionId: result.versionId || null,
    fileHash,
    bucketName,
    objectName
  };
}

/**
 * 🔒 Archive un fichier vers le bucket WORM (immuable)
 */
async function archiveToWORM(filePath, objectName, metadata = {}) {
  return uploadToMinIO(filePath, objectName, WORM_BUCKET, {
    ...metadata,
    'x-amz-meta-worm': 'true',
    'x-amz-meta-archived-at': new Date().toISOString()
  });
}

/**
 * Récupère une URL pré-signée pour accès temporaire
 * @param {string} objectName - Nom de l'objet
 * @param {number} expirySeconds - Durée de validité (défaut: 1 heure)
 * @param {string} bucketName - Bucket source
 */
async function getPresignedUrl(objectName, expirySeconds = 3600, bucketName = BUCKET_NAME) {
  return await minioClient.presignedGetObject(bucketName, objectName, expirySeconds);
}

/**
 * Vérifie l'intégrité d'un fichier dans MinIO
 */
async function verifyIntegrity(objectName, expectedHash, bucketName = BUCKET_NAME) {
  try {
    const stat = await minioClient.statObject(bucketName, objectName);
    const storedHash = stat.metaData['x-amz-meta-sha256'];
    
    if (!storedHash) {
      return { valid: false, error: 'Hash non disponible dans les métadonnées' };
    }
    
    const isValid = storedHash === expectedHash;
    return {
      valid: isValid,
      storedHash,
      expectedHash,
      etag: stat.etag,
      versionId: stat.versionId
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Liste les objets d'un bucket
 */
async function listObjects(bucketName = BUCKET_NAME, prefix = '') {
  return new Promise((resolve, reject) => {
    const objects = [];
    const stream = minioClient.listObjects(bucketName, prefix, true);
    
    stream.on('data', obj => objects.push(obj));
    stream.on('end', () => resolve(objects));
    stream.on('error', reject);
  });
}

module.exports = {
  MINIO_ENABLED,
  minioClient,
  BUCKET_NAME,
  WORM_BUCKET,
  initializeMinIO,
  uploadToMinIO,
  archiveToWORM,
  getPresignedUrl,
  verifyIntegrity,
  listObjects
};
