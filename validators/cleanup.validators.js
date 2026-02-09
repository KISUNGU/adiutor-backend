const { param } = require('express-validator');

const cleanupIdParam = [param('id').isInt().toInt()];

module.exports = {
  cleanupIdParam,
};
