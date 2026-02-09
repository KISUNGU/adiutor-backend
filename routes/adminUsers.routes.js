const express = require('express');

module.exports = function adminUsersRoutes({
  authenticateToken,
  authorizeAdmin,
  db,
  dbGet,
  dbRun,
  bcrypt,
  normalizeUsername,
  normalizeEmail,
  getFrontendRole,
  getPermissions,
  getUIConfig,
  logUserRoleAudit,
}) {
  const router = express.Router();

  const ROLE_NAME_TO_ID = {
    ADMIN: 1,
    COORDONNATEUR: 2,
    RAF: 3,
    COMPTABLE: 4,
    CAISSE: 5,
    TRESORERIE: 6,
    SECRETAIRE: 7,
    LOGISTICIEN: 8,
    ASSISTANT_ADMIN: 9,
    RECEPTIONNISTE: 10,
  };

  const AVAILABLE_ROLES = [
    { id: 1, name: 'ADMIN', label: 'Administrateur', description: 'Accès total à toutes les fonctionnalités' },
    { id: 2, name: 'COORDONNATEUR', label: 'Coordonnateur', description: 'Supervision, validation et rapports' },
    { id: 3, name: 'RAF', label: 'RAF', description: 'Validation administrative et suivi' },
    { id: 4, name: 'COMPTABLE', label: 'Comptable', description: 'Comptabilité' },
    { id: 5, name: 'CAISSE', label: 'Caisse', description: 'Opérations de caisse' },
    { id: 6, name: 'TRESORERIE', label: 'Trésorerie', description: 'Suivi de la trésorerie' },
    { id: 7, name: 'SECRETAIRE', label: 'Secrétaire', description: 'Acquisition, indexation, traitement, archivage' },
    { id: 8, name: 'LOGISTICIEN', label: 'Logisticien', description: 'Logistique' },
    { id: 9, name: 'ASSISTANT_ADMIN', label: 'Assistant admin', description: 'Administration' },
    { id: 10, name: 'RECEPTIONNISTE', label: 'Réceptionniste', description: 'Réception / acquisition des courriers' },
  ];

  router.get('/users', authenticateToken, authorizeAdmin, (req, res) => {
    db.all('SELECT id, username, email, role_id FROM users', [], (err, rows) => {
      if (err) {
        console.error('Erreur liste utilisateurs:', err.message);
        return res.status(500).json({ error: 'Erreur serveur.' });
      }
      res.json(rows);
    });
  });

  router.get('/admin/users', authenticateToken, authorizeAdmin, (req, res) => {
    db.all('SELECT id, username, email, role_id, created_at FROM users', [], (err, rows) => {
      if (err) {
        console.error('Erreur liste utilisateurs admin:', err.message);
        return res.status(500).json({ error: 'Erreur serveur.' });
      }

      const users = rows.map((user) => ({
        ...user,
        role: getFrontendRole(user.role_id),
      }));

      res.json(users);
    });
  });

  router.post('/admin/create-user', authenticateToken, authorizeAdmin, async (req, res) => {
    const { username, email, password, role, role_id } = req.body;
    const creator = req.user;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Champs requis manquants (username, email, password).' });
    }

    const usernameNorm = normalizeUsername(username);
    const emailNorm = normalizeEmail(email);
    if (!usernameNorm || !emailNorm) {
      return res.status(400).json({ error: 'Username/email invalides.' });
    }

    try {
      const existing = await dbGet(
        'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?))',
        [emailNorm, usernameNorm],
      );
      if (existing) {
        return res.status(409).json({ error: 'Email ou nom d’utilisateur déjà utilisé.' });
      }

      let finalRoleId = 10;
      if (typeof role_id === 'number') {
        finalRoleId = role_id;
      } else if (typeof role === 'string') {
        const upper = role.toUpperCase();
        if (ROLE_NAME_TO_ID[upper]) finalRoleId = ROLE_NAME_TO_ID[upper];
      }

      const hash = await bcrypt.hash(password, 10);
      await dbRun('INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)', [
        usernameNorm,
        emailNorm,
        hash,
        finalRoleId,
      ]);
      const createdUser = await dbGet('SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))', [emailNorm]);
      try {
        await logUserRoleAudit({
          actor_user_id: creator.id,
          target_user_id: createdUser.id,
          action: 'CREATE_USER',
          old_role_id: null,
          new_role_id: finalRoleId,
          metadata: { username },
        });
      } catch (auditErr) {
        console.warn('⚠️ Audit création utilisateur échoué:', auditErr.message);
      }
      res.json({
        message: 'Utilisateur créé avec succès.',
        user: { id: createdUser.id, username: usernameNorm, email: emailNorm, role_id: finalRoleId },
      });
    } catch (err) {
      console.error('Erreur admin création utilisateur:', err);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  router.patch('/admin/users/:id/role', authenticateToken, authorizeAdmin, async (req, res) => {
    const admin = req.user;
    const targetId = parseInt(req.params.id, 10);
    const { role, role_id } = req.body;

    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide.' });
    }

    if (admin.id === targetId && role && role.toUpperCase() !== 'ADMIN') {
      return res.status(400).json({ error: 'Vous ne pouvez pas changer votre propre rôle.' });
    }

    let newRoleId;
    if (typeof role_id === 'number') {
      newRoleId = role_id;
    } else if (typeof role === 'string') {
      const upper = role.toUpperCase();
      newRoleId = ROLE_NAME_TO_ID[upper];
    }

    if (!newRoleId) {
      return res.status(400).json({ error: 'Rôle spécifié invalide.' });
    }

    try {
      const existing = await dbGet('SELECT id, username, email, role_id FROM users WHERE id = ?', [targetId]);
      if (!existing) {
        return res.status(404).json({ error: 'Utilisateur non trouvé.' });
      }

      await dbRun('UPDATE users SET role_id = ? WHERE id = ?', [newRoleId, targetId]);
      try {
        await logUserRoleAudit({
          actor_user_id: admin.id,
          target_user_id: targetId,
          action: 'CHANGE_ROLE',
          old_role_id: existing.role_id,
          new_role_id: newRoleId,
          metadata: { old_role_id: existing.role_id, new_role_id: newRoleId },
        });
      } catch (auditErr) {
        console.warn('⚠️ Audit changement rôle échoué:', auditErr.message);
      }

      const updatedRole = getFrontendRole(newRoleId);
      const permissions = getPermissions(newRoleId);
      const ui_config = getUIConfig(newRoleId);

      res.json({
        message: 'Rôle utilisateur mis à jour avec succès.',
        user: {
          id: targetId,
          username: existing.username,
          email: existing.email,
          role_id: newRoleId,
          role: updatedRole,
          permissions,
          ui_config,
        },
      });
    } catch (err) {
      console.error('Erreur mise à jour rôle utilisateur:', err);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  router.put('/admin/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const admin = req.user;
    const targetId = parseInt(req.params.id, 10);
    const { username, email, password, role } = req.body;

    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide.' });
    }

    if (!username || !email) {
      return res.status(400).json({ error: "Nom d'utilisateur et email requis." });
    }

    const usernameNorm = normalizeUsername(username);
    const emailNorm = normalizeEmail(email);
    if (!usernameNorm || !emailNorm) {
      return res.status(400).json({ error: 'Username/email invalides.' });
    }

    try {
      const existing = await dbGet('SELECT id, username, email, role_id FROM users WHERE id = ?', [targetId]);
      if (!existing) {
        return res.status(404).json({ error: 'Utilisateur non trouvé.' });
      }

      let newRoleId = existing.role_id;
      if (role) {
        const upper = role.toUpperCase();
        if (ROLE_NAME_TO_ID[upper]) {
          newRoleId = ROLE_NAME_TO_ID[upper];
        }
      }

      if (password) {
        const hash = await bcrypt.hash(password, 10);
        await dbRun('UPDATE users SET username = ?, email = ?, password = ?, role_id = ? WHERE id = ?', [
          usernameNorm,
          emailNorm,
          hash,
          newRoleId,
          targetId,
        ]);
      } else {
        await dbRun('UPDATE users SET username = ?, email = ?, role_id = ? WHERE id = ?', [
          usernameNorm,
          emailNorm,
          newRoleId,
          targetId,
        ]);
      }

      if (newRoleId !== existing.role_id) {
        try {
          await logUserRoleAudit({
            actor_user_id: admin.id,
            target_user_id: targetId,
            action: 'CHANGE_ROLE',
            old_role_id: existing.role_id,
            new_role_id: newRoleId,
            metadata: { username },
          });
        } catch (auditErr) {
          console.warn('⚠️ Audit changement rôle échoué:', auditErr.message);
        }
      }

      res.json({ message: 'Utilisateur modifié avec succès.' });
    } catch (err) {
      console.error('Erreur modification utilisateur:', err);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  router.delete('/admin/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const admin = req.user;
    const targetId = parseInt(req.params.id, 10);

    console.log('🗑️ Requête DELETE utilisateur reçue:', { admin_id: admin?.id, target_id: targetId });

    if (Number.isNaN(targetId)) {
      console.log('❌ ID invalide:', req.params.id);
      return res.status(400).json({ error: 'ID utilisateur invalide.' });
    }

    if (admin.id === targetId) {
      console.log('❌ Tentative de suppression de son propre compte');
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }

    try {
      console.log('🔍 Recherche utilisateur avec ID:', targetId);
      const existing = await dbGet('SELECT id, username FROM users WHERE id = ?', [targetId]);
      if (!existing) {
        console.log('❌ Utilisateur non trouvé');
        return res.status(404).json({ error: 'Utilisateur non trouvé.' });
      }

      console.log('✅ Utilisateur trouvé:', existing.username);
      console.log('🗑️ Tentative de suppression...');
      await dbRun('DELETE FROM users WHERE id = ?', [targetId]);
      console.log('✅ Utilisateur supprimé avec succès');
      res.json({ message: `Utilisateur ${existing.username} supprimé avec succès.` });
    } catch (err) {
      console.error('❌ Erreur suppression utilisateur:', err);
      res.status(500).json({ error: 'Erreur serveur.', details: err.message });
    }
  });

  router.get('/admin/roles', authenticateToken, authorizeAdmin, (req, res) => {
    res.json({ roles: AVAILABLE_ROLES });
  });

  router.get('/admin/user-audit', authenticateToken, authorizeAdmin, (req, res) => {
    let { target_user_id, action, page, page_size } = req.query;
    page = parseInt(page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;
    page_size = parseInt(page_size, 10);
    if (Number.isNaN(page_size) || page_size < 1 || page_size > 500) page_size = 50;

    const clauses = [];
    const params = [];
    if (target_user_id) {
      clauses.push('target_user_id = ?');
      params.push(parseInt(target_user_id, 10));
    }
    if (action) {
      clauses.push('action = ?');
      params.push(action);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM user_role_audit ${where}`;
    db.get(countSql, params, (countErr, countRow) => {
      if (countErr) {
        console.error('Erreur COUNT audit utilisateurs:', countErr.message);
        return res.status(500).json({ error: 'Erreur récupération audit (count).' });
      }
      const total = countRow?.total || 0;
      const offset = (page - 1) * page_size;
      const dataSql = `SELECT id, actor_user_id, target_user_id, action, old_role_id, new_role_id, metadata, created_at
                     FROM user_role_audit ${where}
                     ORDER BY created_at DESC
                     LIMIT ? OFFSET ?`;
      db.all(dataSql, [...params, page_size, offset], (err, rows) => {
        if (err) {
          console.error('Erreur récupération audit utilisateurs:', err.message);
          return res.status(500).json({ error: 'Erreur récupération audit.' });
        }
        res.json({
          audit: rows,
          page,
          page_size,
          total,
          total_pages: Math.ceil(total / page_size) || 1,
        });
      });
    });
  });

  return router;
};
