const { body } = require('express-validator');

const rolePermissionValidator = [
  body('roleId').notEmpty().withMessage('roleId requis').isInt().withMessage('roleId invalide').toInt(),
  body('permission').notEmpty().withMessage('permission requis').isString().trim(),
];

module.exports = {
  rolePermissionValidator,
};
