const express = require('express');

module.exports = function aiAnnexeRoutes({
  authenticateToken,
  db,
  PDFDocument,
  StandardFonts,
  path,
  fs,
}) {
  const router = express.Router();
  const fsLib = fs || require('fs');
  const pathLib = path || require('path');

  db.run(`CREATE TABLE IF NOT EXISTS mail_ai_annexes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mail_id INTEGER NOT NULL,
    table_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  router.post('/courriers/:id/ai-annexe', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      let table = req.body.table || 'auto';
      if (table === 'auto') {
        table = await new Promise((resolve) => {
          db.get('SELECT id FROM incoming_mails WHERE id = ?', [id], (err, row) => {
            if (row && !err) return resolve('incoming_mails');
            db.get('SELECT id FROM courriers_sortants WHERE id = ?', [id], (err2, row2) => {
              if (row2 && !err2) return resolve('courriers_sortants');
              return resolve(null);
            });
          });
        });
        if (!table) return res.status(404).json({ error: `Document ${id} introuvable.` });
      }

      const doc = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM ${table} WHERE id = ?`, [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!doc) return res.status(404).json({ error: 'Document non trouvé pour annexe.' });

      const subject = doc.subject || doc.objet || 'Sujet inconnu';
      const sender = doc.sender || doc.destinataire || 'N/A';
      const reference = doc.reference_unique || `DOC-${id}`;
      const summary = doc.ai_summary || doc.summary || 'Résumé IA indisponible.';
      const classification = doc.classification || doc.ai_classification || 'Non classé';
      const priority = doc.ai_priority || doc.priority || 'Non définie';

      let keywords = [];
      if (doc.ai_keywords) {
        if (Array.isArray(doc.ai_keywords)) {
          keywords = doc.ai_keywords;
        } else if (typeof doc.ai_keywords === 'string') {
          try {
            const parsed = JSON.parse(doc.ai_keywords);
            if (Array.isArray(parsed)) {
              keywords = parsed;
            } else {
              keywords = String(doc.ai_keywords)
                .split(/[,;\n]/)
                .map((s) => s.trim())
                .filter(Boolean);
            }
          } catch {
            keywords = String(doc.ai_keywords)
              .split(/[,;\n]/)
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
      }
      const analyzedAt = doc.analyzed_at || doc.analysis_date || doc.analyzedAt || 'N/A';

      const annexText = [
        'ANNEXE IA - Analyse Automatisée',
        '--------------------------------',
        `Référence: ${reference}`,
        `Table: ${table}`,
        `ID: ${id}`,
        `Sujet: ${subject}`,
        `Émetteur / Destinataire: ${sender}`,
        `Classification: ${classification}`,
        `Priorité: ${priority}`,
        `Mots-clés: ${keywords.join(', ') || 'Aucun'}`,
        `Analysé le: ${analyzedAt}`,
        '',
        'Résumé IA:',
        summary,
        '',
        '--- Fin Annexe IA ---',
      ].join('\n');

      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { width, height } = page.getSize();
      const fontSize = 11;
      const margin = 40;
      let cursorY = height - margin;
      annexText.split('\n').forEach((line) => {
        if (cursorY < margin) {
          page = pdfDoc.addPage();
          cursorY = height - margin;
        }
        page.drawText(line, { x: margin, y: cursorY, size: fontSize, font });
        cursorY -= fontSize + 6;
      });
      const pdfBytes = await pdfDoc.save();

      const uploadsDir = pathLib.join(__dirname, '..', 'uploads');
      const annexDir = uploadsDir;
      fsLib.mkdirSync(annexDir, { recursive: true });
      const filename = `annexe_ia_${table}_${id}.pdf`;
      const filePath = pathLib.join(annexDir, filename);
      fsLib.writeFileSync(filePath, pdfBytes);

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO mail_ai_annexes (mail_id, table_name, file_path) VALUES (?, ?, ?)',
          [id, table, filename],
          (err) => {
            if (err) reject(err);
            else resolve();
          },
        );
      });

      const hostUrl = `${req.protocol}://${req.get('host')}`;
      res.json({
        message: 'Annexe IA générée',
        documentId: id,
        table,
        file: filename,
        url: `/uploads/${filename}`,
        urlAbsolute: `${hostUrl}/uploads/${filename}`,
      });
    } catch (error) {
      console.error('Erreur génération annexe IA:', error.message);
      res.status(500).json({ error: 'Erreur génération annexe IA', cause: error.message });
    }
  });

  router.get('/courriers/:id/ai-annexe', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      db.all(
        'SELECT id, table_name, file_path, created_at FROM mail_ai_annexes WHERE mail_id = ? ORDER BY created_at DESC',
        [id],
        (err, rows) => {
          if (err) return res.status(500).json({ error: 'Erreur récupération annexes' });
          res.json({ count: rows.length, annexes: rows });
        },
      );
    } catch (e) {
      res.status(500).json({ error: 'Erreur inconnue' });
    }
  });

  return router;
};
