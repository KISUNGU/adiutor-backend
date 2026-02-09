const express = require('express');

module.exports = function rbacMeRoutes({ authenticateToken, getFrontendRole, getPermissions, getUIConfig }) {
  const router = express.Router();

  router.get('/rbac/me', authenticateToken, (req, res) => {
    try {
      const roleId = req.user?.role_id;

      return res.json({
        user: {
          id: req.user?.id,
          username: req.user?.username,
          role_id: roleId,
          role: getFrontendRole(roleId),
        },
        permissions: getPermissions(roleId),
        ui_config: getUIConfig(roleId),
      });
    } catch (e) {
      console.error('❌ /api/rbac/me error:', e);
      return res.status(500).json({ error: 'RBAC me failed', details: e.message });
    }
  });

  return router;
};
