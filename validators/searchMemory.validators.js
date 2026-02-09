const { query } = require('express-validator');

const searchMemoryValidator = [
  query('q').isString().trim().notEmpty(),
];

module.exports = {
  searchMemoryValidator,
};
