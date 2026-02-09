const axios = require('axios');
const token = process.argv[2] || '';
(async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/archives', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Body:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  }
})();
