const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

(async () => {
  try {
    // 1) Login
    const loginRes = await axios.post('http://localhost:3000/api/login', {
      email: 'admin@mail.com',
      password: 'adminpassword',
    });
    const token = loginRes.data.token;
    console.log('Login OK');

    // 2) Prepare form data with small PDF
    const pdfPath = path.join(__dirname, '..', 'test', 'data', 'test-acq.pdf');
    if (!fs.existsSync(pdfPath)) {
      throw new Error('test-acq.pdf introuvable, exécutez scripts/generate-test-pdf.js');
    }

    const ref = 'REF-AUTO-' + Date.now();
    const form = new FormData();
    form.append('ref_code', ref);
    form.append('subject', 'Acq Auto Test');
    form.append('sender', 'Robot');
    form.append('recipient', 'DG');
    form.append('mail_date', new Date().toISOString().slice(0, 10));
    form.append('arrival_date', new Date().toISOString().slice(0, 10));
    form.append('classeur', 'PTBA');
    // optional classification/type_courrier if present
    form.append('type_courrier', 'Externe');

    // main file + one annexe (same small PDF to keep simple)
    form.append('files', fs.createReadStream(pdfPath)); // main
    form.append('files', fs.createReadStream(pdfPath)); // annexe

    const res = await axios.post('http://localhost:3000/api/mails/incoming', form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('Réponse acquisition:', res.data);

    // 3) Verify in DB via API fetch of incoming mails (optional)
    const list = await axios.get('http://localhost:3000/api/mails/incoming', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const found = list.data.find((m) => m.ref_code === ref);
    console.log('Courrier trouvé:', found || 'Non trouvé');
  } catch (err) {
    if (err.response) {
      console.error('HTTP', err.response.status, err.response.data);
    } else {
      console.error('Erreur', err.message);
      if (err.code) console.error('Code:', err.code);
      if (err.stack) console.error(err.stack);
    }
    process.exit(1);
  }
})();
