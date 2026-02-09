const axios = require('axios');

const token = process.env.TEST_TOKEN;
if (!token) {
  console.error('Missing TEST_TOKEN env var');
  process.exit(2);
}

const id = process.env.MAIL_ID || '12';

(async () => {
  try {
    const res = await axios.put(
      `http://localhost:4000/api/mails/incoming/${id}/validate`,
      { comment: 'Validation test', autoArchive: true },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 }
    );
    console.log('STATUS', res.status);
    console.log('DATA', res.data);
  } catch (err) {
    if (err.response) {
      console.error('STATUS', err.response.status);
      console.error('DATA', err.response.data);
    } else {
      console.error('ERROR', err.message);
    }
    process.exit(1);
  }
})();
