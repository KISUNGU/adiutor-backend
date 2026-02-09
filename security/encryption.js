// 🔐 Module de chiffrement AES-256-GCM pour fichiers
// Utilisé pour chiffrer avant upload MinIO (Phase 3)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MASTER_KEY_B64 = process.env.ENCRYPTION_MASTER_KEY;

if (typeof MASTER_KEY_B64 !== 'string' || !MASTER_KEY_B64.trim()) {
  throw new Error('Missing required env var: ENCRYPTION_MASTER_KEY')
}

// P0: we expect a stable 32-byte master key encoded in base64.
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
const MASTER_KEY_BYTES = Buffer.from(MASTER_KEY_B64.trim(), 'base64')
if (MASTER_KEY_BYTES.length !== 32) {
  throw new Error('ENCRYPTION_MASTER_KEY must be base64 for exactly 32 bytes')
}

function deriveKey(salt) {
  return crypto.pbkdf2Sync(MASTER_KEY_BYTES, salt, 150000, 32, 'sha512');
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function encryptFile(inputPath, outputPath) {
  const salt = crypto.randomBytes(16); // 128-bit salt
  const iv = crypto.randomBytes(12); // 96-bit IV recommandé pour GCM
  const key = deriveKey(salt);

  const data = fs.readFileSync(inputPath);
  const originalHash = crypto.createHash('sha256').update(data).digest('hex');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  fs.writeFileSync(outputPath, encrypted);
  const encryptedHash = crypto.createHash('sha256').update(encrypted).digest('hex');

  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    originalHash,
    encryptedHash,
    algo: 'AES-256-GCM'
  };
}

async function decryptFile(encryptedPath, outputPath, saltHex, ivHex, tagHex) {
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = deriveKey(salt);

  const encrypted = fs.readFileSync(encryptedPath);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  fs.writeFileSync(outputPath, decrypted);
  return {
    decryptedHash: crypto.createHash('sha256').update(decrypted).digest('hex')
  };
}

module.exports = {
  encryptFile,
  decryptFile,
  hashFile
};
