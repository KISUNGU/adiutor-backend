const { validationResult } = require('express-validator');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  return next();
};
