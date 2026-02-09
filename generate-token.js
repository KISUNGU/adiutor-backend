const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET_KEY;

if (typeof SECRET_KEY !== 'string' || !SECRET_KEY.trim()) {
  throw new Error('Missing required env var: JWT_SECRET_KEY');
}

// Générer un token pour l'admin (id=1)
const token = jwt.sign(
  { 
    id: 1, 
    username: 'admin', 
    role_id: 1 
  },
  SECRET_KEY,
  { expiresIn: '24h' }
);

console.log('\n🔑 Token JWT généré (valide 24h):\n');
console.log(token);
console.log('\n📋 Copiez ce token dans localStorage sous la clé "token"\n');
