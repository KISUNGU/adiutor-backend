const axios = require('axios');
const token = process.argv[2] || '';
if (!token) {
  console.error('Usage: node test_archives_api.js <JWT_TOKEN>');
  process.exit(1);
}
(async ()=>{
  for (const port of [3000,4000]){
    try{
      console.log('\n--- Testing port', port, '---');
      const h = { headers: { Authorization: `Bearer ${token}` } };
      const health = await axios.get(`http://localhost:${port}/api/health`, h).catch(e=>({error: e.message, data: e.response && e.response.data}));
      console.log('health:', health.data || health.error || health);
      const archives = await axios.get(`http://localhost:${port}/api/archives`, h).catch(e=>({error: e.message, data: e.response && e.response.data}));
      if (archives && archives.data) {
        console.log('archives count:', Array.isArray(archives.data) ? archives.data.length : 1);
        console.log('archives sample:', (Array.isArray(archives.data) ? archives.data.slice(0,5) : archives.data));
      } else {
        console.log('archives error:', archives.error, archives.data);
      }
    }catch(e){
      console.error('Error contacting port', port, e.message);
    }
  }
})();
