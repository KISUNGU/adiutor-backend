const { body, param } = require('express-validator');

const notificationIdParam = [
  param('id').isInt().withMessage('id invalide').toInt(),
];

const notificationCreateValidator = [
  body('user_id').notEmpty().withMessage('user_id requis').isInt().withMessage('user_id invalide').toInt(),
  body('type').notEmpty().withMessage('type requis').isString(),
  body('titre').notEmpty().withMessage('titre requis').isString(),
  body('message').notEmpty().withMessage('message requis').isString(),
  body('mail_id').optional().isInt().withMessage('mail_id invalide').toInt(),
];

module.exports = {
  notificationIdParam,
  notificationCreateValidator,
};
