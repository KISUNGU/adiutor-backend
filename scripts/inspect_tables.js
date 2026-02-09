const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname,'..','databasepnda.db'));

function all(sql, params=[]) { return new Promise((res, rej) => db.all(sql, params, (e,r)=> e?rej(e):res(r))); }
(async ()=>{
  try{
    console.log('PRAGMA table_info(incoming_mails):');
    const inc = await all("PRAGMA table_info('incoming_mails');");
    console.table(inc.map(c=>({cid:c.cid,name:c.name,type:c.type,notnull:c.notnull,dflt_value:c.dflt_value,pk:c.pk})));

    console.log('PRAGMA table_info(archives):');
    const arc = await all("PRAGMA table_info('archives');");
    console.table(arc.map(c=>({cid:c.cid,name:c.name,type:c.type,notnull:c.notnull,dflt_value:c.dflt_value,pk:c.pk})));

    db.close();
  }catch(e){console.error(e);db.close();process.exit(1);} 
})();
