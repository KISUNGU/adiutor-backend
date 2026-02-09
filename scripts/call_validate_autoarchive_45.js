const axios = require('axios');
const token = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGVfaWQiOjEsImlhdCI6MTc2NDYwNzk0OSwiZXhwIjoxNzY0Njk0MzQ5fQ.wNNt6_BrpIC8CID4yNRfoBSQFO4T9jzeemxVl4FtGtw';

(async () => {
  try {
    const res = await axios.put('http://localhost:4000/api/mails/incoming/45/validate', { autoArchive: true }, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
    console.log('RESPONSE', res.data);
  } catch (err) {
    if (err.response) {
      console.error('STATUS', err.response.status);
      console.error('DATA', err.response.data);
    } else {
      console.error('ERROR', err.message);
    }
    process.exit(2);
  }
})();
