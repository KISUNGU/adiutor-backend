const express = require('express');

module.exports = function searchRoutes({ authenticateToken, db }) {
  const router = express.Router();

  router.get('/mails/search-ai', authenticateToken, (req, res) => {
    console.log('🤖 ROUTE GET /api/mails/search-ai HIT - Recherche IA conversationnelle');
    console.log('🔍 Query params:', req.query);

    const searchTerm = req.query.search;
    if (!searchTerm) {
      return res.status(400).json({ error: 'Paramètre search requis' });
    }

    console.log(`🔍 Recherche IA demandée: "${searchTerm}"`);
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
            '' as sender,
            '' as recipient,
            date as mail_date,
            date as arrival_date,
            category as status,
            file_path,
            '' as summary,
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
        LIMIT 20
    `;

    const params = [
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ];

    db.all(sql, params, async (err, searchResults) => {
      if (err) {
        console.error('❌ Erreur SQL recherche IA:', err.message);
        return res.status(500).json({ error: 'Erreur serveur lors de la recherche IA.' });
      }

      console.log(`✅ Recherche IA "${searchTerm}": ${searchResults.length} résultats trouvés.`);

      if (searchResults.length === 0) {
        return res.json({
          searchTerm,
          results: [],
          aiResponse: {
            message: `Aucun document trouvé pour "${searchTerm}". Essayez avec des termes différents ou vérifiez l'orthographe.`,
            suggestions: [
              "Vérifiez l'orthographe des termes recherchés",
              'Utilisez des mots-clés plus généraux',
              "Essayez avec le nom de l'expéditeur ou du destinataire",
              'Recherchez par numéro de référence',
            ],
          },
        });
      }

      try {
        const { getAgentResponse } = require('../openaiAgent.js');

        const context = searchResults
          .map((doc, index) => {
            return `Document ${index + 1}:
- Référence: ${doc.ref_code || 'N/A'}
- Objet: ${doc.subject || 'N/A'}
- Expéditeur: ${doc.sender || 'N/A'}
- Destinataire: ${doc.recipient || 'N/A'}
- Date: ${doc.arrival_date || doc.mail_date || 'N/A'}
- Statut: ${doc.status || 'N/A'}
- Source: ${doc.source}
- Résumé: ${doc.summary || 'N/A'}`;
          })
          .join('\n\n');

        const aiPrompt = `Tu es un assistant IA spécialisé dans l'analyse de documents administratifs. L'utilisateur recherche "${searchTerm}".

Voici les documents trouvés (${searchResults.length} résultats) :

${context}

Analyse ces résultats et fournis une réponse conversationnelle utile qui :
1. Résume les documents trouvés
2. Met en évidence les plus pertinents pour la recherche
3. Propose des détails intéressants ou des suggestions
4. Indique si certains documents semblent plus importants ou urgents

Réponds de manière naturelle et conversationnelle, comme si tu discutais avec l'utilisateur.`;

        const aiResponse = await getAgentResponse([{ role: 'user', content: aiPrompt }]);
        const aiMessage = aiResponse.choices[0].message.content;

        return res.json({
          searchTerm,
          results: searchResults,
          aiResponse: {
            message: aiMessage,
            totalResults: searchResults.length,
            suggestions:
              searchResults.length > 5
                ? ['Affinez votre recherche avec plus de détails', 'Consultez les documents les plus récents']
                : [],
          },
        });
      } catch (aiError) {
        console.error('❌ Erreur IA:', aiError.message);
        return res.json({
          searchTerm,
          results: searchResults,
          aiResponse: {
            message: `J'ai trouvé ${searchResults.length} document(s) correspondant à "${searchTerm}", mais je n'ai pas pu analyser les détails pour le moment.`,
            totalResults: searchResults.length,
            error: 'Analyse IA temporairement indisponible',
          },
        });
      }
    });
  });

  router.get('/search', authenticateToken, (req, res) => {
    console.log('🔎 ROUTE GET /api/search HIT - Recherche générale (union)');
    const searchTerm = req.query.search || req.query.q;
    if (!searchTerm) {
      return res.status(400).json({ error: 'Paramètre search (ou q) requis' });
    }
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
      '' as sender,
      '' as recipient,
      date as mail_date,
      date as arrival_date,
      category as status,
      file_path,
      '' as summary,
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
      date_edition as mail_date,
      date_edition as arrival_date,
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
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ];

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Erreur SQL recherche générale:', err.message);
        return res.status(500).json({ error: 'Erreur serveur lors de la recherche générale.' });
      }
      console.log(`✅ Recherche générale "${searchTerm}": ${rows.length} résultats trouvés.`);
      return res.json(rows || []);
    });
  });

  return router;
};
