// backend/rbac/permissions.map.js

// Map role_id -> role name (frontend)
const ROLE_NAME_BY_ID = {
  1: 'ADMIN',
  2: 'COORDONNATEUR',
  // Métier: RAF = ADMIN (mêmes accès)
  3: 'ADMIN',
  // Rôles métier: garder les anciens noms pour le frontend
  4: 'COMPTABLE',
  5: 'CAISSE',
  6: 'TRESORERIE',
  7: 'SECRETAIRE',
  8: 'LOGISTICIEN',
  9: 'ASSISTANT_ADMIN',
  10: 'RECEPTIONNISTE',
}

// Map role_id -> permissions
const PERMISSIONS_BY_ROLE_ID = {
  1: ['all.*'], // admin = tout
  // Coordonnateur = tous les privilèges (demande utilisateur)
  2: ['all.*'],
  // Métier: RAF = ADMIN
  3: ['all.*'],
  4: ['dashboard.widget.notifications.view'],
  5: ['dashboard.widget.notifications.view'],
  6: ['dashboard.widget.notifications.view'],
  7: ['dashboard.widget.timeline.view', 'dashboard.widget.notifications.view'],
  8: ['dashboard.widget.notifications.view'],
  9: ['dashboard.widget.notifications.view'],
  10: ['dashboard.widget.notifications.view'],
}

function getFrontendRole(roleId) {
  return ROLE_NAME_BY_ID[Number(roleId)] || 'USER'
}

function getPermissions(roleId) {
  return PERMISSIONS_BY_ROLE_ID[Number(roleId)] || []
}

function getUIConfig(roleId) {
  const role = getFrontendRole(roleId)

  // Tu peux personnaliser plus tard
  if (role === 'ADMIN') {
    return { layout: 'DefaultLayout', theme: 'light', nav: 'admin' }
  }
  return { layout: 'DefaultLayout', theme: 'light', nav: 'standard' }
}

module.exports = { getFrontendRole, getPermissions, getUIConfig }
module.exports.PERMISSIONS_BY_ROLE_ID = PERMISSIONS_BY_ROLE_ID;
