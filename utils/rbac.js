const ROLE_MAP = {
  1: 'admin',
  2: 'coordonnateur',
  3: 'raf',
  4: 'comptable',
  5: 'caisse',
  6: 'tresorerie',
  7: 'secretariat',
  8: 'logisticien',
  9: 'assistant_admin',
  10: 'receptionniste',
}

function roleNameFromId(role_id) {
  return ROLE_MAP[Number(role_id)] || 'user'
}

module.exports = { ROLE_MAP, roleNameFromId }
