const { param } = require('express-validator');

const mailIdParam = [param('id').isInt().toInt()];

module.exports = {
  mailIdParam,
};
