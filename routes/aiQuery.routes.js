const express = require('express');

module.exports = function aiQueryRoutes({
  authenticateToken,
  openai,
  logger,
  queryMemoryStore,
  getAllPDFContent,
  db,
}) {
  const router = express.Router();

  router.post('/ai-query', authenticateToken, async (req, res) => {
    const { query } = req.body;
    if (typeof query !== 'string' || query.length > 1000) {
      return res.status(400).json({ error: 'Query invalide ou trop long.' });
    }

    if (!query) {
      return res.status(400).json({ error: 'Le champ query est requis.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Clé API OpenAI manquante.' });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: query }],
        max_tokens: 1000,
      });

      res.json({ result: completion.choices[0].message.content });
    } catch (error) {
      if (logger) {
        logger.error(`Erreur IA: ${error.message}`, { stack: error.stack });
      }
      res.status(500).json({ error: `Erreur lors de la requête IA: ${error.message}` });
    }
  });

  router.post('/ask-openai', authenticateToken, async (req, res) => {
    const { question, user_id } = req.body;

    if (!question || question.trim() === '' || typeof question !== 'string' || question.length > 1000) {
      return res.status(400).json({ error: 'Question invalide ou trop longue.' });
    }

    try {
      const vectorContext = await queryMemoryStore(question);
      const pdfContent = await getAllPDFContent();

      const prompt = `
      Tu es un assistant IA qui aide à gérer les courriers internes, contrats, et documents de l’organisation.
      Contexte du magasin vectoriel :
      ${vectorContext || 'Aucun contexte vectoriel disponible.'}
      
      Contenu des documents PDF uploadés :
      ${pdfContent || 'Aucun document PDF disponible.'}
      
      Question de l'utilisateur : ${question.trim()}
      
      Réponds précisément en te basant sur le contexte et les documents fournis si pertinent, sinon utilise tes connaissances générales.
    `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Tu es un assistant IA précis et professionnel.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const result = completion.choices[0].message.content.trim();

      db.run(
        `INSERT INTO messages (session_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [Date.now().toString(), user_id || null, 'user', question.trim(), new Date().toISOString()],
        (err) => {
          if (err && logger) logger.error('Erreur sauvegarde question', { error: err.message });
        },
      );
      db.run(
        `INSERT INTO messages (session_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [Date.now().toString(), user_id || null, 'assistant', result, new Date().toISOString()],
        (err) => {
          if (err && logger) logger.error('Erreur sauvegarde réponse', { error: err.message });
        },
      );

      res.json({ result });
    } catch (error) {
      if (logger) {
        logger.error('Erreur lors de la requête IA', { error: error.message, stack: error.stack });
      }
      res.status(500).json({ error: `Erreur lors de la requête IA: ${error.message}` });
    }
  });

  return router;
};
