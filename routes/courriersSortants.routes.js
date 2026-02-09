const express = require('express');
const createCourriersSortantsService = require('../services/courriersSortants.service');

module.exports = function createCourriersSortantsRoutes({
  db,
  authenticateToken,
  authorizeRoles,
  upload,
  generateUniqueReference,
  recordEntityHistory,
  extractTextFromFile,
  analyzeDocumentAsync,
  baseDir,
}) {
  const router = express.Router();
  const service = createCourriersSortantsService({
    db,
    generateUniqueReference,
    recordEntityHistory,
    extractTextFromFile,
    analyzeDocumentAsync,
    baseDir,
  });

  const handleError = (res, err) => {
    const status = err?.status || 500;
    const message = err?.message || 'Erreur serveur.';
    if (status >= 500) console.error('Erreur courriers sortants:', err?.message || err);
    return res.status(status).json({ error: message });
  };

  // Statistiques des courriers sortants
  router.get('/courriers-sortants/stats', authenticateToken, authorizeRoles(['secretariat', 'coordonnateur', 'raf']), async (req, res) => {
    try {
      const data = await service.getStats(req.query);
      return res.json(data);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Enregistrer un brouillon
  router.post('/courriers-sortants/brouillon', authenticateToken, async (req, res) => {
    try {
      const result = await service.createDraft({ body: req.body, user: req.user, req });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Soumettre pour validation
  router.post('/courriers-sortants', authenticateToken, async (req, res) => {
    try {
      const result = await service.submitForValidation({ body: req.body, user: req.user, req });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Lister les courriers sortants (brouillons, importés, soumis)
  router.get('/courriers-sortants', authenticateToken, async (req, res) => {
    try {
      const result = await service.listAll();
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Route pour récupérer les courriers à valider (statut = 'brouillon')
  router.get('/courriers-validation', authenticateToken, async (req, res) => {
    try {
      const result = await service.listValidation();
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Importer un document (sauvegarde minimale)
  router.post('/courriers-sortants/import', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      const result = await service.importDocument({ file: req.file, body: req.body, user: req.user, req });
      if (result && result.status) {
        return res.status(result.status).json(result.body);
      }
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Legacy: création rapide d'un courrier sortant avec fichier
  router.post('/mails/outgoing', authenticateToken, upload.single('file'), (req, res) => {
    const { recipient, subject, content, mail_date } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;

    if (!recipient || !subject) {
      return res.status(400).json({ error: 'Destinataire et objet sont requis' });
    }

    const actorId = req.user?.id ?? req.user?.userId ?? null;
    const actorName = req.user?.username || req.user?.email || 'unknown';
    const dateEdition = mail_date || new Date().toISOString().split('T')[0];
    const payload = {
      recipient: recipient,
      destinataire: recipient,
      subject: subject,
      objet: subject,
      date_edition: dateEdition,
      content: content || null,
    };

    generateUniqueReference(db, 'sortant', 'courriers_sortants')
      .then(({ reference, uuid }) => {
        db.run(
          `INSERT INTO courriers_sortants (
          user_id,
          courrier,
          extracted_text,
          original_filename,
          original_file_path,
          statut,
          destinataire,
          objet,
          date_edition,
          reference_unique,
          uuid,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            actorId || 1,
            JSON.stringify(payload),
            String(content || ''),
            req.file?.originalname || null,
            file_path,
            recipient,
            subject,
            dateEdition,
            reference,
            uuid,
          ],
          function (err) {
            if (err) {
              console.error('Erreur création courrier sortant:', err.message);
              return res.status(500).json({ error: 'Erreur serveur.' });
            }

            try {
              if (recordEntityHistory) {
                recordEntityHistory(
                  'courriers_sortants',
                  this.lastID,
                  'Création courrier sortant (legacy)',
                  actorId,
                  actorName,
                  { recipient, subject, file_path },
                  req,
                );
              }
            } catch (_) {}

            return res.status(201).json({
              id: this.lastID,
              reference_unique: reference,
              uuid,
              message: 'Courrier sortant créé (brouillon).',
            });
          },
        );
      })
      .catch((err) => {
        console.error('Erreur génération référence sortant:', err.message);
        res.status(500).json({ error: 'Erreur serveur.' });
      });
  });

  // Approuver un courrier (passer de brouillon à validé)
  router.post('/courriers-validation/:id/approve', authenticateToken, async (req, res) => {
    try {
      const result = await service.approve({ id: req.params.id, user: req.user, req });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Rejeter un courrier (passer de brouillon à rejeté)
  router.post('/courriers-validation/:id/reject', authenticateToken, async (req, res) => {
    try {
      const result = await service.reject({ id: req.params.id, user: req.user, req });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Mettre à jour le statut d'un courrier sortant
  router.put('/courriers-sortants/:id/status', authenticateToken, async (req, res) => {
    try {
      const result = await service.updateStatus({ id: req.params.id, statut: req.body?.statut, user: req.user, req });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Joindre la version scannée avec AR (PDF recommandé)
  router.post('/courriers-sortants/:id/scan', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      const result = await service.addScan({ id: req.params.id, file: req.file, user: req.user, req });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // Envoyer un courrier sortant (marque comme "envoye" + historisation)
  router.post('/courriers-sortants/:id/send', authenticateToken, async (req, res) => {
    try {
      const result = await service.send({ id: req.params.id, user: req.user, req });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  });

  return router;
};
