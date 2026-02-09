const axios = require('axios');
const token = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGVfaWQiOjEsImlhdCI6MTc2NDYwNzk0OSwiZXhwIjoxNzY0Njk0MzQ5fQ.wNNt6_BrpIC8CID4yNRfoBSQFO4T9jzeemxVl4FtGtw';
(async () => {
  try {
    const res = await axios.get('http://localhost:4000/api/archives', { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
    console.log('COUNT', res.data && res.data.length);
    console.log(res.data.slice(-3));
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
