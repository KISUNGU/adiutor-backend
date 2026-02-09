const express = require('express');
const {
  getArchivesCount,
  getArchivesSimple,
  getArchivesPublic,
  getArchivesAll,
  listArchives,
  getArchiveCounts,
  getArchiveAnnexes,
} = require('../services/archives.service');

module.exports = function archivesRoutes({
  authenticateToken,
  requireDebugEnabled,
  validate,
  archivesListValidator,
  archiveIdParam,
  db,
  logger,
  upload,
  path,
  extractTextFromFile,
  convertDocxToPDF,
  baseDir,
}) {
  const router = express.Router();

  router.get('/debug/archives-count', authenticateToken, requireDebugEnabled, async (req, res, next) => {
    try {
      console.log('🔍 Debug archives-count appelé');
      const data = await getArchivesCount({ db });
      res.json({
        total_archives: data.total_archives,
        timestamp: new Date().toISOString(),
        message: 'Debug endpoint',
      });
    } catch (err) {
      console.error('❌ Erreur count archives:', err.message);
      next(err);
    }
  });

  router.get('/debug/archives-all', authenticateToken, requireDebugEnabled, async (req, res, next) => {
    try {
      console.log('🔍 Debug archives-all appelé');
      const rows = await getArchivesAll({ db });
      res.json({
        count: rows?.length || 0,
        archives: rows || [],
        message: 'Données brutes de la table archives',
      });
    } catch (err) {
      console.error('❌ Erreur archives-all:', err.message);
      next(err);
    }
  });

  router.get('/archives/simple', authenticateToken, async (req, res, next) => {
    try {
      console.log('🔍 Route /api/archives/simple appelée');
      const rows = await getArchivesSimple({ db });
      console.log(`✅ ${rows?.length || 0} archives retournées (simple)`);
      res.json(rows || []);
    } catch (err) {
      console.error('❌ Erreur /api/archives/simple:', err.message);
      next(err);
    }
  });

  router.get('/archives-public', authenticateToken, async (req, res, next) => {
    try {
      console.log('🔍 Route archives-public appelée');
      const rows = await getArchivesPublic({ db });
      console.log(`✅ ${rows?.length || 0} archives (public)`);
      res.json(rows || []);
    } catch (err) {
      console.error('❌ Erreur archives-public:', err.message);
      next(err);
    }
  });

  router.get('/archives', authenticateToken, archivesListValidator, validate, async (req, res, next) => {
    try {
      const { service, category, type, status, limit = 100, page = 1 } = req.query;
      const { rows, pagination } = await listArchives({
        db,
        filters: { service, category, type, status, limit, page },
      });

      console.log('📊 Requête archives:', { service, category, type, status, limit, page });

      res.json({
        archives: rows || [],
        pagination,
      });
    } catch (err) {
      console.error('❌ Erreur SQL archives:', err.message);
      if (logger) {
        logger.error('Erreur SQL archives', { error: err.message, stack: err.stack });
      }
      next(err);
    }
  });

  router.get('/archives/counts', authenticateToken, async (req, res, next) => {
    try {
      const rows = await getArchiveCounts({ db });
      res.json(rows || []);
    } catch (err) {
      console.error('Erreur récupération compteurs archives:', err.message);
      next(err);
    }
  });

  router.get('/archives/search', authenticateToken, (req, res) => {
    const { q } = req.query;
    const sql = `
    SELECT * FROM archives
    WHERE description LIKE ? OR reference LIKE ? OR category LIKE ?
  `;
    const params = [`%${q}%`, `%${q}%`, `%${q}%`];

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erreur recherche archives:', err.message);
        return res.status(500).json({ error: 'Erreur serveur.' });
      }
      res.json(rows);
    });
  });

  router.get('/archives/:category', authenticateToken, (req, res) => {
    const { category } = req.params;
    db.all('SELECT * FROM archives WHERE category = ?', [category], (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des documents :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.get('/documents/types', authenticateToken, (req, res) => {
    const sql = 'SELECT id_type_document, nom_type FROM Type_Document ORDER BY nom_type';
    db.all(sql, [], (err, rows) => {
      if (err) {
        if (logger) {
          logger.error('Erreur lors de la récupération des types de documents', { error: err.message });
        }
        return res.status(500).json({ error: 'Erreur serveur lors du chargement des types.' });
      }
      res.json(rows);
    });
  });

  router.put(
    '/archives/:id/metadata',
    authenticateToken,
    archiveIdParam,
    validate,
    (req, res) => {
      const { id } = req.params;
      const { category, classeur } = req.body;

      if (!category && !classeur) {
        return res.status(400).json({ error: 'Au moins category ou classeur requis' });
      }

      const updates = [];
      const params = [];

      if (category) {
        updates.push('category = ?');
        params.push(category);
      }
      if (classeur) {
        updates.push('classeur = ?');
        params.push(classeur);
      }

      params.push(id);

      const sql = `UPDATE archives SET ${updates.join(', ')} WHERE id = ?`;

      db.run(sql, params, function (err) {
        if (err) {
          console.error('Erreur mise à jour archive metadata:', err.message);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Archive non trouvée' });
        }
        res.json({ message: 'Métadonnées mises à jour', id: Number(id) });
      });
    },
  );

  router.get('/classeurs', authenticateToken, (req, res) => {
    const sql =
      'SELECT id_classement, numero_classeur, intitule, detail_abbreviations FROM Classement ORDER BY CAST(numero_classeur AS INTEGER)';
    db.all(sql, [], (err, rows) => {
      if (err) {
        if (logger) {
          logger.error('Erreur lors de la récupération des classeurs', { error: err.message });
        }
        return res.status(500).json({ error: 'Erreur serveur lors du chargement des classeurs.' });
      }
      res.json(rows);
    });
  });

  router.get(
    '/archives/:id/annexes',
    authenticateToken,
    archiveIdParam,
    validate,
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const rows = await getArchiveAnnexes({ db, id: Number(id) });
        res.json(rows || []);
      } catch (err) {
        console.error('Erreur récupération annexes archives:', err.message);
        next(err);
      }
    },
  );

  // Route pour archiver un courrier entrant existant (depuis validation service)
  router.post('/archives/from-mail', authenticateToken, async (req, res) => {
    try {
      const { incoming_mail_id, classeur, category, description } = req.body;
      
      if (!incoming_mail_id) {
        return res.status(400).json({ error: 'incoming_mail_id requis' });
      }

      // Récupérer les infos du courrier
      const mail = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM incoming_mails WHERE id = ?',
          [incoming_mail_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!mail) {
        return res.status(404).json({ error: 'Courrier non trouvé' });
      }

      // Créer l'archive
      const archiveData = {
        reference: mail.ref_code,
        type: 'Courrier Entrant',
        date: mail.date_reception || mail.arrival_date || new Date().toISOString().split('T')[0],
        description: description || mail.subject || '',
        category: category || mail.category || 'Courrier Entrant',
        classeur: classeur || '',
        file_path: mail.document_path || '',
        sender: mail.sender || '',
        service_code: mail.assigned_service || mail.service_orientation_dg || 'INCONNU',
        incoming_mail_id: incoming_mail_id,
        status: 'Archivé'
      };

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO archives (
            reference, type, date, description, category, classeur,
            file_path, sender, service_code, incoming_mail_id, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            archiveData.reference,
            archiveData.type,
            archiveData.date,
            archiveData.description,
            archiveData.category,
            archiveData.classeur,
            archiveData.file_path,
            archiveData.sender,
            archiveData.service_code,
            archiveData.incoming_mail_id,
            archiveData.status
          ],
          function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Mettre à jour le statut du courrier
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE incoming_mails SET statut_global = ?, classeur = ? WHERE id = ?',
          ['Archivé', classeur, incoming_mail_id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.status(201).json({ 
        message: 'Courrier archivé avec succès',
        archive_id: this.lastID 
      });

    } catch (error) {
      console.error('Erreur archivage courrier:', error);
      res.status(500).json({ error: 'Erreur lors de l\'archivage' });
    }
  });

  router.post('/archives', authenticateToken, upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'reference', maxCount: 1 },
    { name: 'type', maxCount: 1 },
    { name: 'date', maxCount: 1 },
    { name: 'description', maxCount: 1 },
    { name: 'category', maxCount: 1 },
    { name: 'convertToPDF', maxCount: 1 },
  ]), async (req, res) => {
    try {
      if (!req.files || !req.files['file']) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      const { reference, type, date, description, category, convertToPDF } = req.body;
      if (!reference || !category) {
        return res.status(400).json({ error: 'Référence et catégorie requises' });
      }

      const file = req.files['file'][0];
      const filePath = `/uploads/${file.filename}`;
      const absolutePath = path.join(baseDir, filePath);
      const extractedText = await extractTextFromFile(absolutePath);

      const pdfPath = extractedText && convertToPDF !== 'false'
        ? `/uploads/${file.filename.replace(/\.[^/.]+$/, '')}.pdf`
        : null;
      if (pdfPath) {
        await convertDocxToPDF(absolutePath, path.join(baseDir, pdfPath));
      }

      db.run(
        `INSERT INTO archives (
          reference, type, date,
          description, category, file_path,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          reference,
          type,
          date,
          description,
          category,
          filePath,
          'Archivé',
        ],
        function (err) {
          if (err) {
            console.error('Erreur archivage:', err.message);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          res.status(201).json({ message: 'Courrier entrant archivé', id: this.lastID });
        },
      );
    } catch (error) {
      console.error('Erreur archivage:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/archives/sortants', authenticateToken, upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'reference', maxCount: 1 },
    { name: 'type', maxCount: 1 },
    { name: 'date', maxCount: 1 },
    { name: 'description', maxCount: 1 },
    { name: 'category', maxCount: 1 },
    { name: 'convertToPDF', maxCount: 1 },
  ]), async (req, res) => {
    try {
      if (!req.files || !req.files['file']) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      const { reference, type, date, description, category, convertToPDF } = req.body;
      if (!reference || !category) {
        return res.status(400).json({ error: 'Référence et catégorie requises' });
      }

      const file = req.files['file'][0];
      const filePath = `/uploads/${file.filename}`;
      const absolutePath = path.join(baseDir, filePath);
      const extractedText = await extractTextFromFile(absolutePath);

      const pdfPath = extractedText && convertToPDF !== 'false'
        ? `/uploads/${file.filename.replace(/\.[^/.]+$/, '')}.pdf`
        : null;
      if (pdfPath) {
        await convertDocxToPDF(absolutePath, path.join(baseDir, pdfPath));
      }

      db.run(
        `INSERT INTO archives (
          reference, type, date,
          description, category, file_path,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          reference,
          type,
          date,
          description,
          category,
          filePath,
          'Archivé',
        ],
        function (err) {
          if (err) {
            console.error('Erreur archivage sortant:', err.message);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          res.status(201).json({ message: 'Courrier sortant archivé', id: this.lastID });
        },
      );
    } catch (error) {
      console.error('Erreur archivage:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};
