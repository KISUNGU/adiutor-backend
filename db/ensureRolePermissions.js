module.exports = function ensureRolePermissionsTable(db) {
  if (!db) {
    throw new Error('ensureRolePermissionsTable: db is required');
  }

  // Table ROLE_PERMISSIONS (RBAC)
  // Utilisée par middlewares/authorize.js pour contrôler l'accès aux widgets/routes.
  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    permission_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_code)
  )`, (err) => {
    if (err) {
      console.error("Erreur création table role_permissions:", err.message);
    } else {
      console.log("Table 'role_permissions' prête.");

      // Seed RBAC minimal pour les widgets dashboard (évite 403 inattendus)
      const widgetPermsByRole = {
        admin: [
          'all.*',
          'dashboard.widget.control.view',
          'dashboard.widget.notifications.view',
          'dashboard.widget.timeline.view',
          'dashboard.widget.audit.view',
          'dashboard.widget.security_alerts.view',
        ],
        coordonnateur: [
          'all.*',
          'dashboard.widget.control.view',
          'dashboard.widget.notifications.view',
          'dashboard.widget.timeline.view',
          'dashboard.widget.audit.view',
          'dashboard.widget.security_alerts.view',
        ],
        raf: [
          'dashboard.widget.notifications.view',
          'dashboard.widget.audit.view',
        ],
        comptable: [
          'dashboard.widget.notifications.view',
        ],
        caisse: [
          'dashboard.widget.notifications.view',
        ],
        tresorerie: [
          'dashboard.widget.notifications.view',
        ],
        secretariat: [
          'dashboard.widget.control.view',
          'dashboard.widget.notifications.view',
          'dashboard.widget.audit.view',
        ],
        logisticien: [
          'dashboard.widget.notifications.view',
        ],
        assistant_admin: [
          'dashboard.widget.notifications.view',
        ],
        receptionniste: [
          'dashboard.widget.notifications.view',
        ],
        user: [
          'dashboard.widget.notifications.view',
        ],
      }

      Object.entries(widgetPermsByRole).forEach(([role, perms]) => {
        ;(perms || []).forEach((perm) => {
          db.run(
            `INSERT OR IGNORE INTO role_permissions (role, permission_code) VALUES (?, ?)`,
            [role, perm],
            (seedErr) => {
              if (seedErr) console.error('Erreur seed role_permissions:', seedErr.message)
            }
          )
        })
      })
    }
  });
};
