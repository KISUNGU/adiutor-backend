// ✒️ Module Signature Ed25519 (Phase 3)
// Génère ou charge une paire de clés, signe le hash d'un fichier
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, '..', 'keys');
const PRIV_PATH = path.join(KEYS_DIR, 'ed25519-private.pem');
const PUB_PATH = path.join(KEYS_DIR, 'ed25519-public.pem');

function ensureKeys() {
  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });
  if (!fs.existsSync(PRIV_PATH) || !fs.existsSync(PUB_PATH)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(PRIV_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    fs.writeFileSync(PUB_PATH, publicKey.export({ type: 'spki', format: 'pem' }));
    console.log('✅ Clés Ed25519 générées');
  }
}

function loadKeys() {
  ensureKeys();
  const privateKeyPem = fs.readFileSync(PRIV_PATH, 'utf8');
  const publicKeyPem = fs.readFileSync(PUB_PATH, 'utf8');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(publicKeyPem);
  return { privateKey, publicKey, publicKeyPem };
}

function signData(data) {
  const { privateKey } = loadKeys();
  const signature = crypto.sign(null, Buffer.from(data), privateKey); // Ed25519 ignore algo param
  return signature.toString('hex');
}

function verifySignature(data, signatureHex) {
  const { publicKey } = loadKeys();
  const signature = Buffer.from(signatureHex, 'hex');
  return crypto.verify(null, Buffer.from(data), publicKey, signature);
}

module.exports = {
  signData,
  verifySignature
};
