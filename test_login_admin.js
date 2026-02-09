const http = require('http');

const postData = JSON.stringify({
  email: 'admin@realcom.cd',
  password: 'admin4321'
});

const options = {
  host: 'localhost',
  port: 4000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔐 Test login admin...\n');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}\n`);

  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      console.log('✅ Réponse JSON:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.token) {
        console.log('\n✅ Login réussi!');
        console.log(`Token: ${response.token.substring(0, 50)}...`);
      } else {
        console.log('\n❌ Pas de token dans la réponse');
      }
    } catch (e) {
      console.log('❌ Réponse non-JSON:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Erreur requête: ${e.message}`);
});

req.write(postData);
req.end();
