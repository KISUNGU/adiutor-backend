const { param } = require('express-validator');

const pvCategoryParam = [param('category').isString().trim().isLength({ min: 1, max: 120 })];

module.exports = {
  pvCategoryParam,
};
