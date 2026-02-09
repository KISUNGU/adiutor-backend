const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const validate = require('../middlewares/validate');
const { loginValidator, registerValidator, refreshValidator } = require('../validators/auth.validators');
const {
  createUserAsAdmin,
  loginUser,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} = require('../services/auth.service');

module.exports = function authRoutes({
  db,
  authenticateToken,
  loginLimiter,
  jwtSecret,
  getFrontendRole,
  getPermissions,
  getUIConfig,
  logUserRoleAudit,
}) {
  const router = express.Router();

  const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Trop de tentatives, veuillez réessayer plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post('/register', authenticateToken, registerValidator, validate, async (req, res, next) => {
    const username = req.body?.username || req.body?.name;
    const { email, password, role, role_id } = req.body || {};
    try {
      const user = await createUserAsAdmin({
        db,
        creator: req.user,
        username,
        email,
        password,
        role,
        role_id,
        logUserRoleAudit,
      });
      return res.status(201).json({ message: 'Utilisateur créé avec succès.', user });
    } catch (e) {
      return next(e);
    }
  });

  router.post('/login', loginLimiter, loginValidator, validate, async (req, res, next) => {
    const { email, username, password } = req.body || {};
    try {
      const user = await loginUser({ db, email, username, password });

      const token = jwt.sign(
        { id: user.id, username: user.username, role_id: user.role_id },
        jwtSecret,
        { expiresIn: '1h' },
      );

      const refresh = await issueRefreshToken({
        db,
        userId: user.id,
        ttlDays: 7,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const frontendRole = getFrontendRole(user.role_id);
      const permissions = getPermissions(user.role_id);
      const uiConfig = getUIConfig(user.role_id);

      return res.json({
        token,
        refresh_token: refresh.token,
        refresh_expires_at: refresh.expires_at,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role_id: user.role_id,
          role: frontendRole,
          permissions,
          ui_config: uiConfig,
        },
      });
    } catch (e) {
      return next(e);
    }
  });

  router.post('/refresh', refreshLimiter, refreshValidator, validate, async (req, res, next) => {
    const { refresh_token } = req.body || {};
    try {
      const rotated = await rotateRefreshToken({
        db,
        refreshToken: refresh_token,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        ttlDays: 7,
      });

      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [rotated.user_id], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

      const token = jwt.sign(
        { id: user.id, username: user.username, role_id: user.role_id },
        jwtSecret,
        { expiresIn: '1h' },
      );

      return res.json({
        token,
        refresh_token: rotated.refresh.token,
        refresh_expires_at: rotated.refresh.expires_at,
      });
    } catch (e) {
      return next(e);
    }
  });

  router.post('/logout', refreshLimiter, refreshValidator, validate, async (req, res, next) => {
    const { refresh_token } = req.body || {};
    try {
      await revokeRefreshToken({ db, refreshToken: refresh_token });
      return res.json({ success: true });
    } catch (e) {
      return next(e);
    }
  });

  return router;
};
