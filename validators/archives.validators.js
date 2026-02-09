const { query, param } = require('express-validator');

const archivesListValidator = [
  query('service').optional().isString().trim().isLength({ max: 40 }),
  query('category').optional().isString().trim().isLength({ max: 120 }),
  query('type').optional().isString().trim().isLength({ max: 120 }),
  query('status').optional().isString().trim().isLength({ max: 40 }),
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
];

const archiveIdParam = [param('id').isInt().toInt()];

module.exports = {
  archivesListValidator,
  archiveIdParam,
};
