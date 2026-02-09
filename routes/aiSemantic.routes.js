const express = require('express');

module.exports = function aiSemanticRoutes({
  authenticateToken,
  authorizeRoles,
  upload,
  db,
  path,
  fsPromises,
  PDFDocument,
  StandardFonts,
  mammoth,
  WordExtractor,
  semanticSearch,
  findSimilarDocuments,
  reindexAllDocuments,
  analyzeDocumentAsync,
  extractTextWithOCR,
}) {
  const router = express.Router();

  router.post('/extract-doc', authenticateToken, upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const filePath = path.join(__dirname, '..', `uploads/${file.filename}`);
    const originalFilePath = `/uploads/${file.filename}`;

    try {
      let text = '';
      let previewPdf = null;

      if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        text = (result.value || '').trim();
        console.log('✓ Texte DOCX extrait (pas de conversion PDF - LibreOffice non disponible)');
      } else if (ext === '.doc') {
        const extractor = new WordExtractor();
        const doc = await extractor.extract(filePath);
        text = (doc.getBody() || '').trim();
        console.log('✓ Texte DOC extrait (pas de conversion PDF - LibreOffice non disponible)');
      } else if (ext === '.txt') {
        const buffer = await fsPromises.readFile(filePath);
        text = buffer.toString('utf8').trim();
        try {
          const pdfDoc = await PDFDocument.create();
          const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
          const fontSize = 11;
          const margin = 40;
          const lineHeight = fontSize + 4;
          const pageWidth = 595.28;
          const pageHeight = 841.89;
          const maxWidth = pageWidth - 2 * margin;
          const maxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.5));

          const wrap = (txt) =>
            txt.split('\n').flatMap((line) => {
              const out = [];
              while (line.length > maxCharsPerLine) {
                out.push(line.slice(0, maxCharsPerLine));
                line = line.slice(maxCharsPerLine);
              }
              out.push(line);
              return out;
            });

          const lines = wrap(text);
          let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          let y = pageHeight - margin;

          for (const l of lines) {
            if (y < margin) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
              y = pageHeight - margin;
            }
            currentPage.drawText(l, { x: margin, y: y, size: fontSize, font });
            y -= lineHeight;
          }

          const pdfBytes = await pdfDoc.save();
          const outPath = filePath.replace(/\.[^/.]+$/, '.pdf');
          await fsPromises.writeFile(outPath, pdfBytes);
          previewPdf = `/uploads/${path.basename(outPath)}`;
        } catch (e) {
          console.warn('Génération PDF depuis TXT échouée:', e.message);
        }
      } else if (ext === '.rtf') {
        try {
          const buffer = await fsPromises.readFile(filePath);
          text = buffer
            .toString('utf8')
            .replace(/\\[a-z]+\d*\s?/g, ' ')
            .replace(/[{}]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          console.log('✓ Texte RTF extrait (mode basique - LibreOffice non disponible)');
        } catch (e) {
          console.warn('Extraction texte RTF basique échouée:', e.message);
          text = '';
        }
      } else {
        return res.status(400).json({ error: 'Format non supporté. Utilisez .doc, .docx, .rtf ou .txt' });
      }

      return res.json({ text, previewPdf, originalFilePath, originalFilename: file.originalname });
    } catch (error) {
      console.error('❌ Erreur extraction DOC/DOCX/TXT :', error.message);
      return res.status(500).json({ error: "Erreur lors de l'extraction du document." });
    }
  });

  router.get('/search/semantic', authenticateToken, async (req, res) => {
    try {
      const query = req.query.q || req.query.query;
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: 'Paramètre "query" requis' });
      }

      const limit = parseInt(req.query.limit) || 20;
      const threshold = parseFloat(req.query.threshold) || 0.7;
      const status = req.query.status || 'all';
      const type = req.query.type || 'all';
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      console.log(
        `🔍 Recherche sémantique: "${query}" | status=${status} type=${type} threshold=${threshold} limit=${limit}`,
      );

      const results = await semanticSearch(query, db, {
        limit,
        threshold,
        status,
        type,
        startDate,
        endDate,
      });

      return res.json({
        query,
        resultsCount: results.length,
        results,
      });
    } catch (error) {
      console.error('Erreur recherche sémantique:', error.message);
      return res.status(500).json({ error: 'Erreur lors de la recherche sémantique' });
    }
  });

  router.get('/courriers/:id/similar', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      let table = req.query.table || 'incoming_mails';
      const limit = parseInt(req.query.limit) || 5;

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
        if (!table) {
          return res
            .status(404)
            .json({ error: `Document ${id} introuvable dans incoming_mails ou courriers_sortants` });
        }
      }

      console.log(`🔍 Recherche documents similaires à ${table}/${id}`);
      const similar = await findSimilarDocuments(db, table, id, limit);

      return res.json({
        sourceId: id,
        sourceTable: table,
        resultsCount: similar.length,
        similar,
      });
    } catch (error) {
      console.error('Erreur recherche similaires:', error.message);
      return res
        .status(500)
        .json({ error: 'Erreur lors de la recherche de documents similaires', cause: error.message });
    }
  });

  router.post('/courriers/:id/analyze', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      let table = req.body.table;

      if (!table || table === 'auto') {
        table = await new Promise((resolve) => {
          db.get('SELECT id FROM incoming_mails WHERE id = ?', [id], (err, row) => {
            if (row && !err) return resolve('incoming_mails');
            db.get('SELECT id FROM courriers_sortants WHERE id = ?', [id], (err2, row2) => {
              if (row2 && !err2) return resolve('courriers_sortants');
              return resolve('incoming_mails');
            });
          });
        });
      }

      const doc = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id, extracted_text, subject, sender, recipient, mail_date, file_path FROM ${table} WHERE id = ?`,
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          },
        );
      });

      if (!doc) {
        return res.status(404).json({ error: `Document ${id} introuvable dans ${table}` });
      }

      if (!doc.extracted_text || doc.extracted_text.trim().length < 50) {
        const isProbablyScanned =
          doc.file_path &&
          (!doc.extracted_text ||
            doc.extracted_text.includes('-- 1 of') ||
            doc.extracted_text.trim().length < 20);

        return res.status(400).json({
          error: 'Texte extrait insuffisant pour une analyse IA',
          details: `Ce document ne contient que ${doc.extracted_text?.trim().length || 0} caractères de texte. ${isProbablyScanned ? "Il s'agit probablement d'un PDF scanné (image)." : ''} L'analyse IA nécessite au minimum 50 caractères de texte.`,
          suggestion: isProbablyScanned
            ? 'Utilisez le bouton "Extraire avec OCR" pour extraire le texte de ce document scanné.'
            : 'Ajoutez manuellement les informations importantes.',
          canUseOCR: isProbablyScanned,
          ocrEndpoint: isProbablyScanned ? `/api/courriers/${id}/extract-ocr` : null,
        });
      }

      const metadata = {
        subject: doc.subject,
        sender: doc.sender,
        recipient: doc.recipient,
        date: doc.mail_date,
      };

      console.log(`🤖 Analyse manuelle du document ${table}/${id}`);
      const analysis = await analyzeDocumentAsync(db, table, id, doc.extracted_text, metadata);

      return res.json({
        message: 'Analyse terminée avec succès',
        documentId: id,
        table: table,
        analysis: analysis,
      });
    } catch (error) {
      console.error('Erreur analyse manuelle:', error.message);
      return res.status(500).json({ error: "Erreur lors de l'analyse du document", cause: error.message });
    }
  });

  router.post('/admin/reindex-all', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
      console.log('📚 Début de la réindexation complète...');
      const indexedCount = await reindexAllDocuments(db);

      return res.json({
        message: 'Réindexation terminée',
        documentsIndexed: indexedCount,
      });
    } catch (error) {
      console.error('Erreur réindexation:', error.message);
      return res.status(500).json({ error: 'Erreur lors de la réindexation' });
    }
  });

  router.post('/courriers/:id/extract-ocr', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      let table = req.body.table || 'incoming_mails';

      const validTables = ['incoming_mails', 'courriers_sortants', 'archives'];
      if (!validTables.includes(table)) {
        return res.status(400).json({ error: 'Table invalide' });
      }

      const doc = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id, subject, file_path, extracted_text, sender, recipient, mail_date FROM ${table} WHERE id = ?`,
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          },
        );
      });

      if (!doc) {
        return res.status(404).json({ error: `Document ${id} introuvable dans ${table}` });
      }

      if (!doc.file_path) {
        return res.status(400).json({ error: "Ce document n'a pas de fichier PDF associé" });
      }

      try {
        await fsPromises.access(doc.file_path);
      } catch {
        return res.status(404).json({ error: 'Fichier PDF introuvable sur le serveur' });
      }

      console.log(`🔍 Démarrage OCR pour document ${id} (${doc.subject})...`);

      const ocrText = await extractTextWithOCR(doc.file_path);

      if (!ocrText || ocrText.trim().length < 10) {
        return res.status(400).json({
          error: "OCR n'a pas pu extraire de texte",
          details: 'Le document ne contient peut-être pas de texte lisible, ou la qualité est trop faible.',
        });
      }

      console.log(`✅ OCR terminé: ${ocrText.length} caractères extraits`);

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE ${table} SET extracted_text = ? WHERE id = ?`,
          [ocrText, id],
          (err) => {
            if (err) reject(err);
            else resolve();
          },
        );
      });

      let analysis = null;
      if (ocrText.length >= 50) {
        try {
          const metadata = {
            subject: doc.subject,
            sender: doc.sender,
            recipient: doc.recipient,
            date: doc.mail_date,
          };
          analysis = await analyzeDocumentAsync(db, table, id, ocrText, metadata);
          console.log('✅ Analyse IA automatique terminée');
        } catch (aiError) {
          console.warn('⚠️ Analyse IA échouée:', aiError.message);
        }
      }

      return res.json({
        message: 'OCR terminé avec succès',
        documentId: id,
        table: table,
        extractedLength: ocrText.length,
        preview: ocrText.substring(0, 200) + '...',
        aiAnalysisPerformed: !!analysis,
      });
    } catch (error) {
      console.error('❌ Erreur OCR:', error.message);
      return res.status(500).json({
        error: 'Erreur lors du traitement OCR',
        details: error.message,
      });
    }
  });

  return router;
};
