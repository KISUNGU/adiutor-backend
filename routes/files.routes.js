const express = require('express');

module.exports = function filesRoutes({
  authenticateToken,
  upload,
  db,
  path,
  extractTextFromFile,
}) {
  const router = express.Router();

  router.post('/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const { filename, path: filePath } = req.file;
      const originalFilename = req.file.originalname;
      const uploadDate = new Date().toISOString();
      const absolutePath = path.join(__dirname, '..', filePath);
      const extractedText = await extractTextFromFile(absolutePath);
      const extractedTextLength = (extractedText || '').length;
      const MAX_RETURN_CHARS = 20000;
      const extractedTextTruncated = (extractedText || '').slice(0, MAX_RETURN_CHARS);
      const extractedTextWasTruncated = extractedTextLength > MAX_RETURN_CHARS;

      db.run(
        'INSERT INTO files (filename, path, upload_date, extracted_text) VALUES (?, ?, ?, ?)',
        [filename, filePath, uploadDate, extractedText],
        function (err) {
          if (err) {
            console.error('Erreur enregistrement fichier:', err.message);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          res.status(201).json({
            message: 'Fichier uploadé et archivé',
            id: this.lastID,
            originalFilename,
            extractedText: extractedTextTruncated,
            extractedTextLength,
            extractedTextTruncated: extractedTextWasTruncated,
          });
        },
      );
    } catch (error) {
      console.error('Erreur upload:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};
