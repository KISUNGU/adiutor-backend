function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function listEquipments({ db }) {
  return dbAll(db, 'SELECT * FROM equipments');
}

async function listReservations({ db }) {
  return dbAll(db, 'SELECT * FROM reservations');
}

async function listFiles({ db }) {
  const rows = await dbAll(db, 'SELECT filename FROM files');
  return rows.map((row) => row.filename);
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function createEquipment({ db, payload }) {
  const { name, type, status, acquisition_date } = payload || {};
  const result = await dbRun(
    db,
    'INSERT INTO equipments (name, type, status, acquisition_date) VALUES (?, ?, ?, ?)',
    [name, type, status, acquisition_date],
  );
  return result.lastID;
}

async function createReservation({ db, payload }) {
  const { name, destination, date, type } = payload || {};
  const result = await dbRun(
    db,
    'INSERT INTO reservations (name, destination, date, type) VALUES (?, ?, ?, ?)',
    [name, destination, date, type],
  );
  return result.lastID;
}

module.exports = {
  listEquipments,
  listReservations,
  listFiles,
  createEquipment,
  createReservation,
};
