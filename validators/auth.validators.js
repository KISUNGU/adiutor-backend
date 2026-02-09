const { body } = require('express-validator');

const loginValidator = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('email invalide')
    .normalizeEmail(),
  body('username')
    .optional()
    .isString()
    .isLength({ min: 3 })
    .withMessage('username invalide')
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('password requis'),
];

const registerValidator = [
  body('email')
    .notEmpty()
    .withMessage('email requis')
    .isEmail()
    .withMessage('email invalide')
    .normalizeEmail(),
  body('username')
    .optional()
    .isString()
    .isLength({ min: 3 })
    .withMessage('username invalide')
    .trim(),
  body('name')
    .optional()
    .isString()
    .isLength({ min: 3 })
    .withMessage('name invalide')
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('password requis')
    .isLength({ min: 6 })
    .withMessage('password trop court'),
  body('role')
    .optional()
    .isString()
    .trim(),
  body('role_id')
    .optional()
    .isInt()
    .toInt(),
];

const refreshValidator = [
  body('refresh_token')
    .notEmpty()
    .withMessage('refresh_token requis')
    .isString(),
];

module.exports = {
  loginValidator,
  registerValidator,
  refreshValidator,
};
