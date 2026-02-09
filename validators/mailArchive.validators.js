const { body, param } = require('express-validator');

const mailIdParam = [param('id').isInt().toInt()];

const mailArchiveValidator = [
  body('comment').optional().isString().trim().isLength({ max: 2000 }),
  body('category').optional().isString().trim().isLength({ max: 120 }),
  body('classeur').optional().isString().trim().isLength({ max: 120 }),
];

module.exports = {
  mailIdParam,
  mailArchiveValidator,
};
