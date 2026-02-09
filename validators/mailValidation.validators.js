const { body, param } = require('express-validator');

const mailIdParam = [param('id').isInt().toInt()];

const mailValidateValidator = [
  body('comment').optional().isString().trim().isLength({ max: 2000 }),
  body('category').optional().isString().trim().isLength({ max: 120 }),
  body('classeur').optional().isString().trim().isLength({ max: 120 }),
  body('autoArchive').optional().isBoolean().toBoolean(),
];

module.exports = {
  mailIdParam,
  mailValidateValidator,
};
