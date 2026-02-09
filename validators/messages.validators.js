const { body, param } = require('express-validator');

const sessionIdParam = [param('session_id').isString().trim().isLength({ min: 1, max: 120 })];
const userIdParam = [param('user_id').isInt().toInt()];

const messageCreateValidator = [
  body('session_id').isString().trim().notEmpty(),
  body('role').isString().trim().notEmpty(),
  body('content').isString().trim().notEmpty(),
];

module.exports = {
  sessionIdParam,
  userIdParam,
  messageCreateValidator,
};
