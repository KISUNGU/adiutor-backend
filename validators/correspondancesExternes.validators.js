const { body, param } = require('express-validator');

const externeIdParam = [param('id').isInt().toInt()];

const externeCreateValidator = [
  body('reference').isString().trim().notEmpty(),
  body('destinataire').isString().trim().notEmpty(),
  body('objet').isString().trim().notEmpty(),
  body('date').isString().trim().notEmpty(),
];

const externeBulkValidator = [
  body().isArray({ min: 1 }).withMessage('Un tableau de correspondances est requis'),
  body('*.reference').isString().trim().notEmpty(),
  body('*.destinataire').isString().trim().notEmpty(),
  body('*.objet').isString().trim().notEmpty(),
  body('*.date').isString().trim().notEmpty(),
];

module.exports = {
  externeIdParam,
  externeCreateValidator,
  externeBulkValidator,
};
