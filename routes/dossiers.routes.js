const express = require('express');

module.exports = function dossiersRoutes({ authenticateToken, db }) {
  const router = express.Router();

  router.get('/functions', authenticateToken, (req, res) => {
    const sql = 'SELECT id, title, title_complete FROM fonctions ORDER BY title_complete';

    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des fonctions:', err.message);
        return res.status(500).json({ error: 'Erreur serveur lors du chargement des fonctions.' });
      }
      res.json(rows);
    });
  });

  router.get('/courriers/reference/:ref', authenticateToken, (req, res) => {
    const { ref } = req.params;

    if (!ref) {
      return res.status(400).json({ error: 'Référence manquante' });
    }

    const tables = [
      { name: 'incoming_mails', type: 'entrant' },
      { name: 'courriers_sortants', type: 'sortant' },
      { name: 'archives', type: 'archive' },
    ];

    let found = false;
    let completed = 0;

    tables.forEach(({ name, type }) => {
      db.get(`SELECT * FROM ${name} WHERE reference_unique = ? LIMIT 1`, [ref], (err, row) => {
        completed += 1;

        if (err) {
          console.error(`Erreur recherche dans ${name}:`, err.message);
        }

        if (row && !found) {
          found = true;
          return res.json({
            found: true,
            type: type,
            table: name,
            document: row,
          });
        }

        if (completed === tables.length && !found) {
          return res.status(404).json({
            found: false,
            message: 'Aucun document trouvé avec cette référence',
          });
        }
      });
    });
  });

  router.get('/dossiers/:key/timeline', authenticateToken, async (req, res) => {
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: 'Identifiant dossier manquant' });

    const isNumericKey = /^\d+$/.test(String(key));
    const numericId = isNumericKey ? Number(key) : null;

    const dbGet = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

    const dbAll = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

    const safeJsonParse = (value) => {
      if (!value || typeof value !== 'string') return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const normalizeType = (action) => {
      const a = String(action || '').toLowerCase();
      if (a.includes('envoy')) return 'envoi';
      if (a.includes('rejet')) return 'rejet';
      if (a.includes('valid')) return 'validation';
      if (a.includes('archiv')) return 'archivage';
      if (a.includes('réception') || a.includes('reception')) return 'reception';
      if (a.includes('cré') || a.includes('create') || a.includes('creation')) return 'creation';
      if (a.includes('consult')) return 'consultation';
      if (a.includes('comment')) return 'commentaire';
      return 'modification';
    };

    const normalizePriority = (type, urgentFlag) => {
      if (type === 'rejet') return 'high';
      if (urgentFlag) return 'urgent';
      return 'normal';
    };

    try {
      const incoming = await dbGet(
        `SELECT * FROM incoming_mails
       WHERE (? IS NOT NULL AND id = ?)
          OR ref_code = ?
          OR reference_unique = ?
          OR uuid = ?
       LIMIT 1`,
        [numericId, numericId, key, key, key],
      );

      const outgoing = await dbGet(
        `SELECT * FROM courriers_sortants
       WHERE (? IS NOT NULL AND id = ?)
          OR reference_unique = ?
          OR uuid = ?
       LIMIT 1`,
        [numericId, numericId, key, key],
      );

      if (!incoming && !outgoing) {
        return res.status(404).json({ error: 'Dossier non trouvé' });
      }

      let linkedIncoming = incoming;
      let linkedOutgoing = outgoing;

      if (linkedIncoming && !linkedOutgoing && linkedIncoming.reference_unique) {
        linkedOutgoing = await dbGet('SELECT * FROM courriers_sortants WHERE reference_unique = ? LIMIT 1', [
          linkedIncoming.reference_unique,
        ]);
      }
      if (linkedOutgoing && !linkedIncoming && linkedOutgoing.reference_unique) {
        linkedIncoming = await dbGet('SELECT * FROM incoming_mails WHERE reference_unique = ? LIMIT 1', [
          linkedOutgoing.reference_unique,
        ]);
      }

      let archiveRow = null;
      if (linkedIncoming && linkedIncoming.id != null) {
        archiveRow = await dbGet(
          'SELECT * FROM archives WHERE incoming_mail_id = ? ORDER BY datetime(created_at) DESC LIMIT 1',
          [linkedIncoming.id],
        ).catch(() => null);
      }

      let historyRows = [];
      try {
        const parts = [];
        if (linkedIncoming?.id != null) {
          parts.push(
            ...(await dbAll('SELECT * FROM entity_history WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC', [
              'incoming_mails',
              String(linkedIncoming.id),
            ])),
          );
        }
        if (linkedOutgoing?.id != null) {
          parts.push(
            ...(await dbAll('SELECT * FROM entity_history WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC', [
              'courriers_sortants',
              String(linkedOutgoing.id),
            ])),
          );
        }
        if (linkedIncoming?.id != null) {
          const legacy = await dbAll(
            `
          SELECT
            id,
            'incoming_mails' AS entity_type,
            CAST(mail_id AS TEXT) AS entity_id,
            action,
            user_id,
            user_name,
            timestamp,
            details,
            ip_address,
            user_agent,
            action_hash
          FROM mail_history
          WHERE mail_id = ?
          ORDER BY timestamp DESC
          `,
            [linkedIncoming.id],
          );

          const existingHashes = new Set((parts || []).map((r) => String(r?.action_hash || '')).filter(Boolean));
          for (const r of legacy || []) {
            const h = String(r?.action_hash || '');
            if (h && existingHashes.has(h)) continue;
            parts.push(r);
          }
        }

        historyRows = parts;
      } catch (e) {
        console.warn('⚠️ entity_history indisponible, fallback mail_history:', e.message);
        if (linkedIncoming?.id != null) {
          historyRows = await dbAll(
            `
          SELECT
            id,
            'incoming_mails' AS entity_type,
            CAST(mail_id AS TEXT) AS entity_id,
            action,
            user_id,
            user_name,
            timestamp,
            details,
            ip_address,
            user_agent,
            action_hash
          FROM mail_history
          WHERE mail_id = ?
          ORDER BY timestamp DESC
          `,
            [linkedIncoming.id],
          );
        }
      }

      const dossierRef =
        linkedIncoming?.reference_unique ||
        linkedOutgoing?.reference_unique ||
        linkedIncoming?.ref_code ||
        linkedOutgoing?.uuid ||
        linkedIncoming?.uuid ||
        String(key);

      const urgentFlag = Boolean(linkedIncoming?.urgent);

      const events = [];
      const seen = new Set();

      const addEvent = ({ id, type, priority, title, description, timestamp, user, metadata, actions }) => {
        if (!timestamp) return;
        const keySig = `${type}|${timestamp}|${title}`;
        if (seen.has(keySig)) return;
        seen.add(keySig);
        events.push({
          id,
          type,
          priority,
          title,
          description,
          timestamp,
          user: user || null,
          metadata: metadata || null,
          actions: actions || [],
        });
      };

      if (linkedIncoming) {
        const isInterne = String(linkedIncoming.type_courrier || '').toLowerCase() === 'interne';
        addEvent({
          id: `incoming-${linkedIncoming.id}-reception`,
          type: 'reception',
          priority: normalizePriority('reception', urgentFlag),
          title: isInterne ? 'Courrier interne créé' : 'Courrier reçu',
          description: linkedIncoming.subject
            ? `Objet: ${linkedIncoming.subject}`
            : isInterne
              ? 'Création du courrier interne'
              : 'Réception du courrier entrant',
          timestamp: linkedIncoming.date_reception || linkedIncoming.mail_date,
          user: null,
          metadata: {
            dossier: dossierRef,
            source: 'incoming_mails',
            ref_code: linkedIncoming.ref_code || null,
            reference_unique: linkedIncoming.reference_unique || null,
            uuid: linkedIncoming.uuid || null,
            sender: linkedIncoming.sender || null,
            recipient: linkedIncoming.recipient || null,
          },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-indexation`,
          type: 'modification',
          priority: normalizePriority('modification', urgentFlag),
          title: 'Indexé',
          description: 'Courrier enregistré dans le système',
          timestamp: linkedIncoming.date_indexation,
          metadata: { dossier: dossierRef, source: 'incoming_mails' },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-annotation-dg`,
          type: 'commentaire',
          priority: normalizePriority('commentaire', urgentFlag),
          title: 'Annotation DG',
          description:
            linkedIncoming.annotation_dg ||
            (linkedIncoming.service_orientation_dg
              ? `Orientation: ${linkedIncoming.service_orientation_dg}`
              : 'Annotation enregistrée'),
          timestamp: linkedIncoming.date_annotation_dg,
          metadata: {
            dossier: dossierRef,
            source: 'incoming_mails',
            service_orientation_dg: linkedIncoming.service_orientation_dg || null,
          },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-treatment-start`,
          type: 'modification',
          priority: normalizePriority('modification', urgentFlag),
          title: 'En traitement',
          description: linkedIncoming.assigned_service
            ? `Assigné au service ${linkedIncoming.assigned_service}`
            : 'Traitement démarré',
          timestamp: linkedIncoming.treatment_started_at || linkedIncoming.service_disposition_at,
          metadata: {
            dossier: dossierRef,
            source: 'incoming_mails',
            assigned_service: linkedIncoming.assigned_service || null,
          },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-treatment-complete`,
          type: 'modification',
          priority: normalizePriority('modification', urgentFlag),
          title: 'Traitement terminé',
          description: 'Traitement terminé, prêt pour validation',
          timestamp: linkedIncoming.treatment_completed_at,
          metadata: { dossier: dossierRef, source: 'incoming_mails' },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-finance`,
          type: 'notification',
          priority: normalizePriority('notification', urgentFlag),
          title: 'Finance reçue',
          description: 'Courrier transmis/traité par la finance',
          timestamp: linkedIncoming.financial_received_at,
          metadata: { dossier: dossierRef, source: 'incoming_mails' },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-ai`,
          type: 'system',
          priority: 'low',
          title: 'Analyse IA',
          description: linkedIncoming.ai_summary ? `Résumé: ${linkedIncoming.ai_summary}` : 'Analyse IA effectuée',
          timestamp: linkedIncoming.analyzed_at,
          metadata: { dossier: dossierRef, source: 'incoming_mails', ai_priority: linkedIncoming.ai_priority || null },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-partial-archive`,
          type: 'archivage',
          priority: normalizePriority('archivage', urgentFlag),
          title: 'Archivage partiel',
          description: 'Archivage partiel du dossier',
          timestamp: linkedIncoming.partial_archive_date,
          metadata: { dossier: dossierRef, source: 'incoming_mails' },
        });

        addEvent({
          id: `incoming-${linkedIncoming.id}-archivage`,
          type: 'archivage',
          priority: normalizePriority('archivage', urgentFlag),
          title: 'Archivé',
          description: 'Archivage du dossier',
          timestamp: linkedIncoming.archived_at || linkedIncoming.date_archivage,
          metadata: { dossier: dossierRef, source: 'incoming_mails' },
        });
      }

      if (linkedOutgoing) {
        addEvent({
          id: `outgoing-${linkedOutgoing.id}-creation`,
          type: 'creation',
          priority: normalizePriority('creation', false),
          title: 'Courrier sortant créé',
          description: linkedOutgoing.objet ? `Objet: ${linkedOutgoing.objet}` : 'Création du courrier sortant',
          timestamp: linkedOutgoing.created_at,
          metadata: {
            dossier: dossierRef,
            source: 'courriers_sortants',
            reference_unique: linkedOutgoing.reference_unique || null,
            uuid: linkedOutgoing.uuid || null,
            destinataire: linkedOutgoing.destinataire || null,
          },
        });

        addEvent({
          id: `outgoing-${linkedOutgoing.id}-validation`,
          type: 'validation',
          priority: 'normal',
          title: 'Courrier sortant validé',
          description: 'Validation du courrier sortant',
          timestamp: linkedOutgoing.validated_at,
          metadata: { dossier: dossierRef, source: 'courriers_sortants', validated_by: linkedOutgoing.validated_by || null },
        });

        if (linkedOutgoing.scanned_receipt_path) {
          addEvent({
            id: `outgoing-${linkedOutgoing.id}-scan-ar`,
            type: 'modification',
            priority: 'normal',
            title: 'AR scanné',
            description: 'Accusé de réception scanné ajouté',
            timestamp: linkedOutgoing.updated_at,
            metadata: { dossier: dossierRef, source: 'courriers_sortants', scanned_receipt_path: linkedOutgoing.scanned_receipt_path },
          });
        }
      }

      if (archiveRow) {
        addEvent({
          id: `archive-${archiveRow.id}-archivage`,
          type: 'archivage',
          priority: 'normal',
          title: 'Archive créée',
          description: archiveRow.description || 'Archivage dans les archives',
          timestamp: archiveRow.created_at || archiveRow.date,
          metadata: { dossier: dossierRef, source: 'archives', reference: archiveRow.reference || null },
        });
      }

      for (const h of historyRows) {
        const detailsObj = safeJsonParse(h.details);
        const source = detailsObj?.source || h.entity_type || null;
        const type = normalizeType(h.action);
        const priority = normalizePriority(type, urgentFlag);
        const detailsText =
          typeof h.details === 'string' && h.details.trim()
            ? h.details.length > 240
              ? `${h.details.slice(0, 240)}…`
              : h.details
            : null;

        addEvent({
          id: `history-${h.entity_type || 'unknown'}-${h.id}`,
          type,
          priority,
          title: h.action || 'Action',
          description: detailsText || 'Action enregistrée',
          timestamp: h.timestamp,
          user: h.user_name || null,
          metadata: {
            dossier: dossierRef,
            source: source || 'entity_history',
            entity_type: h.entity_type || null,
            entity_id: h.entity_id || null,
            ip_address: h.ip_address || null,
          },
        });
      }

      events.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
      });

      return res.json({
        dossier: {
          key: String(key),
          reference: dossierRef,
          incoming_id: linkedIncoming?.id ?? null,
          outgoing_id: linkedOutgoing?.id ?? null,
          reference_unique: linkedIncoming?.reference_unique || linkedOutgoing?.reference_unique || null,
          uuid: linkedIncoming?.uuid || linkedOutgoing?.uuid || null,
        },
        events,
      });
    } catch (err) {
      console.error('Erreur timeline dossier:', err.message);
      return res.status(500).json({ error: 'Erreur serveur lors de la génération de la timeline.' });
    }
  });

  return router;
};
