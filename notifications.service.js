// notifications.service.js
const db = require('./database');

function sendNotification({ type, recipient, message, relatedId = null }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO notifications (type, recipient, message, related_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [type, recipient, message, relatedId],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      }
    );
  });
}

module.exports = { sendNotification };
