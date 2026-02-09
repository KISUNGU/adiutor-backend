const express = require('express');

module.exports = function storageRoutes({
  authenticateToken,
  authorizeRoles,
  upload,
  minioConfig,
  fs,
  fsPromises,
  path,
  crypto,
  baseDir,
  resolveAlertsByType,
  upsertAlertByType,
}) {
  const router = express.Router();
  const fsLib = fs || require('fs');
  const fsPromisesLib = fsPromises || require('fs').promises;
  const pathLib = path || require('path');
  const cryptoLib = crypto || require('crypto');
  const basePath = baseDir || process.cwd();

  if (minioConfig) {
    router.post('/storage/upload', authenticateToken, upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        const filePath = req.file.path;
        const objectName = `${Date.now()}-${req.file.originalname}`;

        const result = await minioConfig.uploadToMinIO(filePath, objectName);

        res.json({
          message: 'Fichier uploadé vers MinIO avec succès',
          objectName,
          bucket: result.bucketName,
          hash: result.fileHash,
          etag: result.etag,
        });
      } catch (error) {
        console.error('Erreur upload MinIO:', error);
        res.status(500).json({ error: 'Erreur upload MinIO', details: error.message });
      }
    });

    router.post('/storage/archive', authenticateToken, authorizeRoles(['admin', 'archiviste']), upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        const filePath = req.file.path;
        const objectName = `archive-${Date.now()}-${req.file.originalname}`;

        const result = await minioConfig.archiveToWORM(filePath, objectName, {
          'x-amz-meta-archived-by': req.user.username || req.user.email,
          'x-amz-meta-mail-id': req.body.mail_id || 'unknown',
        });

        res.json({
          message: 'Document archivé en mode WORM (immuable)',
          objectName,
          bucket: result.bucketName,
          hash: result.fileHash,
          etag: result.etag,
          warning: 'Ce fichier ne peut plus être modifié ni supprimé',
        });
      } catch (error) {
        console.error('Erreur archivage WORM:', error);
        res.status(500).json({ error: 'Erreur archivage WORM', details: error.message });
      }
    });

    router.post('/storage/verify', authenticateToken, async (req, res) => {
      try {
        const { objectName, expectedHash, bucket } = req.body;

        if (!objectName || !expectedHash) {
          return res.status(400).json({ error: 'objectName et expectedHash requis' });
        }

        const result = await minioConfig.verifyIntegrity(objectName, expectedHash, bucket);

        res.json(result);
      } catch (error) {
        console.error('Erreur vérification intégrité:', error);
        res.status(500).json({ error: 'Erreur vérification', details: error.message });
      }
    });

    router.get('/storage/list', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
      try {
        const bucket = req.query.bucket || minioConfig.BUCKET_NAME;
        const prefix = req.query.prefix || '';

        const objects = await minioConfig.listObjects(bucket, prefix);

        res.json({
          bucket,
          count: objects.length,
          objects: objects.map(obj => ({
            name: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
          })),
        });
      } catch (error) {
        console.error('Erreur liste objets MinIO:', error);
        res.status(500).json({ error: 'Erreur liste objets', details: error?.message || String(error), mode: 'minio' });
      }
    });

    router.post('/storage/presigned-url', authenticateToken, async (req, res) => {
      try {
        const { objectName, expirySeconds, bucket } = req.body;

        if (!objectName) {
          return res.status(400).json({ error: 'objectName requis' });
        }

        const hostBase = `${req.protocol}://${req.get('host')}`;
        const uploadsRoot = pathLib.resolve(basePath, 'uploads');

        const tryBuildLocalUploadsUrl = (value) => {
          if (!value || typeof value !== 'string') return null;
          const normalized = value.replace(/\\/g, '/');

          if (normalized.startsWith('uploads/')) {
            const rel = normalized.slice('uploads/'.length);
            const candidate = pathLib.resolve(uploadsRoot, rel);
            if (candidate.startsWith(uploadsRoot)) {
              const urlPath = rel.split(pathLib.sep).join('/');
              const exists = fsLib.existsSync(candidate);
              return { url: `${hostBase}/uploads/${encodeURI(urlPath)}`, exists };
            }
          }

          const idx = normalized.toLowerCase().lastIndexOf('/uploads/');
          if (idx !== -1) {
            const rel = normalized.slice(idx + '/uploads/'.length);
            const candidate = pathLib.resolve(uploadsRoot, rel);
            if (candidate.startsWith(uploadsRoot)) {
              const urlPath = rel.split(pathLib.sep).join('/');
              const exists = fsLib.existsSync(candidate);
              return { url: `${hostBase}/uploads/${encodeURI(urlPath)}`, exists };
            }
          }

          return null;
        };

        const local = tryBuildLocalUploadsUrl(objectName);
        if (local?.url) {
          return res.json({ url: local.url, expiresIn: expirySeconds || 3600, mode: 'local', exists: local.exists });
        }

        try {
          const normalized = String(objectName || '').replace(/\\/g, '/').toLowerCase();
          if (normalized.startsWith('uploads/') || normalized.includes('/uploads/')) {
            return res.status(404).json({ error: 'Chemin uploads non résolu', objectName });
          }
        } catch (_) {
          // ignore
        }

        const url = await minioConfig.getPresignedUrl(
          objectName,
          expirySeconds || 3600,
          bucket
        );

        res.json({ url, expiresIn: expirySeconds || 3600, mode: 'minio' });
      } catch (error) {
        console.error('Erreur génération URL pré-signée:', error);

        try {
          const { objectName, expirySeconds } = req.body || {};
          const hostBase = `${req.protocol}://${req.get('host')}`;
          const uploadsRoot = pathLib.resolve(basePath, 'uploads');
          if (typeof objectName === 'string') {
            const normalized = objectName.replace(/\\/g, '/');
            const idx = normalized.toLowerCase().lastIndexOf('/uploads/');
            const rel = normalized.startsWith('uploads/') ? normalized.slice('uploads/'.length)
              : (idx !== -1 ? normalized.slice(idx + '/uploads/'.length) : null);
            if (rel) {
              const candidate = pathLib.resolve(uploadsRoot, rel);
              if (candidate.startsWith(uploadsRoot) && fsLib.existsSync(candidate)) {
                const urlPath = rel.split(pathLib.sep).join('/');
                return res.json({ url: `${hostBase}/uploads/${encodeURI(urlPath)}`, expiresIn: expirySeconds || 3600, mode: 'local' });
              }
            }
          }
        } catch (_) {
          // ignore fallback errors
        }

        res.status(500).json({ error: 'Erreur URL', details: error.message });
      }
    });

    router.post('/storage/upload-encrypted', authenticateToken, upload.single('file'), async (req, res) => {
      try {
        const { encryptFile } = require('../security/encryption');
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
        const filePath = req.file.path;
        const encryptedPath = filePath + '.enc';
        const meta = await encryptFile(filePath, encryptedPath);
        const objectName = `enc-${Date.now()}-${req.file.originalname}`;
        const uploadResult = await minioConfig.uploadToMinIO(encryptedPath, objectName, minioConfig.BUCKET_NAME, {
          'x-amz-meta-encrypted': 'true',
          'x-amz-meta-algo': meta.algo,
          'x-amz-meta-salt': meta.salt,
          'x-amz-meta-iv': meta.iv,
          'x-amz-meta-tag': meta.tag,
          'x-amz-meta-original-hash': meta.originalHash,
          'x-amz-meta-encrypted-hash': meta.encryptedHash,
        });
        res.json({
          message: 'Fichier chiffré et uploadé',
          objectName,
          bucket: uploadResult.bucketName,
          originalHash: meta.originalHash,
          encryptedHash: meta.encryptedHash,
          etag: uploadResult.etag,
        });
      } catch (e) {
        console.error('Erreur upload chiffré:', e);
        res.status(500).json({ error: 'Erreur upload chiffré', details: e.message });
      }
    });

    router.post('/storage/archive-encrypted', authenticateToken, authorizeRoles(['admin', 'archiviste']), upload.single('file'), async (req, res) => {
      try {
        const { encryptFile } = require('../security/encryption');
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
        const filePath = req.file.path;
        const encryptedPath = filePath + '.enc';
        const meta = await encryptFile(filePath, encryptedPath);
        const objectName = `archive-enc-${Date.now()}-${req.file.originalname}`;
        const uploadResult = await minioConfig.archiveToWORM(encryptedPath, objectName, {
          'x-amz-meta-encrypted': 'true',
          'x-amz-meta-algo': meta.algo,
          'x-amz-meta-salt': meta.salt,
          'x-amz-meta-iv': meta.iv,
          'x-amz-meta-tag': meta.tag,
          'x-amz-meta-original-hash': meta.originalHash,
          'x-amz-meta-encrypted-hash': meta.encryptedHash,
        });
        res.json({
          message: 'Document archivé chiffré (WORM)',
          objectName,
          bucket: uploadResult.bucketName,
          originalHash: meta.originalHash,
          encryptedHash: meta.encryptedHash,
          etag: uploadResult.etag,
          warning: 'Immuable et chiffré',
        });
      } catch (e) {
        console.error('Erreur archivage chiffré:', e);
        res.status(500).json({ error: 'Erreur archivage chiffré', details: e.message });
      }
    });

    router.post('/storage/sign', authenticateToken, authorizeRoles(['admin', 'archiviste']), async (req, res) => {
      try {
        const { objectName, bucket } = req.body;
        if (!objectName) return res.status(400).json({ error: 'objectName requis' });
        const stat = await minioConfig.minioClient.statObject(bucket || minioConfig.BUCKET_NAME, objectName);
        const originalHash = stat.metaData['x-amz-meta-original-hash'] || stat.metaData['x-amz-meta-sha256'];
        if (!originalHash) return res.status(400).json({ error: 'Hash original introuvable dans métadonnées' });
        const { signData } = require('../security/signature');
        const signature = signData(originalHash);
        const sigObjectName = objectName + '.sig';
        const tmpPath = pathLib.join(require('os').tmpdir(), sigObjectName);
        fsLib.writeFileSync(tmpPath, JSON.stringify({ signature, hash: originalHash, signedAt: new Date().toISOString() }));
        await minioConfig.uploadToMinIO(tmpPath, sigObjectName, bucket || minioConfig.BUCKET_NAME, {
          'x-amz-meta-related-object': objectName,
          'x-amz-meta-signature': signature,
          'x-amz-meta-signed-at': new Date().toISOString(),
        });
        res.json({ message: 'Objet signé', objectName, signatureObject: sigObjectName, signature });
      } catch (e) {
        console.error('Erreur signature objet:', e);
        res.status(500).json({ error: 'Erreur signature', details: e.message });
      }
    });

    router.post('/storage/verify-signature', authenticateToken, async (req, res) => {
      try {
        const { objectName, bucket } = req.body;
        if (!objectName) return res.status(400).json({ error: 'objectName requis' });
        const sigObjectName = objectName + '.sig';
        const sigStream = await minioConfig.minioClient.getObject(bucket || minioConfig.BUCKET_NAME, sigObjectName);
        let data = '';
        await new Promise((resolve, reject) => {
          sigStream.on('data', chunk => { data += chunk.toString(); });
          sigStream.on('end', resolve);
          sigStream.on('error', reject);
        });
        const parsed = JSON.parse(data);
        const stat = await minioConfig.minioClient.statObject(bucket || minioConfig.BUCKET_NAME, objectName);
        const originalHash = stat.metaData['x-amz-meta-original-hash'] || stat.metaData['x-amz-meta-sha256'];
        const { verifySignature } = require('../security/signature');
        const valid = verifySignature(originalHash, parsed.signature);
        res.json({ valid, signature: parsed.signature, hashMatched: originalHash === parsed.hash, signedAt: parsed.signedAt });
      } catch (e) {
        console.error('Erreur vérification signature:', e);
        res.status(500).json({ error: 'Erreur vérification signature', details: e.message });
      }
    });

    router.post('/storage/decrypt', authenticateToken, async (req, res) => {
      try {
        const { objectName, bucket } = req.body;
        if (!objectName) return res.status(400).json({ error: 'objectName requis' });
        const stat = await minioConfig.minioClient.statObject(bucket || minioConfig.BUCKET_NAME, objectName);
        if (stat.metaData['x-amz-meta-encrypted'] !== 'true') return res.status(400).json({ error: 'Objet non chiffré' });
        const salt = stat.metaData['x-amz-meta-salt'];
        const iv = stat.metaData['x-amz-meta-iv'];
        const tag = stat.metaData['x-amz-meta-tag'];
        const tmpEnc = pathLib.join(require('os').tmpdir(), objectName);
        const writeStream = fsLib.createWriteStream(tmpEnc);
        const readStream = await minioConfig.minioClient.getObject(bucket || minioConfig.BUCKET_NAME, objectName);
        await new Promise((resolve, reject) => {
          readStream.pipe(writeStream);
          readStream.on('error', reject);
          writeStream.on('finish', resolve);
        });
        const tmpDec = tmpEnc + '.dec';
        const { decryptFile } = require('../security/encryption');
        await decryptFile(tmpEnc, tmpDec, salt, iv, tag);
        res.download(tmpDec, objectName.replace(/^enc-|archive-enc-/, ''), err => {
          if (err) console.error('Erreur download déchiffré:', err);
        });
      } catch (e) {
        console.error('Erreur déchiffrement:', e);
        res.status(500).json({ error: 'Erreur déchiffrement', details: e.message });
      }
    });

    minioConfig
      .initializeMinIO()
      .then(() => {
        resolveAlertsByType('MINIO_UNAVAILABLE').catch(() => {});
      })
      .catch(err => {
        console.warn('⚠️ MinIO non disponible:', err.message);
        upsertAlertByType({
          type: 'MINIO_UNAVAILABLE',
          title: 'MinIO indisponible',
          message: `MinIO est configuré mais non accessible. Le système fonctionne en mode fichiers local. Détail: ${err?.message || 'Erreur inconnue'}`,
          severity: 'medium',
          meta: { error: err?.message || null },
        }).catch(() => {});
      });
  } else {
    const uploadsRoot = pathLib.resolve(basePath, 'uploads');

    const ensureUploadsDir = async () => {
      try {
        await fsPromisesLib.mkdir(uploadsRoot, { recursive: true });
      } catch (_) {
        // ignore
      }
    };

    const sha256File = async (absPath) =>
      new Promise((resolve, reject) => {
        const hash = cryptoLib.createHash('sha256');
        const stream = fsLib.createReadStream(absPath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });

    const resolveLocalUploadsPath = (value) => {
      if (!value || typeof value !== 'string') return null;
      const normalized = value.replace(/\\/g, '/');

      const rel = normalized.startsWith('/uploads/')
        ? normalized.slice('/uploads/'.length)
        : normalized.startsWith('uploads/')
          ? normalized.slice('uploads/'.length)
          : null;

      if (!rel) return null;
      const candidate = pathLib.resolve(uploadsRoot, rel);
      if (!candidate.startsWith(uploadsRoot)) return null;
      return { candidate, rel };
    };

    router.post('/storage/upload', authenticateToken, upload.single('file'), async (req, res) => {
      try {
        await ensureUploadsDir();
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

        const fileHash = await sha256File(req.file.path);
        const objectName = `/uploads/${req.file.filename}`;

        res.json({
          message: 'Fichier uploadé (mode local)',
          objectName,
          bucket: 'local',
          hash: fileHash,
          etag: null,
          mode: 'local',
        });
      } catch (e) {
        console.error('Erreur upload local:', e);
        res.status(500).json({ error: 'Erreur upload local', details: e.message });
      }
    });

    router.post('/storage/archive', authenticateToken, authorizeRoles(['admin', 'archiviste']), upload.single('file'), async (req, res) => {
      try {
        await ensureUploadsDir();
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

        const archivesDir = pathLib.resolve(uploadsRoot, 'archives');
        await fsPromisesLib.mkdir(archivesDir, { recursive: true });
        const destAbs = pathLib.resolve(archivesDir, req.file.filename);
        await fsPromisesLib.rename(req.file.path, destAbs);

        const fileHash = await sha256File(destAbs);
        const objectName = `/uploads/archives/${req.file.filename}`;

        res.json({
          message: 'Document archivé (mode local)',
          objectName,
          bucket: 'local',
          hash: fileHash,
          etag: null,
          mode: 'local',
          warning: 'Mode local: pas de WORM (immutabilité) garantie',
        });
      } catch (e) {
        console.error('Erreur archivage local:', e);
        res.status(500).json({ error: 'Erreur archivage local', details: e.message });
      }
    });

    router.post('/storage/verify', authenticateToken, async (req, res) => {
      try {
        const { objectName, expectedHash } = req.body || {};
        if (!objectName || !expectedHash) {
          return res.status(400).json({ error: 'objectName et expectedHash requis' });
        }

        const resolved = resolveLocalUploadsPath(objectName);
        if (!resolved) return res.status(400).json({ error: 'Chemin non supporté en mode local', objectName });
        if (!fsLib.existsSync(resolved.candidate)) return res.status(404).json({ error: 'Fichier introuvable', objectName });

        const actualHash = await sha256File(resolved.candidate);
        res.json({ valid: actualHash === expectedHash, storedHash: actualHash, expectedHash, mode: 'local' });
      } catch (e) {
        console.error('Erreur vérification intégrité local:', e);
        res.status(500).json({ error: 'Erreur vérification', details: e.message });
      }
    });

    router.get('/storage/list', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
      try {
        await ensureUploadsDir();
        const items = await fsPromisesLib.readdir(uploadsRoot, { withFileTypes: true });
        const objects = items
          .filter((d) => d.isFile())
          .map((d) => ({ name: d.name }));
        res.json({ bucket: 'local', count: objects.length, objects, mode: 'local' });
      } catch (e) {
        console.error('Erreur liste objets local:', e);
        res.status(500).json({ error: 'Erreur liste objets', details: e?.message || String(e), mode: 'local' });
      }
    });

    router.post('/storage/presigned-url', authenticateToken, async (req, res) => {
      try {
        const { objectName, expirySeconds } = req.body || {};
        if (!objectName) return res.status(400).json({ error: 'objectName requis' });

        const hostBase = `${req.protocol}://${req.get('host')}`;
        const normalized = String(objectName).replace(/\\/g, '/');
        if (normalized.startsWith('/uploads/')) {
          return res.json({ url: `${hostBase}${normalized}`, expiresIn: expirySeconds || 3600, mode: 'local' });
        }
        if (normalized.startsWith('uploads/')) {
          return res.json({ url: `${hostBase}/uploads/${encodeURI(normalized.slice('uploads/'.length))}`, expiresIn: expirySeconds || 3600, mode: 'local' });
        }

        const idx = normalized.toLowerCase().lastIndexOf('/uploads/');
        if (idx !== -1) {
          const rel = normalized.slice(idx + '/uploads/'.length);
          return res.json({ url: `${hostBase}/uploads/${encodeURI(rel)}`, expiresIn: expirySeconds || 3600, mode: 'local' });
        }

        return res.status(400).json({ error: 'objectName non supporté en mode local', objectName });
      } catch (e) {
        console.error('Erreur URL local:', e);
        res.status(500).json({ error: 'Erreur URL', details: e.message });
      }
    });

    const minioRequired = (name) => (req, res) =>
      res.status(501).json({ error: `${name} nécessite MinIO (activer MINIO_ENABLED=true)` });

    router.post('/storage/upload-encrypted', authenticateToken, minioRequired('upload-encrypted'));
    router.post('/storage/archive-encrypted', authenticateToken, authorizeRoles(['admin', 'archiviste']), minioRequired('archive-encrypted'));
    router.post('/storage/sign', authenticateToken, authorizeRoles(['admin', 'archiviste']), minioRequired('sign'));
    router.post('/storage/verify-signature', authenticateToken, minioRequired('verify-signature'));
    router.post('/storage/decrypt', authenticateToken, minioRequired('decrypt'));
  }

  return router;
};
