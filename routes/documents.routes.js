const express = require('express');

module.exports = function documentsRoutes({ authenticateToken, db }) {
  const router = express.Router();

  /**
   * GET /api/documents/types
   * Liste tous les types de documents avec leurs IDs
   */
  router.get('/types', authenticateToken, (req, res) => {
    // Types de documents standards avec IDs fixes
    const documentTypes = [
      { id_type_document: 1, nom_type: 'Lettre / Courrier' },
      { id_type_document: 2, nom_type: 'Facture' },
      { id_type_document: 3, nom_type: 'Rapport' },
      { id_type_document: 4, nom_type: 'Mission' },
      { id_type_document: 5, nom_type: 'Note de service' },
      { id_type_document: 6, nom_type: 'Décision' },
      { id_type_document: 7, nom_type: 'Protocole / Convention' },
      { id_type_document: 8, nom_type: 'Demande citoyen' }
    ];
    
    res.json(documentTypes);
  });

  /**
   * GET /api/classeurs
   * Liste tous les classeurs disponibles
   */
  router.get('/classeurs', authenticateToken, (req, res) => {
    const query = `SELECT * FROM classeurs ORDER BY nom ASC`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des classeurs:', err.message);
        return res.status(500).json({ error: 'Erreur serveur lors de la récupération des classeurs' });
      }
      res.json(rows || []);
    });
  });

  return router;
};
