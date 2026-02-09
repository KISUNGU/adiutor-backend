const express = require('express');

module.exports = function n8nRoutes({
  authenticateToken,
  authorizeAdmin,
  axios,
  n8nWorkflowsConfig,
  n8nWebhookBase,
}) {
  const router = express.Router();

  router.post('/n8n/run/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const payload = req.body || {};

    try {
      const url = `${process.env.N8N_URL}/rest/workflows/${id}/run`;

      const headers = {};
      if (process.env.N8N_API_KEY) {
        headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
      }

      const response = await axios.post(url, payload, { headers });

      res.json({
        success: true,
        workflowId: id,
        data: response.data,
      });
    } catch (err) {
      console.error(`Erreur /api/n8n/run/${id} :`, err.message);
      res.status(500).json({ success: false, error: 'Erreur n8n : ' + err.message });
    }
  });

  router.post('/n8n/execute', authenticateToken, authorizeAdmin, async (req, res) => {
    const { workflowId, payload } = req.body || {};

    if (!workflowId) {
      return res.status(400).json({ ok: false, error: 'workflowId requis' });
    }

    const wf = n8nWorkflowsConfig.find((w) => w.id === workflowId);
    if (!wf) {
      return res.status(404).json({ ok: false, error: 'Workflow inconnu' });
    }

    try {
      const url = `${n8nWebhookBase}${wf.webhookPath}`;
      const startedAt = Date.now();

      const response = await axios.post(url, payload || {});

      const duration = Date.now() - startedAt;

      res.json({
        ok: true,
        workflowId,
        duration,
        n8nResponse: response.data,
      });
    } catch (err) {
      console.error('Erreur exécution workflow n8n:', err.message);
      res.status(500).json({
        ok: false,
        error: err.message,
      });
    }
  });

  router.post('/n8n/workflows/execute/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const payload = req.body || {};

    try {
      const webhookMap = {
        'auto-archive': '/webhook/adiutorai-auto-archive',
        'urgent-mail-alert': '/webhook/adiutorai-urgent-alert',
        'monthly-report': '/webhook/adiutorai-monthly-report',
        'data-sync': '/webhook/adiutorai-data-sync',
        'backup-validation': '/webhook/adiutorai-backup-validation',
      };

      const relativePath = webhookMap[id];

      if (!relativePath) {
        return res.status(400).json({
          success: false,
          error: `Aucun webhook configuré pour le workflow "${id}"`,
        });
      }

      const url = `${process.env.N8N_URL}${relativePath}`;

      const response = await axios.post(url, payload);

      res.json({
        success: true,
        workflowId: id,
        n8nResponse: response.data,
      });
    } catch (err) {
      console.error(`Erreur exécution workflow ${id} :`, err.message);

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  router.get('/n8n/workflows', authenticateToken, authorizeAdmin, async (req, res) => {
    console.log('🔍 Endpoint /api/n8n/workflows appelé');
    console.log('🔍 N8N_URL:', process.env.N8N_URL);
    try {
      if (!process.env.N8N_URL) {
        console.warn('⚠️ N8N_URL non configuré, retour des workflows statiques');
        return res.json(n8nWorkflowsConfig.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          active: w.active,
          tags: w.tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })));
      }

      const url = `${process.env.N8N_URL}/rest/workflows`;
      const headers = {};
      if (process.env.N8N_API_KEY) {
        headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
      }

      const response = await axios.get(url, { headers });

      let list = response.data;

      if (Array.isArray(list.workflows)) list = list.workflows;
      else if (Array.isArray(list.data)) list = list.data;

      if (!Array.isArray(list)) {
        return res.status(500).json({ error: 'Format inattendu renvoyé par n8n' });
      }

      res.json(list);
    } catch (err) {
      console.error('Erreur /api/n8n/workflows :', err.message);

      console.warn('⚠️ n8n inaccessible, retour des workflows statiques');
      res.json(n8nWorkflowsConfig.map(w => ({
        id: w.id,
        name: w.name,
        description: w.description,
        active: w.active,
        tags: w.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })));
    }
  });

  return router;
};
