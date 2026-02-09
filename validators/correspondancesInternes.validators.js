const { body, param, query } = require('express-validator');

const interneIdParam = [param('id').isInt().toInt()];

const interneStatsValidator = [
  query('period').optional().isString().trim().isLength({ max: 10 }),
  query('startDate').optional().isString().trim().isLength({ max: 20 }),
  query('endDate').optional().isString().trim().isLength({ max: 20 }),
];

const interneCreateValidator = [
  body('objet').isString().trim().notEmpty(),
  body('date').isString().trim().notEmpty(),
  body('type_document').isString().trim().notEmpty(),
  body('reference').optional().isString().trim().isLength({ max: 120 }),
  body('destinataire').optional().isString().trim().isLength({ max: 120 }),
  body('fonction').optional().isString().trim().isLength({ max: 120 }),
  body('metadata').optional(),
];

module.exports = {
  interneIdParam,
  interneStatsValidator,
  interneCreateValidator,
};
