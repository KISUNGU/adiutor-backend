const express = require('express');

module.exports = function dashboardAiRoutes({ authenticateToken, axios }) {
  const router = express.Router();

  router.post('/dashboard/ai', authenticateToken, async (req, res) => {
    const { query, filters = {} } = req.body || {};

    const user = req.user || {};

    const userContext = {
      id: user.id || user.user_id || null,
      email: user.email || null,
      role: user.role || user.profil || 'Utilisateur',
      service: user.service || user.service_name || null,
      fullName: user.fullName || user.nom_complet || user.username || 'Utilisateur',
    };

    try {
      const payload = {
        query,
        userContext,
        filters,
      };

      const response = await axios.post('http://127.0.0.1:5000/dashboard-ai', payload);

      if (!response.data) {
        return res.status(500).json({ error: 'Réponse IA invalide' });
      }

      res.json(response.data);
    } catch (err) {
      console.error('Erreur IA /api/dashboard/ai:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
