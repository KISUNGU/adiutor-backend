const express = require('express');
const { generateMailQr } = require('../services/qrCode.service');

module.exports = function qrCodeRoutes({ authenticateToken, validate, mailIdParam, db, baseDir, appUrl }) {
  const router = express.Router();

  router.post('/mails/incoming/:id/generate-qr', authenticateToken, mailIdParam, validate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await generateMailQr({
        db,
        id: Number(id),
        appUrl,
        baseDir,
      });
      res.json({
        success: true,
        qrCode: result.qrCode,
        qrPath: result.qrPath,
        courrier: result.courrier,
      });
    } catch (err) {
      console.error('Erreur génération QR Code:', err);
      next(err);
    }
  });

  return router;
};
