const express = require('express');
const router = express.Router();

module.exports = ({ db, authenticateToken }) => {
  
  // Partager un courrier avec un ou plusieurs services
  router.post('/mails/:id/share', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { service_codes, message, share_type } = req.body;
      const userId = req.user.id;

      console.log('📤 PARTAGE COURRIER:', { id, service_codes, message, share_type, userId });

      if (!service_codes || !Array.isArray(service_codes) || service_codes.length === 0) {
        return res.status(400).json({ error: 'Vous devez sélectionner au moins un service' });
      }

      // Vérifier que le courrier existe
      const mail = await new Promise((resolve, reject) => {
        db.get('SELECT id, assigned_service FROM incoming_mails WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      console.log('📧 Courrier trouvé:', mail);

      if (!mail) {
        return res.status(404).json({ error: 'Courrier non trouvé' });
      }

      // Insérer les partages
      const shares = [];
      for (const serviceCode of service_codes) {
        console.log('📝 Insertion partage pour service:', serviceCode);
        const result = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO mail_shares 
            (incoming_mail_id, shared_by_user_id, shared_from_service, shared_to_service, share_message, share_type, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [id, userId, mail.assigned_service, serviceCode, message || '', share_type || 'info'],
            function(err) {
              if (err) reject(err);
              else resolve({ id: this.lastID });
            }
          );
        });
        console.log('✅ Partage créé avec ID:', result.id);
        shares.push(result);
      }

      console.log('🎉 Tous les partages créés:', shares);

      res.json({ 
        success: true, 
        message: `Courrier partagé avec ${service_codes.length} service(s)`,
        shares 
      });

    } catch (error) {
      console.error('Erreur partage courrier:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Obtenir les courriers partagés avec mon service
  router.get('/mails/shared', authenticateToken, async (req, res) => {
    try {
      const { service, status } = req.query;

      if (!service) {
        return res.status(400).json({ error: 'Le code du service est requis' });
      }

      let sql = `
        SELECT 
          ms.id as share_id,
          ms.incoming_mail_id,
          ms.shared_from_service,
          ms.share_message,
          ms.share_type,
          ms.status as share_status,
          ms.created_at as shared_at,
          ms.read_at,
          im.ref_code,
          im.subject,
          im.sender,
          im.mail_date,
          im.file_path,
          im.statut_global,
          u.full_name as shared_by_name,
          u.email as shared_by_email,
          (SELECT COUNT(*) FROM mail_share_comments WHERE mail_share_id = ms.id) as comment_count
        FROM mail_shares ms
        LEFT JOIN incoming_mails im ON ms.incoming_mail_id = im.id
        LEFT JOIN users u ON ms.shared_by_user_id = u.id
        WHERE ms.shared_to_service = ?
      `;
      const params = [service];

      if (status) {
        sql += ' AND ms.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY ms.created_at DESC';

      const shares = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      res.json(shares);

    } catch (error) {
      console.error('Erreur récupération courriers partagés:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Marquer un partage comme lu
  router.put('/mails/shared/:shareId/read', authenticateToken, async (req, res) => {
    try {
      const { shareId } = req.params;

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE mail_shares SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND read_at IS NULL',
          [shareId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({ success: true });

    } catch (error) {
      console.error('Erreur marquage lu:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Ajouter un commentaire/contribution
  router.post('/mails/shared/:shareId/comments', authenticateToken, async (req, res) => {
    try {
      const { shareId } = req.params;
      const { comment, comment_type, service_code } = req.body;
      const userId = req.user.id;

      if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
      }

      // Récupérer le mail_id depuis le share
      const share = await new Promise((resolve, reject) => {
        db.get('SELECT incoming_mail_id FROM mail_shares WHERE id = ?', [shareId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!share) {
        return res.status(404).json({ error: 'Partage non trouvé' });
      }

      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO mail_share_comments 
          (mail_share_id, incoming_mail_id, user_id, service_code, comment_text, comment_type)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [shareId, share.incoming_mail_id, userId, service_code, comment.trim(), comment_type || 'comment'],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      // Mettre à jour le statut du partage
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE mail_shares SET responded_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
          [comment_type === 'response' ? 'responded' : 'in_progress', shareId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({ success: true, comment_id: result.id });

    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Obtenir les commentaires d'un partage
  router.get('/mails/shared/:shareId/comments', authenticateToken, async (req, res) => {
    try {
      const { shareId } = req.params;

      const comments = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            msc.*,
            u.full_name,
            u.email
          FROM mail_share_comments msc
          LEFT JOIN users u ON msc.user_id = u.id
          WHERE msc.mail_share_id = ?
          ORDER BY msc.created_at ASC`,
          [shareId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      res.json(comments);

    } catch (error) {
      console.error('Erreur récupération commentaires:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // Obtenir le détail d'un partage
  router.get('/mails/shared/:shareId', authenticateToken, async (req, res) => {
    try {
      const { shareId } = req.params;

      const share = await new Promise((resolve, reject) => {
        db.get(
          `SELECT 
            ms.*,
            im.ref_code,
            im.subject,
            im.sender,
            im.mail_date,
            im.file_path,
            im.statut_global,
            im.summary,
            u.full_name as shared_by_name,
            u.email as shared_by_email
          FROM mail_shares ms
          LEFT JOIN incoming_mails im ON ms.incoming_mail_id = im.id
          LEFT JOIN users u ON ms.shared_by_user_id = u.id
          WHERE ms.id = ?`,
          [shareId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!share) {
        return res.status(404).json({ error: 'Partage non trouvé' });
      }

      res.json(share);

    } catch (error) {
      console.error('Erreur récupération partage:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  return router;
};
