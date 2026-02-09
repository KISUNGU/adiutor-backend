const { body, param } = require('express-validator');

const mailIdParam = [param('id').isInt().toInt()];

const rafForwardValidator = [
  body('target')
    .isString()
    .trim()
    .isIn(['raf'])
    .withMessage('Target invalide. Utiliser raf.'),
  body('comment').optional().isString().trim().isLength({ max: 2000 }),
];

// caisseCompleteValidator supprimé (rôle CAISSE supprimé)

module.exports = {
  mailIdParam,
  rafForwardValidator,
};
