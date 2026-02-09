// 🔒 Configuration OAuth 2.0 avec Passport.js
require('dotenv').config();
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;

/**
 * 🔒 Configuration OAuth 2.0 générique
 * Peut être adapté pour différents providers (Google, Microsoft, Keycloak, etc.)
 */

// Sérialisation utilisateur (stockage en session)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  // À implémenter: récupérer l'utilisateur depuis la BDD
  // Pour l'instant, on retourne l'ID
  done(null, { id });
});

/**
 * Stratégie Google OAuth 2.0
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Extraire les infos du profil Google
      const userInfo = {
        googleId: profile.id,
        email: profile.emails[0].value,
        displayName: profile.displayName,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        photo: profile.photos[0]?.value,
        provider: 'google'
      };

      // TODO: Vérifier si l'utilisateur existe déjà en BDD
      // Si non, le créer
      // Si oui, mettre à jour le token

      console.log('✅ Authentification Google réussie:', userInfo.email);
      return done(null, userInfo);
    } catch (error) {
      console.error('❌ Erreur OAuth Google:', error);
      return done(error, null);
    }
  }));
  
  console.log('✅ Stratégie Google OAuth configurée');
}

/**
 * Stratégie OAuth 2.0 Générique (Keycloak, Auth0, etc.)
 */
if (process.env.OAUTH2_CLIENT_ID && process.env.OAUTH2_CLIENT_SECRET) {
  passport.use('oauth2-generic', new OAuth2Strategy({
    authorizationURL: process.env.OAUTH2_AUTHORIZATION_URL,
    tokenURL: process.env.OAUTH2_TOKEN_URL,
    clientID: process.env.OAUTH2_CLIENT_ID,
    clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    callbackURL: process.env.OAUTH2_CALLBACK_URL || 'http://localhost:4000/auth/oauth2/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Récupérer les infos utilisateur depuis le provider OAuth
      const userInfo = {
        accessToken,
        refreshToken,
        profile,
        provider: 'oauth2-generic'
      };

      console.log('✅ Authentification OAuth 2.0 réussie');
      return done(null, userInfo);
    } catch (error) {
      console.error('❌ Erreur OAuth 2.0:', error);
      return done(error, null);
    }
  }));
  
  console.log('✅ Stratégie OAuth 2.0 générique configurée');
}

/**
 * Middleware de vérification OAuth
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentification OAuth requise' });
}

module.exports = {
  passport,
  ensureAuthenticated
};
