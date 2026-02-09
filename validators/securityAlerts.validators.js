const { query } = require('express-validator');

const securityAlertsListValidator = [
  query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  query('severity').optional().isString().trim().isLength({ max: 30 }),
  query('status').optional().isString().trim().isLength({ max: 30 }),
];

module.exports = {
  securityAlertsListValidator,
};
