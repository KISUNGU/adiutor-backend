const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function generateMailQr({ db, id, appUrl, baseDir }) {
  const courrier = await dbGet(
    db,
    'SELECT id, ref_code, subject, sender FROM incoming_mails WHERE id = ?',
    [id],
  );

  if (!courrier) {
    const err = new Error('Courrier introuvable');
    err.status = 404;
    throw err;
  }

  const qrData = `${appUrl}/courrier-entrant/indexation?highlightId=${id}`;

  const qrCodeDataURL = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  const qrFileName = `qr-${courrier.ref_code || id}-${Date.now()}.png`;
  const qrDir = path.join(baseDir, 'uploads', 'qr-codes');
  const qrFilePath = path.join(qrDir, qrFileName);

  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }

  const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(qrFilePath, base64Data, 'base64');

  const qrPathInDB = `/uploads/qr-codes/${qrFileName}`;
  await dbRun(db, 'UPDATE incoming_mails SET qr_code_path = ? WHERE id = ?', [qrPathInDB, id]);

  return {
    qrCode: qrCodeDataURL,
    qrPath: qrPathInDB,
    courrier: {
      id: courrier.id,
      ref_code: courrier.ref_code,
      subject: courrier.subject,
    },
  };
}

module.exports = {
  generateMailQr,
};
