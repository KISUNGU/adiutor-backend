#!/usr/bin/env node
const http = require('http');

function doRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('🔐 Login admin...');
  const loginResp = await doRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@mail.com', password: 'adminpassword' });

  const token = loginResp.token;
  console.log('✅ Token obtenu:', token.substring(0, 20) + '...');

  console.log('\n🚀 Exécution du traitement pour mail id=1...');
  const execResp = await doRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/mails/incoming/1/treatment-action',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { action: 'execute', comment: 'Test execution automatique' });

  console.log('✅ Réponse:', JSON.stringify(execResp, null, 2));
})().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
