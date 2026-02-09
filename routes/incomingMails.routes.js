const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function createIncomingMailsRoutes({
  db,
  authenticateToken,
  upload,
  generateNextHumanNumber,
  generateUniqueReference,
  generateMailQRCode,
  generateARPDF,
  analyzeDocumentAsync,
  notifyMailStatusChange,
  recordHistory,
  canTransition,
  canUserValidateAssignedService,
  notifyServiceForward,
  recordEntityHistory,
  canUserViewIncomingMail,
  getExpectedServiceForRole,
  baseDir,
}) {
  const router = express.Router();

  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });

  // --- ROUTES INCOMING_MAILS (Courriers Entrants) ---
  router.post('/mails/incoming', authenticateToken, upload.array('files', 10), async (req, res) => {
    const startedAt = Date.now();

    // Helpers locaux
    const safeJson = (obj) => {
      try {
        return JSON.stringify(obj);
      } catch {
        return String(obj);
      }
    };

    const getIncomingColumns = () =>
      new Promise((resolve, reject) => {
        db.all('PRAGMA table_info(incoming_mails)', [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map((r) => r.name));
        });
      });

    console.log('📥 [ACQUISITION] POST /api/mails/incoming');
    console.log('👤 Auth user:', req.user?.id, req.user?.email || '');
    console.log('🧾 body keys:', Object.keys(req.body || {}));
    console.log('📎 files:', (req.files || []).map((f) => ({
      originalname: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
      path: f.path,
    })));

    try {
      const body = req.body || {};
      const userId = req.user?.id || null;
      const userName = req.user?.username || req.user?.email || 'unknown';

      const cols = await getIncomingColumns().catch((e) => {
        console.error('❌ PRAGMA table_info(incoming_mails) failed:', e.message);
        return null;
      });

      if (!cols) {
        return res.status(500).json({ error: 'incoming_mails schema unreadable' });
      }

      const requiredCols = [
        'subject', 'sender', 'mail_date', 'date_reception',
        'ref_code', 'numero_acquisition', 'file_path', 'statut_global',
      ];
      const missing = requiredCols.filter((c) => !cols.includes(c));

      if (missing.length) {
        console.error('❌ incoming_mails columns missing:', missing);
        console.error('✅ existing columns:', cols);
        return res.status(500).json({
          error: 'incoming_mails schema mismatch',
          missingColumns: missing,
        });
      }

      const dateMail = (body.mail_date && String(body.mail_date).trim() !== '')
        ? body.mail_date
        : new Date().toISOString().slice(0, 10);

      const dateReception = (body.arrival_date && String(body.arrival_date).trim() !== '')
        ? body.arrival_date
        : new Date().toISOString().slice(0, 10);

      let mainFilePath = null;
      const annexeFiles = [];

      if (req.files && req.files.length > 0) {
        mainFilePath = req.files[0].path.replace(/\\/g, '/');

        if (req.files.length > 1) {
          for (let i = 1; i < req.files.length; i += 1) {
            annexeFiles.push({
              path: req.files[i].path.replace(/\\/g, '/'),
              originalname: req.files[i].originalname,
              mimetype: req.files[i].mimetype,
              size: req.files[i].size,
            });
          }
        }
      }

      let numeroAcquisition = null;
      try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const candidate = await generateNextHumanNumber({
            table: 'incoming_mails',
            column: 'numero_acquisition',
            prefix: 'ACQ',
          });
          const exists = await dbGet(
            'SELECT 1 FROM incoming_mails WHERE numero_acquisition = ? LIMIT 1',
            [candidate],
          ).catch(() => null);
          if (!exists) {
            numeroAcquisition = candidate;
            break;
          }
        }
      } catch (e) {
        console.error('❌ Erreur génération numero_acquisition:', e.message);
        return res.status(500).json({ error: "Erreur génération numéro d'acquisition." });
      }
      if (!numeroAcquisition) {
        return res.status(500).json({ error: "Impossible de générer un numéro d'acquisition." });
      }

      let reference = null;
      let uuid = null;
      try {
        const gen = await generateUniqueReference(db, 'entrant', 'incoming_mails');
        reference = gen.reference;
        uuid = gen.uuid;
      } catch (e) {
        console.error('❌ Erreur génération référence unique:', e.message);
        return res.status(500).json({ error: 'Erreur génération référence unique.' });
      }

      const sql = `
        INSERT INTO incoming_mails (
          subject, sender, mail_date, date_reception, arrival_date,
          ref_code, numero_acquisition, file_path, statut_global, comment,
          summary, annexes, id_classement, type_courrier,
          courrier_nature,
          date_annotation_dg, service_orientation_dg, annotation_dg,
          user_reception, is_mission_doc, mission_reference,
          date_retour_mission, id_type_document, classeur,
          recipient, date_indexation, date_archivage, extracted_text,
          keywords, classification, assigned_to, traitement_effectue, response_due,
          reference_unique, uuid, qr_code_path, ar_pdf_path,
          assigned_service, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const initialStatus = 'Acquis';

      const params = [
        body.subject || 'Sans objet',
        body.sender || 'Inconnu',
        dateMail,
        dateReception,
        dateReception, // arrival_date = même date que date_reception
        numeroAcquisition,
        numeroAcquisition,
        mainFilePath,
        initialStatus,
        body.comment || '',
        body.summary || '',
        body.annexes || '',
        body.id_classement || null,
        body.type_courrier || 'Externe',
        body.courrier_nature || null,
        body.date_annotation_dg || null,
        body.service_orientation_dg || null,
        body.annotation_dg || null,
        userId,
        body.is_mission_doc || 0,
        body.mission_reference || null,
        body.date_retour_mission || null,
        body.id_type_document || null,
        body.classeur || null,
        body.recipient || null,
        null,
        null,
        body.extracted_text || null,
        body.keywords || null,
        body.classification || null,
        body.assigned_to || null,
        body.traitement_effectue || null,
        body.response_due || null,
        reference,
        uuid,
        null,
        null,
        body.assigned_service || null,
        body.category || null,
      ];

      console.log('🧩 INSERT incoming_mails params.length =', params.length);

      let mailId = null;
      try {
        const r = await dbRun(sql, params);
        mailId = r.lastID;
      } catch (err) {
        console.error('❌ INSERT incoming_mails FAILED:', err.message);
        console.error('🔎 SQL:', sql);
        console.error('🔎 params.length:', params.length);
        console.error('🔎 sample params:', safeJson(params.slice(0, 8)));
        return res.status(500).json({ error: err.message });
      }

      console.log(`✅ Nouveau courrier inséré: ID=${mailId} Ref=${reference} user=${userId || 'N/A'}`);

      try {
        recordHistory(
          Number(mailId),
          'Acquisition du courrier',
          userId,
          userName,
          {
            previous_status: null,
            new_status: initialStatus,
            ref_code: numeroAcquisition,
            numero_acquisition: numeroAcquisition,
            reference_unique: reference,
            subject: body.subject || 'Sans objet',
            sender: body.sender || 'Inconnu',
            main_file_path: mainFilePath,
            files_count: (req.files || []).length,
          },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordHistory acquisition échoué:', e.message);
      }

      let annexesCount = 0;
      if (annexeFiles.length > 0) {
        const annexeSql = `
          INSERT INTO annexes (incoming_mail_id, file_path, original_filename, file_type, file_size)
          VALUES (?, ?, ?, ?, ?)
        `;
        try {
          await Promise.all(
            annexeFiles.map((annexe, idx) =>
              dbRun(annexeSql, [mailId, annexe.path, annexe.originalname, annexe.mimetype, annexe.size])
                .then(() => {
                  annexesCount += 1;
                  console.log(`📎 Annexe ${idx + 1} enregistrée: ${annexe.originalname}`);
                })
                .catch((e) => {
                  console.error(`❌ Erreur insertion annexe ${idx + 1}:`, e.message);
                }),
            ),
          );
        } catch (e) {
          console.error('❌ Annexes insertion batch error:', e.message);
        }
      }

      (async () => {
        try {
          const qrPath = await generateMailQRCode(reference, mailId);
          if (qrPath) {
            await dbRun('UPDATE incoming_mails SET qr_code_path = ? WHERE id = ?', [qrPath, mailId]);
          }

          const m2 = await dbGet(
            'SELECT id, ref_code, subject, sender, date_reception, qr_code_path FROM incoming_mails WHERE id = ?',
            [mailId],
          );
          if (m2) {
            const arPath = await generateARPDF(m2);
            if (arPath) {
              await dbRun('UPDATE incoming_mails SET ar_pdf_path = ? WHERE id = ?', [arPath, mailId]);
            }
          }
        } catch (e) {
          console.error('❌ Erreur génération QR/AR:', e.message);
        }
      })();

      const extractedText = body.extracted_text || '';
      const metadata = {
        subject: body.subject,
        sender: body.sender,
        date: body.mail_date,
        type: body.type_courrier,
      };

      analyzeDocumentAsync(db, 'incoming_mails', mailId, extractedText, metadata)
        .catch((err) => console.error('❌ Erreur analyse IA:', err));

      notifyMailStatusChange(mailId, 'Acquis', null, {})
        .catch((err) => console.error('❌ Erreur notification acquisition:', err));

      console.log(`🏁 Acquisition done in ${Date.now() - startedAt}ms`);
      return res.json({
        message: 'Courrier enregistré avec succès.',
        id: mailId,
        ref_code: numeroAcquisition,
        numero_acquisition: numeroAcquisition,
        reference,
        annexesCount,
      });
    } catch (error) {
      console.error('❌ Erreur POST /api/mails/incoming:', error.message);
      return res.status(500).json({ error: error.message || "Erreur lors de l'enregistrement." });
    }
  });

  // Route de récupération de tous les courriers (GET)
  router.get('/mails/incoming', authenticateToken, (req, res) => {
    console.log('🔍 Route /api/mails/incoming appelée');
    console.log('🔍 Query params:', req.query);

    const statusFilter = req.query.status || req.query.statut_global;
    const searchTerm = req.query.search;
    const assignedServiceFilter = req.query.assigned_service || req.query.service;
    const assignedToQuery = req.query.assigned_to;

    const isPrivilegedRead = req.user && (req.user.role_id === 1 || req.user.role_id === 2 || req.user.role_id === 7);
    const expectedSvc = getExpectedServiceForRole(req.user?.role_id);

    if (searchTerm) {
      console.log(`🔍 Recherche demandée: "${searchTerm}"`);
      const searchPattern = `%${searchTerm}%`;
      const sql = `
        SELECT 
          id, ref_code, subject, sender, recipient, 
          mail_date, 
          date_reception AS arrival_date,  
          statut_global AS status, 
          file_path, 
          summary,
          id_type_document, 
          is_mission_doc, 
          mission_reference, 
          date_retour_mission,
          classeur,
          'incoming' as source
        FROM incoming_mails
        WHERE ref_code LIKE ? OR subject LIKE ? OR sender LIKE ? OR recipient LIKE ? OR extracted_text LIKE ?

        UNION ALL

        SELECT 
          incoming_mail_id as id,
          reference as ref_code,
          description as subject,
          sender as sender,
          '' as recipient,
          date as mail_date,
          date as arrival_date,
          status as status,
          file_path,
          summary as summary,
          NULL as id_type_document,
          0 as is_mission_doc,
          '' as mission_reference,
          NULL as date_retour_mission,
          classeur,
          'archived' as source
        FROM archives
        WHERE (reference LIKE ? OR description LIKE ? OR category LIKE ?)
          AND incoming_mail_id IS NOT NULL

        UNION ALL

        SELECT
          id,
          COALESCE(reference_unique, 'CS-' || id) as ref_code,
          objet as subject,
          '' as sender,
          destinataire as recipient,
          COALESCE(date_edition, substr(created_at, 1, 10)) as mail_date,
          COALESCE(date_edition, substr(created_at, 1, 10)) as arrival_date,
          statut as status,
          COALESCE(original_file_path, preview_pdf, '') as file_path,
          COALESCE(extracted_text, '') as summary,
          NULL as id_type_document,
          0 as is_mission_doc,
          '' as mission_reference,
          NULL as date_retour_mission,
          '' as classeur,
          'outgoing' as source
        FROM courriers_sortants
        WHERE objet LIKE ? OR destinataire LIKE ? OR extracted_text LIKE ?

        UNION ALL

        SELECT 
          id,
          'OUT-' || id as ref_code,
          subject,
          '' as sender,
          recipient,
          mail_date as mail_date,
          mail_date as arrival_date,
          status,
          file_path,
          content as summary,
          NULL as id_type_document,
          0 as is_mission_doc,
          '' as mission_reference,
          NULL as date_retour_mission,
          '' as classeur,
          'outgoing_legacy' as source
        FROM outgoing_mails
        WHERE subject LIKE ? OR recipient LIKE ? OR content LIKE ?

        ORDER BY arrival_date DESC
        LIMIT 50
      `;

      const params = [
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern,
      ];

      console.log('🔍 Exécution SQL avec paramètres:', params);

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ Erreur SQL recherche:', err.message);
          console.error('❌ Code erreur:', err.code);
          console.error('❌ Errno:', err.errno);
          return res.status(500).json({ error: 'Erreur serveur lors de la recherche.' });
        }
        console.log(`✅ Recherche "${searchTerm}": ${rows.length} résultats trouvés.`);
        return res.json(rows);
      });
      return;
    }

    let sql = `
      SELECT 
        id, ref_code, subject, sender, recipient, 
        mail_date, 
        date_reception AS arrival_date,  
        statut_global AS status, 
        file_path, 
        summary,
        comment,
        assigned_service,
        assigned_to,
        id_type_document, 
        is_mission_doc, 
        mission_reference, 
        date_retour_mission,
        classeur,
        qr_code_path,
        ar_pdf_path,
        response_required,
        response_due,
        response_outgoing_id,
        response_created_at
      FROM incoming_mails
    `;

    const params = [];
    const conditions = [];

    if (statusFilter) {
      const statuses = statusFilter.split(',').map((s) => s.trim());
      const placeholders = statuses.map(() => '?').join(',');
      conditions.push(`statut_global IN (${placeholders})`);
      params.push(...statuses);
    }

    if (assignedServiceFilter) {
      const requestedService = String(assignedServiceFilter).trim().toUpperCase();
      if (!requestedService) {
        return res.status(400).json({ error: 'assigned_service invalide.' });
      }

      if (!isPrivilegedRead) {
        const roleId = req.user?.role_id;
        const allowedByRole = {
          3: ['RAF'],
          4: ['COMPTABLE'],
          5: ['CAISSE'],
          6: ['TRESORERIE'],
          7: ['SEC'],
          8: ['LOGISTIQUE'],
        };
        const allowed = allowedByRole[roleId] || [];
        if (!allowed.includes(requestedService)) {
          return res.status(403).json({ error: 'Accès interdit: filtre service non autorisé.' });
        }
      }

      conditions.push('assigned_service = ?');
      params.push(requestedService);

      if (!isPrivilegedRead) {
        const meUsername = String(req.user?.username || '').trim();
        const meId = req.user?.id != null ? String(req.user.id).trim() : '';
        const allowAdminPlaceholder = "LOWER(TRIM(assigned_to)) = 'admin'";

        if (!meUsername && !meId) {
          conditions.push(`(assigned_to IS NULL OR TRIM(assigned_to) = '' OR ${allowAdminPlaceholder})`);
        } else if (meUsername && meId) {
          conditions.push(`(assigned_to IS NULL OR TRIM(assigned_to) = '' OR ${allowAdminPlaceholder} OR TRIM(assigned_to) = ? OR TRIM(assigned_to) = ?)`);
          params.push(meUsername, meId);
        } else {
          const only = meUsername || meId;
          conditions.push(`(assigned_to IS NULL OR TRIM(assigned_to) = '' OR ${allowAdminPlaceholder} OR TRIM(assigned_to) = ?)`);
          params.push(only);
        }
      }
    }

    if (!isPrivilegedRead && expectedSvc && !assignedServiceFilter) {
      conditions.push('UPPER(TRIM(assigned_service)) = ?');
      params.push(expectedSvc);
    }

    if (assignedToQuery) {
      const isPrivilegedReadLocal = req.user && (req.user.role_id === 1 || req.user.role_id === 2 || req.user.role_id === 7);
      const wanted = String(assignedToQuery).trim();
      const targetUsername = wanted.toLowerCase() === 'me' ? (req.user?.username || '') : wanted;
      if (!targetUsername) {
        return res.status(400).json({ error: 'assigned_to invalide.' });
      }
      const effective = isPrivilegedReadLocal ? targetUsername : (req.user?.username || '');
      if (!effective) {
        return res.status(400).json({ error: 'assigned_to invalide.' });
      }
      conditions.push('assigned_to = ?');
      params.push(effective);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY date_reception DESC';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erreur SQL lors de la récupération des courriers entrants :', err.message);
        return res.status(500).json({ error: 'Erreur serveur lors du chargement des courriers.' });
      }

      console.log(`📦 Données renvoyées à Vue: ${rows.length} lignes.`);
      return res.json(rows);
    });
  });

  router.put('/mails/incoming/:id/complete-treatment', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const userName = req.user?.username;

    if (!id) return res.status(400).json({ error: 'ID manquant.' });
    if (!userName) return res.status(400).json({ error: 'Utilisateur invalide.' });

    try {
      const mail = await dbGet(
        'SELECT id, statut_global, assigned_to FROM incoming_mails WHERE id = ?',
        [Number(id)],
      );
      if (!mail) return res.status(404).json({ error: 'Courrier introuvable.' });

      const isAdminLike = req.user && (req.user.role_id === 1 || req.user.role_id === 2);
      if (!isAdminLike) {
        const assignedTo = String(mail.assigned_to || '').trim();
        const meUsername = String(userName || '').trim();
        const meId = userId != null ? String(userId).trim() : '';
        const isMine = assignedTo === meUsername || (meId && assignedTo === meId);
        if (!isMine) {
          return res.status(403).json({ error: 'Accès interdit: courrier non désigné à cet utilisateur.' });
        }
      }

      if (!['En Traitement', 'Traité'].includes(mail.statut_global)) {
        return res.status(409).json({ error: `Statut incompatible. Statut actuel: ${mail.statut_global}` });
      }
      if (!canTransition(mail.statut_global, 'Validation')) {
        return res.status(409).json({ error: 'Transition illégale vers Validation.' });
      }

      const upd = await dbRun(
        `UPDATE incoming_mails
         SET statut_global = 'Validation',
             traitement_effectue = 1,
             treatment_completed_at = COALESCE(treatment_completed_at, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        [Number(id)],
      );
      if (!upd || upd.changes === 0) return res.status(404).json({ error: 'Aucune mise à jour effectuée.' });

      await recordHistory(
        Number(id),
        'Traitement validé (service)',
        userId,
        userName,
        JSON.stringify({ previous_status: mail.statut_global, new_status: 'Validation' }),
        req,
      );

      notifyMailStatusChange(Number(id), 'Validation', userName, { validatedBy: userName }).catch(() => {});

      return res.json({ id: Number(id), message: 'Traitement validé.', new_status: 'Validation' });
    } catch (e) {
      console.error('Erreur complete-treatment:', e);
      return res.status(500).json({ error: 'Erreur serveur.', details: e.message });
    }
  });

  router.get('/mails/incoming/:id/annexes', authenticateToken, (req, res) => {
    const { id } = req.params;
    const isAdminLike = req.user && (req.user.role_id === 1 || req.user.role_id === 2);

    if (!isAdminLike) {
      db.get(
        'SELECT id, assigned_service, assigned_to FROM incoming_mails WHERE id = ?',
        [Number(id)],
        (e, mail) => {
          if (e) {
            console.error('Erreur contrôle accès annexes:', e.message);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          if (!mail) return res.status(404).json({ error: 'Courrier introuvable.' });
          if (!canUserViewIncomingMail(req.user, mail)) {
            return res.status(403).json({ error: 'Accès interdit.' });
          }

          const sql = 'SELECT id, file_path, original_filename, file_type, file_size, created_at FROM annexes WHERE incoming_mail_id = ? ORDER BY created_at ASC';
          db.all(sql, [id], (err, rows) => {
            if (err) {
              console.error('Erreur récupération annexes:', err.message);
              return res.status(500).json({ error: 'Erreur serveur' });
            }
            return res.json(rows);
          });
        },
      );
      return;
    }

    const sql = 'SELECT id, file_path, original_filename, file_type, file_size, created_at FROM annexes WHERE incoming_mail_id = ? ORDER BY created_at ASC';

    db.all(sql, [id], (err, rows) => {
      if (err) {
        console.error('Erreur récupération annexes:', err.message);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      return res.json(rows);
    });
  });

  // Route pour uploader le scan annoté avant validation
  router.post(
    '/mails/incoming/:id/upload-annotated-scan',
    authenticateToken,
    upload.single('annotated_scan'),
    async (req, res) => {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      try {
        const mail = await dbGet('SELECT id, ref_code FROM incoming_mails WHERE id = ?', [id]);
        if (!mail) {
          return res.status(404).json({ error: 'Courrier non trouvé' });
        }

        const insertSql = `
      INSERT INTO annexes (incoming_mail_id, file_path, original_filename, file_type, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;

        const result = await dbRun(insertSql, [
          id,
          file.path,
          file.originalname || 'scan_annote.pdf',
          file.mimetype,
          file.size,
        ]);

        console.log(`✅ Scan annoté uploadé pour courrier ${id}: ${file.originalname}`);

        res.json({
          message: 'Scan annoté ajouté avec succès',
          annexe_id: result.lastID,
          filename: file.originalname,
        });
      } catch (error) {
        console.error('Erreur upload scan annoté:', error);
        res.status(500).json({ error: "Erreur lors de l'upload du scan annoté" });
      }
    },
  );

  router.put('/mails/incoming/:id/index', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { ref_code, subject, sender, arrival_date, comment, assigned_to, recipient } = req.body;
    const userId = req.user.id;
    const userName = req.user.username;

    const sql = `
    UPDATE incoming_mails
    SET 
      ref_code = COALESCE(?, ref_code),
      subject = COALESCE(?, subject),
      sender = COALESCE(?, sender),
      date_reception = COALESCE(?, date_reception),
      statut_global = 'Indexé',
      date_indexation = datetime('now'),
      comment = COALESCE(?, comment),
      assigned_to = COALESCE(?, assigned_to),
      recipient = COALESCE(?, recipient)
    WHERE id = ?
  `;
    const params = [
      ref_code || null,
      subject || null,
      sender || null,
      arrival_date || null,
      comment || null,
      assigned_to || userName || null,
      recipient || null,
      id,
    ];

    db.run(sql, params, function (err) {
      if (err) {
        console.error(`Erreur indexation courrier ${id}: ${err.message}`);
        return res.status(500).json({ error: "Erreur lors de l'indexation." });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Courrier non trouvé.' });
      }

      recordHistory(id, 'Statut mis à Indexé', userId, userName, JSON.stringify({ assigned_to: assigned_to || userName, comment }), req);

      notifyMailStatusChange(id, 'Indexé', assigned_to || userName, {}).catch((err2) =>
        console.error('Erreur notification indexation:', err2),
      );

      res.json({ id, message: 'Courrier indexé avec succès.' });
    });
  });

  router.put('/mails/incoming/:id/process', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { comment, response_due, assigned_service, assigned_to, category } = req.body;
    const userId = req.user.id;
    const userName = req.user.username;

    if (!assigned_service) {
      return res.status(400).json({ error: 'assigned_service est requis.' });
    }

    const sql = `
    UPDATE incoming_mails
    SET 
      statut_global = 'En Traitement', 
      comment = ?,
      assigned_to = ?,
      response_due = ?,
      assigned_service = ?,
      category = ?,
      treatment_started_at = COALESCE(treatment_started_at, CURRENT_TIMESTAMP)
    WHERE id = ? AND statut_global = 'Indexé'
  `;
    const assignedToValue =
      assigned_to != null && String(assigned_to).trim() !== '' ? String(assigned_to).trim() : null;
    const params = [comment || null, assignedToValue, response_due || null, String(assigned_service).trim().toUpperCase(), category || null, id];

    db.run(sql, params, function (err) {
      if (err) {
        console.error(`Erreur mise en traitement courrier ${id}: ${err.message}`);
        return res.status(500).json({ error: 'Erreur lors de la mise en traitement.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Courrier non trouvé ou statut incorrect (doit être "Indexé").' });
      }

      const details = JSON.stringify({
        comment,
        response_due: response_due || null,
        assigned_to: assignedToValue,
        assigned_service: String(assigned_service).trim().toUpperCase(),
        old_status: 'Indexé',
        new_status: 'En Traitement',
      });
      recordHistory(id, 'Statut mis à En Traitement', userId, userName, details, req);

      notifyServiceForward({
        mailId: Number(id),
        serviceCode: String(assigned_service).trim().toUpperCase(),
        forwardedByUsername: userName,
      }).catch((err2) => console.error('Erreur notification service process:', err2));

      res.json({ id, message: 'Courrier mis en traitement avec succès.' });
    });
  });

  router.put('/mails/incoming/:id/treatment-action', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { action, comment } = req.body || {};
    const userId = req.user.id;
    const userName = req.user.username;

    if (!action || !['execute', 'return', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide. Utiliser execute | return | reject.' });
    }

    try {
      const mail = await dbGet('SELECT id, statut_global, assigned_service FROM incoming_mails WHERE id = ?', [id]);

      if (!mail) {
        return res.status(404).json({ error: 'Courrier introuvable.' });
      }

      const previousStatus = mail.statut_global;

      const allowedFrom = action === 'execute' ? ['En Traitement'] : ['Validation', 'Traité', 'En Traitement'];

      if (!allowedFrom.includes(previousStatus)) {
        return res.status(409).json({
          error: `Statut incompatible pour l'action '${action}'. Statut actuel: ${previousStatus}.`,
        });
      }

      if (['return', 'reject'].includes(action) && ['Validation', 'Traité'].includes(previousStatus)) {
        const svc = String(mail.assigned_service || '').trim().toUpperCase();
        if (!canUserValidateAssignedService(req.user, svc)) {
          return res
            .status(403)
            .json({ error: `Accès interdit: validation réservée au service '${svc || 'N/A'}' (admin uniquement pour SEC).` });
        }
      }

      let updateSql = '';
      let params = [];
      let historyLabel = '';
      let detailsObj = { previous_status: previousStatus, performed_by: userName };
      let nextStatus = '';

      if (action === 'execute') {
        console.log(`🔵 Action EXECUTE appelée pour courrier ID ${id}`);

        nextStatus = 'Validation';

        if (!canTransition(previousStatus, nextStatus)) {
          console.log(`❌ Transition illégale: ${previousStatus} -> ${nextStatus}`);
          return res.status(409).json({ error: `Transition illégale vers ${nextStatus}.` });
        }

        console.log(`✅ Transition autorisée: ${previousStatus} -> ${nextStatus}`);

        const mailData = await dbGet('SELECT * FROM incoming_mails WHERE id = ?', [id]);

        if (!mailData) {
          console.error('❌ Erreur récupération courrier: Données manquantes.');
          return res.status(500).json({ error: 'Erreur récupération courrier.' });
        }

        const updateSql = `UPDATE incoming_mails SET statut_global = ?, treatment_completed_at = datetime('now'), comment = COALESCE(?, comment) WHERE id = ?`;
        const updateParams = [nextStatus, comment || null, id];

        const result = await dbRun(updateSql, updateParams);
        if (result.changes === 0) {
          return res.status(404).json({ error: 'Aucune mise à jour effectuée.' });
        }

        const historyDetails = JSON.stringify({
          previous_status: previousStatus,
          new_status: nextStatus,
          executed_task: comment || 'Traitement exécuté',
        });
        await recordHistory(id, 'Traitement exécuté - en attente de validation', userId, userName, historyDetails, req);

        let createdOutgoing = null;
        try {
          const responseRequired = Number(mailData?.response_required || 0) === 1;
          const alreadyLinked = mailData?.response_outgoing_id != null && Number(mailData.response_outgoing_id) > 0;
          if (responseRequired && !alreadyLinked) {
            const incomingRef = mailData?.ref_code || mailData?.numero_acquisition || mailData?.reference_unique || `MAIL-${id}`;
            const subjectText = String(mailData?.subject || 'Sans objet');
            const outgoingSubject = `Réponse à ${incomingRef} - ${subjectText}`.slice(0, 250);
            const recipient = String(mailData?.sender || mailData?.recipient || 'Inconnu').trim() || 'Inconnu';
            const dateEdition = new Date().toISOString().split('T')[0];
            const payload = {
              recipient,
              destinataire: recipient,
              subject: outgoingSubject,
              objet: outgoingSubject,
              date_edition: dateEdition,
              content: null,
              source_incoming_id: Number(id),
              source_incoming_ref: incomingRef,
            };

            const gen = await generateUniqueReference(db, 'sortant', 'courriers_sortants');
            const ins = await dbRun(
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
                userId || 1,
                JSON.stringify(payload),
                '',
                null,
                null,
                recipient,
                outgoingSubject,
                dateEdition,
                gen.reference,
                gen.uuid,
              ],
            );

            const outgoingId = ins.lastID;
            await dbRun(
              `UPDATE incoming_mails
                   SET response_outgoing_id = ?,
                       response_created_at = COALESCE(response_created_at, datetime('now'))
                   WHERE id = ?`,
              [outgoingId, Number(id)],
            );

            try {
              recordEntityHistory(
                'courriers_sortants',
                outgoingId,
                'Brouillon de réponse auto-créé (entrant)',
                userId,
                userName,
                { incoming_mail_id: Number(id), incoming_ref: incomingRef, reference_unique: gen.reference, statut: 'brouillon' },
                req,
              );
            } catch (_) {}

            await recordHistory(Number(id), 'Réponse sortante auto-créée', userId, userName, { response_outgoing_id: outgoingId, reference_unique: gen.reference }, req);

            createdOutgoing = { id: outgoingId, reference_unique: gen.reference, uuid: gen.uuid };
          }
        } catch (e) {
          console.warn('⚠️ Auto-création brouillon sortant échouée:', e.message);
        }

        notifyMailStatusChange(id, nextStatus, null, { executedTask: comment }).catch((err2) => {
          console.error('Erreur notification traitement:', err2);
        });

        console.log(`🎯 Workflow execute finalisé: courrier ${id} envoyé en validation`);

        return res.json({
          id,
          action: 'execute',
          message: 'Traitement exécuté avec succès. Courrier en attente de validation.',
          new_status: nextStatus,
          response_outgoing: createdOutgoing,
        });
      } else if (action === 'return') {
        nextStatus = 'Indexé';
        updateSql = `UPDATE incoming_mails
                         SET statut_global = 'Indexé',
                             return_comment = ?,
                             comment = COALESCE(?, comment),
                             traitement_effectue = 0,
                             treatment_completed_at = NULL
                         WHERE id = ?`;
        params = [comment || null, comment || null, id];
        historyLabel = 'Courrier retourné à l’indexation';

        detailsObj.new_status = nextStatus;
        if (comment) detailsObj.return_comment = comment;
      } else if (action === 'reject') {
        nextStatus = 'Rejeté';
        updateSql = `UPDATE incoming_mails SET statut_global = 'Rejeté', rejection_reason = ? WHERE id = ?`;
        params = [comment || null, id];
        historyLabel = 'Courrier rejeté';
        detailsObj.new_status = nextStatus;
        if (comment) detailsObj.rejection_reason = comment;
      }

      if (!canTransition(previousStatus, nextStatus)) {
        return res.status(409).json({ error: `Transition illégale vers ${nextStatus}.` });
      }

      const result = await dbRun(updateSql, params);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Aucune mise à jour effectuée.' });
      }

      await recordHistory(id, historyLabel, userId, userName, JSON.stringify(detailsObj), req);

      if (action === 'return') {
        notifyMailStatusChange(id, 'Retourné', null, { returnComment: comment }).catch((err2) => {
          console.error('Erreur notification retour:', err2);
        });
      } else if (action === 'reject') {
        notifyMailStatusChange(id, 'Rejeté', null, { rejectionReason: comment }).catch((err2) => {
          console.error('Erreur notification rejet:', err2);
        });
      }

      return res.json({ id, message: `Action '${action}' effectuée avec succès.`, new_status: nextStatus });
    } catch (error) {
      console.error(`❌ Erreur fatale dans l'endpoint traitement pour ID ${id} (${action}):`, error);
      return res.status(500).json({
        error: `Erreur interne du serveur lors de l'action ${action}.`,
        details: error && error.message ? error.message : error,
        stack: error && error.stack ? error.stack : null,
      });
    }
  });

  router.put('/mails/incoming/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    const {
      ref_code,
      summary,
      status,
      indexed_function_id,
      urgent,
      response_required,
      response_due,
      response_outgoing_id,
      response_created_at,
    } = req.body || {};

    const setParts = [];
    const params = [];

    if (ref_code !== undefined) {
      setParts.push('ref_code = ?');
      params.push(ref_code);
    }

    if (summary !== undefined) {
      setParts.push('summary = ?');
      params.push(summary);
    }

    if (indexed_function_id !== undefined) {
      setParts.push('indexed_function_id = ?');
      params.push(indexed_function_id);
      
      // 🆕 Récupérer le code du service et mettre à jour assigned_service
      try {
        const service = await dbGet('SELECT code FROM services WHERE id = ?', [indexed_function_id]);
        if (service && service.code) {
          setParts.push('assigned_service = ?');
          params.push(service.code);
        }
      } catch (err) {
        console.error('Erreur récupération du service:', err.message);
      }
    }

    if (urgent !== undefined) {
      setParts.push('urgent = ?');
      params.push(urgent);
    }

    if (response_required !== undefined) {
      setParts.push('response_required = ?');
      params.push(response_required);
    }

    if (response_due !== undefined) {
      setParts.push('response_due = ?');
      params.push(response_due);
    }

    if (response_outgoing_id !== undefined) {
      setParts.push('response_outgoing_id = ?');
      params.push(response_outgoing_id);
    }

    if (response_created_at !== undefined) {
      setParts.push('response_created_at = ?');
      params.push(response_created_at);
    }

    if (status !== undefined) {
      setParts.push('statut_global = ?');
      params.push(status);

      const normalized = String(status || '').toLowerCase();
      if (normalized === 'indexé' || normalized === 'indexe') {
        setParts.push('date_indexation = CURRENT_TIMESTAMP');
      }
    }

    if (!setParts.length) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
    }

    const sql = `UPDATE incoming_mails SET ${setParts.join(', ')} WHERE id = ?`;
    params.push(id);

    db.run(sql, params, function (err) {
      if (err) {
        console.error('Erreur SQL lors de la mise à jour incoming_mails:', err.message);
        return res.status(500).json({ error: `Erreur mise à jour courrier. Détail : ${err.message}` });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Courrier non trouvé.' });
      }
      res.json({ message: `Courrier ID ${id} mis à jour.`, changes: this.changes });
    });
  });

  router.get('/mails/incoming/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const mail = await dbGet(
        `SELECT
          id, ref_code,
          numero_acquisition, numero_finance, numero_archivage_general,
          subject, sender, recipient,
          mail_date, date_reception AS arrival_date,
          statut_global AS status,
          file_path, summary, comment,
          assigned_service, assigned_to,
          response_due, response_required, response_outgoing_id, response_created_at,
          id_type_document, is_mission_doc, mission_reference, date_retour_mission,
          classeur, qr_code_path, ar_pdf_path
        FROM incoming_mails
        WHERE id = ?`,
        [Number(id)],
      );
      if (!mail) return res.status(404).json({ error: 'Courrier introuvable.' });

      const annexes = await new Promise((resolve) => {
        db.all(
          'SELECT id, file_path, original_filename, file_type, file_size, created_at FROM annexes WHERE incoming_mail_id = ? ORDER BY created_at ASC',
          [Number(id)],
          (err, rows) => {
            if (err) return resolve([]);
            resolve(rows || []);
          },
        );
      });

      if (!canUserViewIncomingMail(req.user, mail)) {
        return res.status(403).json({ error: 'Accès interdit.' });
      }

      return res.json({ mail, annexes });
    } catch (e) {
      console.error('Erreur GET incoming mail detail:', e);
      return res.status(500).json({ error: 'Erreur serveur.', details: e.message });
    }
  });

  // Route pour télécharger le fichier d'un courrier entrant
  router.get('/mails/incoming/:id/download', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      const mail = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, file_path, subject, ref_code FROM incoming_mails WHERE id = ?',
          [Number(id)],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!mail) {
        return res.status(404).json({ error: 'Courrier non trouvé' });
      }

      if (!mail.file_path) {
        return res.status(404).json({ error: 'Aucun document à télécharger' });
      }

      // Gérer les chemins absolus (depuis adiutorai-2026-1) ou relatifs
      let filePath;
      if (mail.file_path.startsWith('C:') || mail.file_path.startsWith('D:') || mail.file_path.startsWith('/')) {
        // Chemin absolu - l'utiliser directement
        filePath = mail.file_path.replace(/\//g, '\\');
      } else {
        // Chemin relatif - le joindre avec baseDir/uploads
        filePath = path.join(baseDir, 'uploads', mail.file_path.replace(/^\/uploads\//i, ''));
      }
      
      // Vérifier que le fichier existe
      if (!fs.existsSync(filePath)) {
        console.error('Fichier non trouvé:', filePath);
        return res.status(404).json({ error: 'Fichier non trouvé sur le serveur' });
      }

      // Générer le nom du fichier à partir du ref_code ou subject
      const baseName = mail.ref_code || `courrier_${id}`;
      const fileName = `${baseName}${path.extname(filePath)}`;
      
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Erreur téléchargement:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Erreur lors du téléchargement' });
          }
        }
      });

    } catch (error) {
      console.error('Erreur téléchargement courrier:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
      }
    }
  });

  return router;
};
