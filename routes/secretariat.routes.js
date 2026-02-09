const express = require('express');
const {
  listPv,
  createPv,
  updatePv,
  deletePv,
  listAnnuaire,
  createAnnuaire,
  updateAnnuaire,
  deleteAnnuaire,
  listSecretariatContrats,
  createSecretariatContrat,
  updateSecretariatContrat,
  deleteSecretariatContrat,
  listSecretariatDocuments,
  createSecretariatDocument,
  updateSecretariatDocument,
  deleteSecretariatDocument,
} = require('../services/secretariat.service');

module.exports = function secretariatRoutes({
  authenticateToken,
  upload,
  db,
  extractTextFromPDF,
  callAISummary,
  fs,
  path,
  baseDir,
  sqlite3,
  dbPath,
  pdfParse,
  PDFParse,
  extractTextWithOCR,
  analyzeDocumentAsync,
  analyzeDocument,
  generateUniqueReference,
}) {
  const router = express.Router();
  const fsLib = fs || require('fs');
  const pathLib = path || require('path');
  const sqlite3Lib = sqlite3 || require('sqlite3').verbose();
  const pdfParser = pdfParse || PDFParse;
  const rootDir = baseDir || process.cwd();

  router.post('/secretariat/upload', authenticateToken, upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      const filePath = `/uploads/${req.file.filename}`;
      res.json({ filePath, filename: req.file.originalname });
    } catch (error) {
      console.error('Erreur upload fichier secrétariat:', error);
      res.status(500).json({ error: "Erreur lors de l'upload du fichier" });
    }
  });

  router.post('/secretariat/generate-summary', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      const { subject } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni.' });
      }

      const filePath = req.file.path;
      const text = await extractTextFromPDF(filePath);

      if (!text || text.trim().length < 50) {
        return res.status(400).json({
          error: 'Texte PDF trop court pour une analyse IA détaillée.',
        });
      }

      const summary = await callAISummary(text, subject);

      if (!summary || summary.trim() === '') {
        return res.status(500).json({
          error: 'Impossible de générer un résumé IA.',
        });
      }

      return res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error('Erreur génération résumé IA:', error);
      return res.status(500).json({
        error: 'Erreur lors de la génération du résumé IA.',
      });
    }
  });

  // Procès-verbaux
  router.get('/secretariat/pv', authenticateToken, async (req, res) => {
    try {
      const rows = await listPv({ db, category: req.query.category });
      res.json(rows);
    } catch (err) {
      console.error('Erreur chargement PV:', err);
      return res.status(500).json({ error: 'Erreur chargement procès-verbaux' });
    }
  });

  router.post('/secretariat/pv', authenticateToken, async (req, res) => {
    try {
      const { title, category, date } = req.body;
      if (!title || !category || !date) {
        return res.status(400).json({ error: 'Titre, catégorie et date requis' });
      }
      const id = await createPv({ db, payload: req.body });
      res.status(201).json({ id, message: 'Procès-verbal créé' });
    } catch (err) {
      console.error('Erreur création PV:', err);
      return res.status(500).json({ error: 'Erreur création procès-verbal' });
    }
  });

  router.put('/secretariat/pv/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await updatePv({ db, id, payload: req.body });
      if (result.changes === 0) return res.status(404).json({ error: 'Procès-verbal non trouvé' });
      res.json({ message: 'Procès-verbal modifié' });
    } catch (err) {
      console.error('Erreur modification PV:', err);
      return res.status(500).json({ error: 'Erreur modification procès-verbal' });
    }
  });

  router.delete('/secretariat/pv/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await deletePv({ db, id });
      if (result.changes === 0) return res.status(404).json({ error: 'Procès-verbal non trouvé' });
      res.json({ message: 'Procès-verbal supprimé' });
    } catch (err) {
      console.error('Erreur suppression PV:', err);
      return res.status(500).json({ error: 'Erreur suppression procès-verbal' });
    }
  });

  // Annuaire
  router.get('/secretariat/annuaire', authenticateToken, async (req, res) => {
    try {
      const rows = await listAnnuaire({ db, category: req.query.category });
      res.json(rows);
    } catch (err) {
      console.error('Erreur chargement annuaire:', err);
      return res.status(500).json({ error: 'Erreur chargement annuaire' });
    }
  });

  router.post('/secretariat/annuaire', authenticateToken, async (req, res) => {
    try {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Nom et email requis' });
      }
      const id = await createAnnuaire({ db, payload: req.body });
      res.status(201).json({ id, message: 'Contact créé' });
    } catch (err) {
      console.error('Erreur création contact:', err);
      return res.status(500).json({ error: 'Erreur création contact' });
    }
  });

  router.put('/secretariat/annuaire/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await updateAnnuaire({ db, id, payload: req.body });
      if (result.changes === 0) return res.status(404).json({ error: 'Contact non trouvé' });
      res.json({ message: 'Contact modifié' });
    } catch (err) {
      console.error('Erreur modification contact:', err);
      return res.status(500).json({ error: 'Erreur modification contact' });
    }
  });

  router.delete('/secretariat/annuaire/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await deleteAnnuaire({ db, id });
      if (result.changes === 0) return res.status(404).json({ error: 'Contact non trouvé' });
      res.json({ message: 'Contact supprimé' });
    } catch (err) {
      console.error('Erreur suppression contact:', err);
      return res.status(500).json({ error: 'Erreur suppression contact' });
    }
  });

  // Contrats (RH secrétariat)
  router.get('/secretariat/contrats', authenticateToken, async (req, res) => {
    try {
      const rows = await listSecretariatContrats({ db, type: req.query.type });
      res.json(rows);
    } catch (err) {
      console.error('Erreur chargement contrats:', err);
      return res.status(500).json({ error: 'Erreur chargement contrats' });
    }
  });

  router.post('/secretariat/contrats', authenticateToken, async (req, res) => {
    try {
      const { employe, type, date_debut } = req.body;
      if (!employe || !type || !date_debut) {
        return res.status(400).json({ error: 'Employé, type et date de début requis' });
      }
      const id = await createSecretariatContrat({ db, payload: req.body });
      res.status(201).json({ id, message: 'Contrat créé' });
    } catch (err) {
      console.error('Erreur création contrat:', err);
      return res.status(500).json({ error: 'Erreur création contrat' });
    }
  });

  router.put('/secretariat/contrats/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await updateSecretariatContrat({ db, id, payload: req.body });
      if (result.changes === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
      res.json({ message: 'Contrat modifié' });
    } catch (err) {
      console.error('Erreur modification contrat:', err);
      return res.status(500).json({ error: 'Erreur modification contrat' });
    }
  });

  router.delete('/secretariat/contrats/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await deleteSecretariatContrat({ db, id });
      if (result.changes === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
      res.json({ message: 'Contrat supprimé' });
    } catch (err) {
      console.error('Erreur suppression contrat:', err);
      return res.status(500).json({ error: 'Erreur suppression contrat' });
    }
  });

  // Documents (juridiques, légaux, accords)
  router.get('/secretariat/documents', authenticateToken, async (req, res) => {
    try {
      const rows = await listSecretariatDocuments({ db, type: req.query.type });
      res.json(rows);
    } catch (err) {
      console.error('Erreur chargement documents:', err);
      return res.status(500).json({ error: 'Erreur chargement documents' });
    }
  });

  router.post('/secretariat/documents', authenticateToken, async (req, res) => {
    try {
      const { reference, objet, destinataire, date, type } = req.body;
      if (!reference || !objet || !destinataire || !date || !type) {
        return res.status(400).json({ error: 'Référence, objet, destinataire, date et type requis' });
      }
      const id = await createSecretariatDocument({ db, payload: req.body });
      res.status(201).json({ id, message: 'Document créé' });
    } catch (err) {
      console.error('Erreur création document:', err);
      return res.status(500).json({ error: 'Erreur création document' });
    }
  });

  router.put('/secretariat/documents/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await updateSecretariatDocument({ db, id, payload: req.body });
      if (result.changes === 0) return res.status(404).json({ error: 'Document non trouvé' });
      res.json({ message: 'Document modifié' });
    } catch (err) {
      console.error('Erreur modification document:', err);
      return res.status(500).json({ error: 'Erreur modification document' });
    }
  });

  router.delete('/secretariat/documents/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await deleteSecretariatDocument({ db, id });
      if (result.changes === 0) return res.status(404).json({ error: 'Document non trouvé' });
      res.json({ message: 'Document supprimé' });
    } catch (err) {
      console.error('Erreur suppression document:', err);
      return res.status(500).json({ error: 'Erreur suppression document' });
    }
  });

  // ========================
  // ARCHIVES TEMPORAIRES (IA)
  // ========================

  router.get('/secretariat/temp-archives', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.all(
      'SELECT * FROM temp_archives WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Erreur récupération archives temporaires:', err);
          return res.status(500).json({ error: 'Erreur lors de la récupération' });
        }

        res.json(rows || []);
      }
    );
  });

  router.post('/secretariat/temp-archives', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const userId = req.user.id;
      const filePath = req.file.path;
      const fileName = req.file.originalname;

      console.log(`📄 Analyse IA du fichier: ${fileName}`);

      let extractedText = '';
      try {
        if (!pdfParser) {
          throw new Error('PDF parser indisponible');
        }
        const data = await pdfParser(fsLib.readFileSync(filePath));
        extractedText = data.text;
      } catch (extractErr) {
        console.warn('Erreur extraction PDF, tentative OCR:', extractErr.message);
        try {
          extractedText = await extractTextWithOCR(filePath);
        } catch (ocrErr) {
          console.error('Erreur OCR:', ocrErr.message);
          return res.status(500).json({ error: "Impossible d'extraire le texte du document" });
        }
      }

      if (!extractedText || extractedText.trim().length < 50) {
        return res.status(400).json({
          error: 'Texte extrait insuffisant',
          details: 'Le document doit contenir au moins 50 caractères de texte lisible.'
        });
      }

      const analysis = await analyzeDocumentAsync(db, 'temp_archives', null, extractedText, {});

      const extractedData = JSON.stringify({
        reference: analysis.reference,
        type: analysis.type,
        subject: analysis.subject,
        sender: analysis.sender,
        date: analysis.date,
        receptionDate: analysis.receptionDate,
        summary: analysis.summary,
        priority: analysis.priority,
        classification: analysis.classification,
        keywords: analysis.keywords
      });

      db.run(
        'INSERT INTO temp_archives (user_id, file_name, file_path, extracted_text, extracted_data, status) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, fileName, filePath, extractedText, extractedData, 'pending'],
        function (err) {
          if (err) {
            console.error('Erreur création archive temporaire:', err);
            return res.status(500).json({ error: 'Erreur lors de la création' });
          }

          res.status(201).json({
            id: this.lastID,
            file_name: fileName,
            extracted_data: JSON.parse(extractedData),
            status: 'pending',
            created_at: new Date().toISOString()
          });
        }
      );
    } catch (error) {
      console.error('Erreur création archive temporaire:', error);
      res.status(500).json({ error: "Erreur lors de l'analyse IA" });
    }
  });

  router.put('/secretariat/temp-archives/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { extractedData, documentType } = req.body;

    let extractedJson = '{}';
    try {
      extractedJson = JSON.stringify(extractedData || {});
    } catch (e) {
      console.error('Erreur JSON extractedData:', e);
      return res.status(400).json({ error: 'Données extraites invalides' });
    }

    db.run(
      `
        UPDATE temp_archives
        SET extracted_data = ?, document_type = ?
        WHERE id = ? AND user_id = ?
      `,
      [extractedJson, documentType || 'archive', id, userId],
      function (err) {
        if (err) {
          console.error('Erreur update temp_archive:', err);
          return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
        }

        if (this.changes === 0) {
          return res
            .status(404)
            .json({ error: 'Archive temporaire non trouvée ou non accessible' });
        }

        res.json({
          success: true,
          message: 'Archive temporaire mise à jour',
        });
      }
    );
  });

  router.get('/secretariat/temp-archives/:id/preview', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.get(
      `
        SELECT file_path, file_name
        FROM temp_archives
        WHERE id = ? AND user_id = ?
      `,
      [id, userId],
      (err, row) => {
        if (err) {
          console.error('Erreur récupération temp_archive pour preview:', err);
          return res.status(500).json({ error: 'Erreur lors de la récupération' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Archive temporaire non trouvée' });
        }

        if (!row.file_path) {
          return res.status(404).json({ error: 'Aucun fichier associé à cette archive' });
        }

        const absolutePath = pathLib.isAbsolute(row.file_path)
          ? row.file_path
          : pathLib.join(rootDir, row.file_path);

        if (!fsLib.existsSync(absolutePath)) {
          return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(row.file_name || 'document.pdf')}"`
        );

        const stream = fsLib.createReadStream(absolutePath);
        stream.on('error', (streamErr) => {
          console.error('Erreur lecture fichier PDF:', streamErr);
          return res.status(500).end();
        });

        stream.pipe(res);
      }
    );
  });

  router.get('/test/temp-archives', authenticateToken, (req, res) => {
    db.all(
      `
        SELECT id, file_name, file_path, status, created_at, extracted_data
        FROM temp_archives
        WHERE file_path IS NOT NULL AND file_path != ''
        ORDER BY created_at DESC
      `,
      [],
      (err, rows) => {
        if (err) {
          console.error('Erreur récupération archives test:', err);
          return res.status(500).json({ error: 'Erreur lors de la récupération' });
        }

        res.json(rows || []);
      }
    );
  });

  router.get('/test/temp-archives/:id/preview', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.get(
      `
        SELECT file_path, file_name
        FROM temp_archives
        WHERE id = ? AND file_path IS NOT NULL AND file_path != ''
      `,
      [id],
      (err, row) => {
        if (err) {
          console.error('Erreur récupération temp_archive pour preview test:', err);
          return res.status(500).json({ error: 'Erreur lors de la récupération' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Archive temporaire non trouvée ou sans fichier' });
        }

        const absolutePath = pathLib.isAbsolute(row.file_path)
          ? row.file_path
          : pathLib.join(rootDir, row.file_path);

        if (!fsLib.existsSync(absolutePath)) {
          return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(row.file_name || 'document.pdf')}"`
        );

        const stream = fsLib.createReadStream(absolutePath);
        stream.on('error', (streamErr) => {
          console.error('Erreur lecture fichier PDF:', streamErr);
          return res.status(500).end();
        });

        stream.pipe(res);
      }
    );
  });

  router.post('/secretariat/temp-archives/:id/approve', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      db.get(
        'SELECT * FROM temp_archives WHERE id = ? AND user_id = ? AND status = ?',
        [id, userId, 'pending'],
        (err, archive) => {
          if (err) {
            console.error('Erreur récupération archive:', err);
            return res.status(500).json({ error: 'Erreur lors de la récupération' });
          }

          if (!archive) {
            return res.status(404).json({ error: 'Archive non trouvée ou déjà traitée' });
          }

          let extractedData;
          try {
            extractedData = JSON.parse(archive.extracted_data || '{}');
          } catch (parseErr) {
            console.error('Erreur parsing données extraites:', parseErr);
            return res.status(500).json({ error: 'Données extraites corrompues' });
          }

          const archiveQuery = `
            INSERT INTO archives (
              reference, type, date, sender, description, category, status,
              file_path, coordo_annotation, ai_summary, ai_keywords, ai_priority,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `;

          let reference = extractedData.reference;
          if (!reference) {
            const timestamp = Date.now();
            const randomPart = Math.random().toString(36).substr(2, 9);
            reference = `IMPORT_${timestamp}_${randomPart}_${archive.id}`;
          }

          db.get('SELECT id FROM archives WHERE reference = ?', [reference], (checkErr, existingRow) => {
            if (checkErr) {
              console.error('Erreur vérification référence:', checkErr);
              return res.status(500).json({ error: 'Erreur lors de la vérification de la référence' });
            }

            if (existingRow) {
              const timestamp = Date.now();
              const randomPart = Math.random().toString(36).substr(2, 9);
              reference = `IMPORT_${timestamp}_${randomPart}_${archive.id}_v2`;
              console.log('Référence existante détectée, nouvelle référence générée:', reference);
            }

            const description = extractedData.subject || `Document importé: ${archive.file_name}`;
            const filePath = `temp_archives/${archive.file_name}`;

            const coordoAnnotation = JSON.stringify({
              sender: extractedData.sender,
              date_indexation: new Date().toISOString(),
              date_reception: extractedData.receptionDate,
              mail_date: extractedData.date,
              archived_by: req.user.email || 'secretariat',
              archived_date: new Date().toISOString(),
              imported_via_ai: true
            });

            db.run(archiveQuery, [
              reference,
              extractedData.type || 'Document Importé',
              extractedData.date || new Date().toISOString().split('T')[0],
              extractedData.sender || 'Inconnu',
              description,
              'IMPORT_AI',
              'Archivé',
              filePath,
              coordoAnnotation,
              extractedData.summary || '',
              extractedData.keywords ? JSON.stringify(extractedData.keywords) : null,
              extractedData.priority || 'Moyenne'
            ], function (runErr) {
              if (runErr) {
                console.error('Erreur archivage définitif:', runErr);
                console.error("Message d'erreur complet:", runErr.message);
                console.error("Code d'erreur:", runErr.code);
                console.error('Paramètres utilisés:', [
                  reference,
                  extractedData.type || 'Document Importé',
                  extractedData.date || new Date().toISOString().split('T')[0],
                  extractedData.sender || 'Inconnu',
                  description,
                  'IMPORT_AI',
                  'Archivé',
                  filePath,
                  coordoAnnotation,
                  extractedData.summary || '',
                  extractedData.keywords ? JSON.stringify(extractedData.keywords) : null,
                  extractedData.priority || 'Moyenne'
                ]);
                return res.status(500).json({ error: "Erreur lors de l'archivage définitif", details: runErr.message });
              }

              const tempDb = new sqlite3Lib.Database(dbPath);
              tempDb.run(
                'UPDATE temp_archives SET status = ?, approved_at = datetime(\'now\') WHERE id = ?',
                ['approved', id],
                (updateErr) => {
                  tempDb.close();
                  if (updateErr) {
                    console.error('Erreur mise à jour statut:', updateErr);
                  }

                  res.json({
                    success: true,
                    message: 'Archive approuvée et archivée définitivement',
                    archiveId: this.lastID
                  });
                }
              );
            });
          });
        }
      );
    } catch (error) {
      console.error('Erreur approbation archive:', error);
      res.status(500).json({ error: "Erreur lors de l'approbation de l'archive" });
    }
  });

  router.post('/secretariat/temp-archives/:id/reject', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const reason = req.body?.reason || "Rejeté par l'utilisateur";

    db.run(
      'UPDATE temp_archives SET status = ?, rejected_at = datetime(\'now\'), rejected_reason = ? WHERE id = ? AND user_id = ? AND status = ?',
      ['rejected', reason, id, userId, 'pending'],
      function (err) {
        if (err) {
          console.error('Erreur rejet archive:', err);
          return res.status(500).json({ error: 'Erreur lors du rejet' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Archive non trouvée ou déjà traitée' });
        }

        res.json({
          success: true,
          message: 'Archive rejetée'
        });
      }
    );
  });

  router.delete('/secretariat/temp-archives/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.get(
      'SELECT file_path FROM temp_archives WHERE id = ? AND user_id = ?',
      [id, userId],
      (err, row) => {
        if (err) {
          console.error('Erreur récupération fichier:', err);
          return res.status(500).json({ error: 'Erreur lors de la récupération' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Archive non trouvée' });
        }

        if (row.file_path && fsLib.existsSync(row.file_path)) {
          try {
            fsLib.unlinkSync(row.file_path);
          } catch (fileErr) {
            console.warn('Erreur suppression fichier:', fileErr.message);
          }
        }

        db.run(
          'DELETE FROM temp_archives WHERE id = ? AND user_id = ?',
          [id, userId],
          function (deleteErr) {
            if (deleteErr) {
              console.error('Erreur suppression archive:', deleteErr);
              return res.status(500).json({ error: 'Erreur lors de la suppression' });
            }

            if (this.changes === 0) {
              return res.status(404).json({ error: 'Archive non trouvée' });
            }

            res.json({
              success: true,
              message: 'Archive supprimée'
            });
          }
        );
      }
    );
  });

  router.post('/secretariat/temp-archives/from-extracted', authenticateToken, async (req, res) => {
    const { fileName, extractedData, documentType, filePath } = req.body;

    if (!fileName || !extractedData) {
      return res.status(400).json({ error: 'Données manquantes: fileName et extractedData requis' });
    }

    try {
      const userId = req.user.id;
      const tempRef = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const insertData = {
        user_id: userId,
        file_name: fileName,
        file_path: filePath || '',
        extracted_text: extractedData.extractedText || '',
        extracted_data: JSON.stringify(extractedData),
        ai_summary: extractedData.summary || '',
        ai_keywords: extractedData.keywords ? JSON.stringify(extractedData.keywords) : null,
        ai_priority: extractedData.priority || 'Moyenne',
        status: 'pending',
        temp_reference: tempRef,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.run(
        `INSERT INTO temp_archives (
          user_id, file_name, file_path, extracted_text, extracted_data,
          ai_summary, ai_keywords, ai_priority, status, temp_reference,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          insertData.user_id,
          insertData.file_name,
          insertData.file_path,
          insertData.extracted_text,
          insertData.extracted_data,
          insertData.ai_summary,
          insertData.ai_keywords,
          insertData.ai_priority,
          insertData.status,
          insertData.temp_reference,
          insertData.created_at,
          insertData.updated_at
        ],
        function (err) {
          if (err) {
            console.error('Erreur création archive temporaire depuis données extraites:', err);
            return res.status(500).json({ error: "Erreur lors de la création de l'archive temporaire" });
          }

          res.json({
            success: true,
            tempArchiveId: this.lastID,
            tempReference: tempRef,
            message: 'Archive temporaire créée avec succès'
          });
        }
      );
    } catch (error) {
      console.error('Erreur création archive temporaire depuis données extraites:', error);
      res.status(500).json({ error: "Erreur serveur lors de la création de l'archive temporaire" });
    }
  });

  router.post('/secretariat/analyze-archives', authenticateToken, upload.array('files', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const results = [];

    try {
      for (const file of req.files) {
        const filePath = file.path;
        const originalName = file.originalname;

        let extractedText = '';
        try {
          if (!pdfParser) {
            throw new Error('PDF parser indisponible');
          }
          const data = await pdfParser(fsLib.readFileSync(filePath));
          extractedText = data.text.trim();
        } catch (err) {
          console.warn(`Erreur extraction PDF ${originalName}: ${err.message}. Tentative OCR.`);
          try {
            extractedText = await extractTextWithOCR(filePath);
          } catch (ocrErr) {
            console.error(`Erreur OCR ${originalName}: ${ocrErr.message}`);
            results.push({
              originalName,
              extractedData: {},
              confidence: 0,
              status: 'error',
              error: "Impossible d'extraire le texte"
            });
            continue;
          }
        }

        if (!extractedText || extractedText.length < 50) {
          results.push({
            originalName,
            extractedData: {},
            confidence: 0,
            status: 'error',
            error: 'Texte extrait insuffisant'
          });
          continue;
        }

        const analysis = await analyzeDocument(db, 'archives', null, extractedText, {});

        results.push({
          originalName,
          extractedData: {
            date: analysis.date || '',
            sender: analysis.sender || '',
            type: analysis.type || '',
            receptionDate: analysis.receptionDate || '',
            subject: analysis.subject || '',
            reference: analysis.reference || ''
          },
          confidence: 85,
          status: 'analyzed'
        });
      }

      res.json({ results });
    } catch (err) {
      console.error('Erreur globale analyse archives:', err);
      res.status(500).json({ error: "Erreur serveur lors de l'analyse" });
    } finally {
      req.files.forEach(file => fsLib.unlink(file.path, err => err && console.warn(`Erreur cleanup ${file.originalname}: ${err}`)));
    }
  });

  router.post('/secretariat/archive-document', authenticateToken, async (req, res) => {
    const { fileName, extractedData, documentType } = req.body;

    if (!fileName || !extractedData || !documentType) {
      return res.status(400).json({ error: 'Données manquantes: fileName, extractedData, et documentType sont requis' });
    }

    if (typeof extractedData !== 'object' || extractedData === null) {
      return res.status(400).json({ error: 'extractedData doit être un objet valide' });
    }

    try {
      const reference = await generateUniqueReference(db, 'archive', 'archives', 'reference');

      db.run(
        `INSERT INTO archives (
          reference, type, date, sender, description, category, status,
          ai_summary, ai_keywords, ai_priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          reference.reference,
          extractedData.type || documentType,
          extractedData.date || new Date().toISOString().slice(0, 10),
          extractedData.sender || 'Inconnu',
          extractedData.subject || fileName,
          'IA_Import',
          'Archivé',
          extractedData.summary || '',
          extractedData.keywords ? JSON.stringify(extractedData.keywords) : null,
          extractedData.priority || 'Moyenne'
        ],
        function (err) {
          if (err) {
            console.error('Erreur archivage:', err.message, err.stack);
            return res.status(500).json({ error: "Erreur lors de l'archivage" });
          }
          res.json({ success: true, archiveId: this.lastID });
        }
      );
    } catch (err) {
      console.error('Erreur génération référence ou archivage:', err.message, err.stack);
      res.status(500).json({ error: 'Erreur serveur lors de l\'archivage: ' + err.message });
    }
  });

  return router;
};
