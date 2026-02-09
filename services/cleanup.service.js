function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

async function deleteById({ db, table, id }) {
  const result = await dbRun(db, `DELETE FROM ${table} WHERE id = ?`, [id]);
  return result.changes;
}

module.exports = {
  deleteById,
};
