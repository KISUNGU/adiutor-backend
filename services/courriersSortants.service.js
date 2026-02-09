const path = require('path');
const createCourriersSortantsRepo = require('../db/courriersSortantsRepo');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const safeJsonParse = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseCourrierRow = (r) => {
  const entete = safeJsonParse(r.entete);
  const courrier = safeJsonParse(r.courrier);
  const pied = safeJsonParse(r.pied);
  return {
    id: r.id,
    user_id: r.user_id,
    entete,
    courrier,
    pied,
    logo: r.logo,
    statut: r.statut,
    reference_unique: r.reference_unique || null,
    uuid: r.uuid || null,
    original_filename: r.original_filename || null,
    preview_pdf: r.preview_pdf || null,
    extracted_text: r.extracted_text || null,
    scanned_receipt_path: r.scanned_receipt_path || null,
    original_file_path: r.original_file_path || null,
    destinataire: r.destinataire || null,
    objet: r.objet || null,
    date_edition: r.date_edition || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    validated_by: r.validated_by,
    validated_at: r.validated_at,
  };
};

const parseValidationRow = (r) => ({
  id: r.id,
  reference: `CS-${r.id}`,
  destinataire: r.destinataire || 'N/A',
  sujet: r.objet || 'Sans objet',
  date: r.date_edition || r.created_at,
  contenu: r.extracted_text || (typeof r.courrier === 'string' ? r.courrier : JSON.stringify(r.courrier)),
  user_id: r.user_id,
  entete: safeJsonParse(r.entete),
  courrier: safeJsonParse(r.courrier),
  pied: safeJsonParse(r.pied),
  logo: r.logo,
  statut: r.statut,
  original_filename: r.original_filename || null,
  preview_pdf: r.preview_pdf || null,
  extracted_text: r.extracted_text || null,
  scanned_receipt_path: r.scanned_receipt_path || null,
  original_file_path: r.original_file_path || null,
  objet: r.objet || null,
  date_edition: r.date_edition || null,
  created_at: r.created_at,
  updated_at: r.updated_at,
  validated_by: r.validated_by,
  validated_at: r.validated_at,
});

module.exports = function createCourriersSortantsService({
  db,
  generateUniqueReference,
  recordEntityHistory,
  extractTextFromFile,
  analyzeDocumentAsync,
  baseDir,
}) {
  const repo = createCourriersSortantsRepo(db);
  const uploadsDir = baseDir ? path.join(baseDir, 'uploads') : path.join(__dirname, '..', 'uploads');

  const buildStatsWhere = (query) => {
    const { period, startDate, endDate } = query;
    const where = [];
    const params = [];

    if (startDate) {
      where.push('date_edition >= ?');
      params.push(startDate);
    }
    if (endDate) {
      where.push('date_edition <= ?');
      params.push(endDate);
    } else if (period && period !== 'all') {
      const now = new Date().toISOString().slice(0, 10);
      let calcStart;
      if (period === 'today') calcStart = now;
      else if (period === '7d') calcStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      else if (period === '30d') calcStart = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      if (calcStart) {
        where.push('date_edition >= ?');
        params.push(calcStart);
      }
      where.push('date_edition <= ?');
      params.push(now);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return { whereSql, params };
  };

  const normalizeStatut = (statut) => {
    const normalized = String(statut || '').trim().toLowerCase();
    return normalized === 'validé' ? 'valide' : normalized === 'rejeté' ? 'rejete' : normalized;
  };

  return {
    async getStats(query) {
      const { whereSql, params } = buildStatsWhere(query);
      const row = await repo.getStats(whereSql, params);
      return row || { total: 0, draft: 0, validated: 0, sent: 0 };
    },

    async createDraft({ body, user, req }) {
      const { entete, courrier, pied, logo } = body;
      const userId = user?.id ?? user?.userId ?? null;
      const userName = user?.username || user?.email || 'unknown';

      const destinataire = courrier?.destinataire || courrier?.recipient || null;
      const objet = courrier?.objet || courrier?.concerne || courrier?.subject || null;
      const date_edition = courrier?.date || courrier?.date_edition || null;

      const { reference, uuid } = await generateUniqueReference(db, 'sortant', 'courriers_sortants');
      const result = await repo.insertCourrier({
        user_id: userId || 1,
        entete: JSON.stringify(entete),
        courrier: JSON.stringify(courrier),
        pied: JSON.stringify(pied),
        logo,
        statut: 'brouillon',
        destinataire,
        objet,
        date_edition,
        reference_unique: reference,
        uuid,
      });

      try {
        recordEntityHistory(
          'courriers_sortants',
          result.lastID,
          'Brouillon créé',
          userId,
          userName,
          { source: 'courriers_sortants', statut: 'brouillon', reference_unique: reference },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (brouillon) échoué:', e.message);
      }

      return { message: 'Brouillon enregistré', id: result.lastID, reference_unique: reference, uuid };
    },

    async submitForValidation({ body, user, req }) {
      const { entete, courrier, pied, logo } = body;
      const userId = user?.id ?? user?.userId ?? null;
      const userName = user?.username || user?.email || 'unknown';

      const destinataire = courrier?.destinataire || courrier?.recipient || null;
      const objet = courrier?.objet || courrier?.concerne || courrier?.subject || null;
      const date_edition = courrier?.date || courrier?.date_edition || null;

      const { reference, uuid } = await generateUniqueReference(db, 'sortant', 'courriers_sortants');
      const result = await repo.insertCourrier({
        user_id: userId || 1,
        entete: JSON.stringify(entete),
        courrier: JSON.stringify(courrier),
        pied: JSON.stringify(pied),
        logo,
        statut: 'en_attente_validation',
        destinataire,
        objet,
        date_edition,
        reference_unique: reference,
        uuid,
      });

      try {
        recordEntityHistory(
          'courriers_sortants',
          result.lastID,
          'Soumis pour validation',
          userId,
          userName,
          { source: 'courriers_sortants', statut: 'en_attente_validation', reference_unique: reference },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (submit) échoué:', e.message);
      }

      return { message: 'Courrier soumis pour validation', id: result.lastID, reference_unique: reference, uuid };
    },

    async listAll() {
      const rows = await repo.listAll();
      return rows.map(parseCourrierRow);
    },

    async listValidation() {
      const rows = await repo.listValidation();
      return rows.map(parseValidationRow);
    },

    async importDocument({ file, body, user, req }) {
      if (!file) throw new HttpError(400, 'Aucun fichier fourni');

      const original_filename = file.originalname;
      const filePath = `/uploads/${file.filename}`;
      const absolutePath = path.join(uploadsDir, file.filename);

      const destinataire = body.destinataire || '';
      const objet = body.objet || '';
      const date_edition = body.date_edition || null;

      const requestedIdRaw = body.id ?? body.courrier_id ?? body.outgoing_id ?? null;
      const requestedId = requestedIdRaw !== null && requestedIdRaw !== undefined && String(requestedIdRaw).trim() !== ''
        ? Number(requestedIdRaw)
        : null;

      let extractedText = '';
      try {
        extractedText = await extractTextFromFile(absolutePath);
      } catch (err) {
        console.warn("Impossible d'extraire le texte:", err.message);
        extractedText = '';
      }

      const userId = user?.id || 1;
      const userName = user?.username || user?.email || 'unknown';

      if (requestedId && Number.isFinite(requestedId) && requestedId > 0) {
        const existing = await repo.getByIdBasic(requestedId);
        if (!existing) throw new HttpError(404, 'Courrier sortant introuvable.');

        const isAdminLike = user && (user.role_id === 1 || user.role_id === 2);
        if (!isAdminLike && Number(existing.user_id) !== Number(userId)) {
          throw new HttpError(403, 'Accès interdit.');
        }

        const result = await repo.updateImport({
          id: requestedId,
          courrier: extractedText || 'Document importé',
          extracted_text: extractedText,
          original_filename,
          original_file_path: filePath,
          destinataire,
          objet,
          date_edition,
        });

        if (result.changes === 0) throw new HttpError(404, 'Aucune mise à jour effectuée.');

        try {
          recordEntityHistory(
            'courriers_sortants',
            requestedId,
            'Courrier sortant mis à jour (import DOCX)',
            userId,
            userName,
            { source: 'courriers_sortants', reference_unique: existing.reference_unique, original_file_path: filePath },
            req,
          );
        } catch (e) {
          console.warn('⚠️ recordEntityHistory (import update) échoué:', e.message);
        }

        const metadata = { subject: objet, recipient: destinataire, date: date_edition };
        analyzeDocumentAsync(db, 'courriers_sortants', requestedId, extractedText, metadata)
          .catch((err) => console.error('Erreur analyse IA courrier sortant (update):', err));

        return {
          status: 200,
          body: { message: 'Courrier mis à jour avec succès', id: requestedId, reference: existing.reference_unique, file_path: filePath },
        };
      }

      const { reference, uuid } = await generateUniqueReference(db, 'sortant', 'courriers_sortants');
      const insertResult = await repo.insertImportNew({
        user_id: userId,
        courrier: extractedText || 'Document importé',
        extracted_text: extractedText,
        original_filename,
        original_file_path: filePath,
        statut: 'brouillon',
        destinataire,
        objet,
        date_edition,
        reference_unique: reference,
        uuid,
      });

      const courrierIdSortant = insertResult.lastID;

      try {
        recordEntityHistory(
          'courriers_sortants',
          courrierIdSortant,
          'Courrier sortant importé',
          userId,
          userName,
          { source: 'courriers_sortants', reference_unique: reference, original_file_path: filePath },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (import) échoué:', e.message);
      }

      const metadata = { subject: objet, recipient: destinataire, date: date_edition };
      analyzeDocumentAsync(db, 'courriers_sortants', courrierIdSortant, extractedText, metadata)
        .catch((err) => console.error('Erreur analyse IA courrier sortant:', err));

      return {
        status: 201,
        body: { message: 'Courrier importé avec succès', id: courrierIdSortant, reference, file_path: filePath },
      };
    },

    async approve({ id, user, req }) {
      const userId = user?.id;
      const userName = user?.username || user?.email || 'unknown';

      const result = await repo.updateValidationStatus(id, 'valide', userId);
      if (result.changes === 0) throw new HttpError(404, 'Courrier non trouvé');

      try {
        recordEntityHistory(
          'courriers_sortants',
          id,
          'Courrier sortant validé',
          userId,
          userName,
          { source: 'courriers_sortants', statut: 'valide' },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (approve) échoué:', e.message);
      }

      return { message: 'Courrier approuvé avec succès', id };
    },

    async reject({ id, user, req }) {
      const userId = user?.id;
      const userName = user?.username || user?.email || 'unknown';

      const result = await repo.updateValidationStatus(id, 'rejete', userId);
      if (result.changes === 0) throw new HttpError(404, 'Courrier non trouvé');

      try {
        recordEntityHistory(
          'courriers_sortants',
          id,
          'Courrier sortant rejeté',
          userId,
          userName,
          { source: 'courriers_sortants', statut: 'rejete' },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (reject) échoué:', e.message);
      }

      return { message: 'Courrier rejeté avec succès', id };
    },

    async updateStatus({ id, statut, user, req }) {
      const userId = user?.id ?? user?.userId ?? null;
      const userName = user?.username || user?.email || 'unknown';
      const mapped = normalizeStatut(statut);
      const allowed = ['brouillon', 'importe', 'en_attente_validation', 'valide', 'rejete', 'envoye'];
      if (!allowed.includes(mapped)) throw new HttpError(400, 'Statut invalide.');

      const result = await repo.updateStatus(id, mapped);
      if (result.changes === 0) throw new HttpError(404, 'Courrier non trouvé.');

      try {
        recordEntityHistory(
          'courriers_sortants',
          id,
          `Statut mis à jour: ${mapped}`,
          userId,
          userName,
          { source: 'courriers_sortants', statut: mapped },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (status update) échoué:', e.message);
      }

      return { message: 'Statut mis à jour.' };
    },

    async addScan({ id, file, user, req }) {
      if (!file) throw new HttpError(400, 'Aucun fichier reçu.');
      const userId = user?.id ?? user?.userId ?? null;
      const userName = user?.username || user?.email || 'unknown';
      const scanPath = `/uploads/${file.filename}`;

      const result = await repo.updateScan(id, scanPath);
      if (result.changes === 0) throw new HttpError(404, 'Courrier non trouvé.');

      try {
        recordEntityHistory(
          'courriers_sortants',
          id,
          'Scan AR ajouté',
          userId,
          userName,
          { source: 'courriers_sortants', scanned_receipt_path: scanPath },
          req,
        );
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (scan) échoué:', e.message);
      }

      return { message: 'Scan enregistré.', scanned_receipt_path: scanPath };
    },

    async send({ id, user, req }) {
      const userId = user?.id ?? null;
      const userName = user?.username ?? null;

      const row = await repo.getByIdBasic(id);
      if (!row) throw new HttpError(404, 'Courrier non trouvé.');

      const current = String(row.statut || '').trim().toLowerCase();
      const okStatuses = new Set(['valide', 'validé', 'en_attente_validation', 'envoye']);
      if (!okStatuses.has(current)) {
        throw new HttpError(409, `Statut non éligible à l'envoi (statut actuel: ${row.statut || 'inconnu'})`);
      }

      const result = await repo.updateSend(id);
      if (!result.changes) throw new HttpError(404, 'Courrier non trouvé.');

      try {
        recordEntityHistory('courriers_sortants', id, 'Courrier sortant envoyé', userId, userName, { source: 'courriers_sortants' }, req);
      } catch (e) {
        console.warn('⚠️ recordEntityHistory (send outgoing) échoué:', e.message);
      }

      try {
        await repo.insertMailHistory(id, userId, JSON.stringify({ source: 'courriers_sortants', note: 'legacy' }));
      } catch (e) {
        console.warn('⚠️ mail_history insert (send outgoing) échoué:', e.message);
      }

      return { message: 'Courrier envoyé.', id };
    },

    HttpError,
  };
};
