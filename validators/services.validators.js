const { body, param, query } = require('express-validator');

const serviceIdParam = [
  param('id').isInt().withMessage('id invalide').toInt(),
];

const serviceCreateValidator = [
  body('code').notEmpty().withMessage('code requis').isString().trim(),
  body('nom').notEmpty().withMessage('nom requis').isString().trim(),
  body('description').optional().isString(),
  body('actif').optional().isInt().toInt(),
  body('ordre').optional().isInt().toInt(),
];

const serviceUpdateValidator = [
  body('code').optional().isString().trim(),
  body('nom').notEmpty().withMessage('nom requis').isString().trim(),
  body('description').optional().isString(),
  body('actif').optional().isInt().toInt(),
  body('ordre').optional().isInt().toInt(),
];

const serviceListValidator = [
  query('active').optional().isIn(['true', 'false']).withMessage('active invalide'),
];

module.exports = {
  serviceIdParam,
  serviceCreateValidator,
  serviceUpdateValidator,
  serviceListValidator,
};
