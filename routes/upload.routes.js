const express = require('express');

module.exports = function uploadRoutes({
  authenticateToken,
  authorizeAdmin,
  upload,
  path,
  extractTextFromPDF,
  db,
  logger,
  fsPromises,
  buildMemoryStore,
}) {
  const router = express.Router();

  router.post('/upload', authenticateToken, upload.single('pdf'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
    const extractedText = await extractTextFromPDF(filePath);

    try {
      db.run(
        `INSERT INTO files (filename, path, upload_date, extracted_text) VALUES (?, ?, ?, ?)`,
        [req.file.originalname, `/uploads/${req.file.filename}`, new Date().toISOString(), extractedText],
        function (err) {
          if (err) {
            if (logger) {
              logger.error('Erreur lors de l\'enregistrement du fichier', { error: err.message });
            }
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          res.json({ message: `Fichier ${req.file.originalname} téléversé avec succès.` });
        },
      );
    } catch (error) {
      if (logger) {
        logger.error('Erreur lors de l\'upload', { error: error.message });
      }
      res.status(500).json({ error: 'Erreur lors de l\'upload' });
    }
  });

  router.post('/reindex', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
      const files = await fsPromises.readdir(path.join(__dirname, '..', 'uploads'));
      const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf');

      for (const file of pdfFiles) {
        const filePath = path.join(__dirname, '..', 'uploads', file);
        const extractedText = await extractTextFromPDF(filePath);
        db.run(
          `UPDATE files SET extracted_text = ? WHERE path = ?`,
          [extractedText, `/uploads/${file}`],
          (err) => {
            if (err && logger) {
              logger.error('Erreur mise à jour texte extrait', { file, error: err.message });
            }
          },
        );
      }

      await buildMemoryStore();

      if (logger) {
        logger.info('Réindexation déclenchée.');
      }
      res.json({ message: 'Réindexation effectuée.' });
    } catch (error) {
      if (logger) {
        logger.error('Erreur réindexation', { error: error.message });
      }
      res.status(500).json({ error: 'Erreur lors de la réindexation' });
    }
  });

  return router;
};
