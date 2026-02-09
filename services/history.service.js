function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function listMailHistory({ db }) {
  return dbAll(db, 'SELECT * FROM mail_history ORDER BY timestamp DESC');
}

module.exports = {
  listMailHistory,
};
