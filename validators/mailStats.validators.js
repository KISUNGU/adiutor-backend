const { query } = require('express-validator');

const mailStatisticsValidator = [
  query('period').optional().isString().trim().isLength({ max: 10 }),
];

module.exports = {
  mailStatisticsValidator,
};
