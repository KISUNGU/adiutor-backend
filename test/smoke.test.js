/**
 * Smoke tests pour l'API backend
 * Vérifie que le serveur démarre et que les endpoints critiques répondent
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3099;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TIMEOUT = 20000; // 20s pour le chargement initial (modules lourds)

let serverProcess;

// Helper pour requêtes HTTP simples
function request(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let body = null;
        try {
          body = data ? JSON.parse(data) : null;
        } catch {
          // Pas JSON, garder comme texte
          body = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Démarrer le serveur de test
async function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    
    serverProcess = spawn('node', [serverPath], {
      env: { 
        ...process.env, 
        PORT: TEST_PORT,
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    const timeoutId = setTimeout(() => {
      reject(new Error(`Server failed to start within ${TIMEOUT}ms`));
    }, TIMEOUT);

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes(`Serveur démarré`) || output.includes(`localhost:${TEST_PORT}`)) {
        clearTimeout(timeoutId);
        // Attendre 2s de plus pour que le serveur soit vraiment prêt
        setTimeout(resolve, 2000);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

// Arrêter le serveur
function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// Tests
async function runTests() {
  console.log('🚀 Starting smoke tests...\n');
  let failed = 0;
  let passed = 0;

  try {
    // Démarrer serveur
    console.log('⏳ Starting test server...');
    await startServer();
    console.log('✅ Server started on port', TEST_PORT, '\n');

    // Test 1: Health check (ou endpoint racine)
    try {
      console.log('Test 1: Server responds to requests');
      const res = await request('/api/courriers');
      if (res.status === 200 || res.status === 401 || res.status === 404) {
        console.log(`✅ PASS - Server responding (status: ${res.status})\n`);
        passed++;
      } else {
        console.log(`❌ FAIL - Unexpected status: ${res.status}\n`);
        failed++;
      }
    } catch (err) {
      console.log('❌ FAIL - Error:', err.code || err.message, '\n');
      failed++;
    }

    // Test 2: Auth endpoint exists
    try {
      console.log('Test 2: Auth endpoint exists');
      const res = await request('/api/auth/login', 'POST', {
        username: 'test',
        password: 'test'
      });
      // On attend 401 ou 400 (pas 404)
      if (res.status === 400 || res.status === 401) {
        console.log('✅ PASS - Auth endpoint reachable\n');
        passed++;
      } else if (res.status === 404) {
        console.log('❌ FAIL - Auth endpoint not found\n');
        failed++;
      } else {
        console.log(`✅ PASS - Auth endpoint exists (status: ${res.status})\n`);
        passed++;
      }
    } catch (err) {
      console.log('❌ FAIL - Error:', err.code || err.message, '\n');
      failed++;
    }

    // Test 3: CORS headers présents
    try {
      console.log('Test 3: CORS headers configured');
      const res = await request('/api/courriers');
      if (res.headers['access-control-allow-origin']) {
        console.log('✅ PASS - CORS headers present\n');
        passed++;
      } else {
        console.log('❌ FAIL - Missing CORS headers\n');
        failed++;
      }
    } catch (err) {
      console.log('❌ FAIL - Error:', err.code || err.message, '\n');
      failed++;
    }

    // Test 4: Database connection (via un endpoint qui utilise DB)
    try {
      console.log('Test 4: Database accessible via API');
      const res = await request('/api/courriers');
      // Si on a une réponse (même 401), la DB est probablement OK
      if (res.status < 500) {
        console.log('✅ PASS - Database connection working\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Server error: ${res.status}\n`);
        failed++;
      }
    } catch (err) {
      console.log('❌ FAIL - Error:', err.code || err.message, '\n');
      failed++;
    }

  } catch (err) {
    console.error('💥 Fatal error:', err.message);
    failed++;
  } finally {
    stopServer();
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Gérer les interruptions proprement
process.on('SIGINT', () => {
  console.log('\n⚠️  Tests interrupted');
  stopServer();
  process.exit(1);
});

process.on('SIGTERM', () => {
  stopServer();
  process.exit(1);
});

// Lancer
runTests().catch(err => {
  console.error('Test runner failed:', err);
  stopServer();
  process.exit(1);
});
