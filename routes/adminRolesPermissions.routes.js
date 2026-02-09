const express = require('express');

module.exports = function adminRolesPermissionsRoutes({
  authenticateToken,
  authorizeAdmin,
  validate,
  rolePermissionValidator,
  PERMISSIONS_BY_ROLE_ID,
  getFrontendRole,
}) {
  const router = express.Router();

  router.get('/admin/roles-permissions', authenticateToken, authorizeAdmin, (req, res) => {
    const roles = Object.keys(PERMISSIONS_BY_ROLE_ID).map((roleId) => ({
      roleId: Number(roleId),
      name: getFrontendRole(roleId),
    }));

    const allPermissions = Array.from(new Set(
      Object.values(PERMISSIONS_BY_ROLE_ID).flat(),
    ));

    const matrix = allPermissions.map((permission) => {
      const roleStates = {};
      roles.forEach((role) => {
        roleStates[role.roleId] = PERMISSIONS_BY_ROLE_ID[role.roleId]?.includes(permission) || false;
      });
      return { permission, roles: roleStates };
    });

    res.json({ roles, permissions: allPermissions, matrix });
  });

  router.post(
    '/admin/roles-permissions',
    authenticateToken,
    authorizeAdmin,
    rolePermissionValidator,
    validate,
    (req, res) => {
      const { roleId, permission } = req.body;
      const arr = PERMISSIONS_BY_ROLE_ID[roleId];
      if (!arr) return res.status(404).json({ error: 'Role inconnu.' });
      if (!arr.includes(permission)) arr.push(permission);
      res.json({ success: true, permissions: arr });
    },
  );

  router.delete(
    '/admin/roles-permissions',
    authenticateToken,
    authorizeAdmin,
    rolePermissionValidator,
    validate,
    (req, res) => {
      const { roleId, permission } = req.body;
      const arr = PERMISSIONS_BY_ROLE_ID[roleId];
      if (!arr) return res.status(404).json({ error: 'Role inconnu.' });
      const idx = arr.indexOf(permission);
      if (idx !== -1) arr.splice(idx, 1);
      res.json({ success: true, permissions: arr });
    },
  );

  return router;
};
