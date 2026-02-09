// Routes pour la gestion du profil utilisateur

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Configuration multer pour l'upload d'avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // req.user est disponible car authenticateToken est appliqué avant les routes
    const userId = req.user ? req.user.id : 'unknown';
    cb(null, 'avatar-' + userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez JPG, PNG ou GIF.'));
    }
  }
});

// GET /api/user/profile - Récupérer le profil utilisateur
router.get('/profile', (req, res) => {
  const userId = req.user.id;
  
  const sql = `
    SELECT 
      u.id, u.username, u.email, u.role_id, u.created_at,
      up.phone, up.bio, up.position, up.department, up.avatar,
      up.preferences, up.notification_settings
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE u.id = ?
  `;
  
  req.db.get(sql, [userId], (err, user) => {
    if (err) {
      console.error('Erreur récupération profil:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Parser les JSON si présents
    if (user.preferences) {
      try {
        user.preferences = JSON.parse(user.preferences);
      } catch (e) {
        user.preferences = null;
      }
    }
    
    if (user.notification_settings) {
      try {
        user.notificationSettings = JSON.parse(user.notification_settings);
      } catch (e) {
        user.notificationSettings = null;
      }
    }
    
    res.json(user);
  });
});

// PUT /api/user/profile - Mettre à jour le profil
router.put('/profile', upload.single('avatar'), (req, res) => {
  const userId = req.user.id;
  const { username, email, phone, bio, position, department } = req.body;
  
  // Vérifier si l'email est déjà utilisé par un autre utilisateur
  const checkEmailSql = `SELECT id FROM users WHERE email = ? AND id != ?`;
  req.db.get(checkEmailSql, [email, userId], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    if (existingUser) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    
    // Mettre à jour la table users
    const updateUserSql = `UPDATE users SET username = ?, email = ? WHERE id = ?`;
    req.db.run(updateUserSql, [username, email, userId], function(userErr) {
      if (userErr) {
        console.error('Erreur mise à jour user:', userErr);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
      }
      
      // Préparer les données du profil
      let avatarFilename = null;
      if (req.file) {
        avatarFilename = req.file.filename; // Seulement le nom du fichier
      }
      
      // Vérifier si un profil existe déjà
      const checkProfileSql = `SELECT user_id FROM user_profiles WHERE user_id = ?`;
      req.db.get(checkProfileSql, [userId], (checkErr, profile) => {
        if (checkErr) {
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        let profileSql, profileParams;
        
        if (profile) {
          // UPDATE
          if (avatarFilename) {
            profileSql = `
              UPDATE user_profiles 
              SET phone = ?, bio = ?, position = ?, department = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ?
            `;
            profileParams = [phone, bio, position, department, avatarFilename, userId];
          } else {
            profileSql = `
              UPDATE user_profiles 
              SET phone = ?, bio = ?, position = ?, department = ?, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ?
            `;
            profileParams = [phone, bio, position, department, userId];
          }
        } else {
          // INSERT
          profileSql = `
            INSERT INTO user_profiles (user_id, phone, bio, position, department, avatar)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          profileParams = [userId, phone, bio, position, department, avatarFilename];
        }
        
        req.db.run(profileSql, profileParams, function(profileErr) {
          if (profileErr) {
            console.error('Erreur mise à jour profil:', profileErr);
            return res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
          }
          
          res.json({ 
            message: 'Profil mis à jour avec succès',
            username,
            email,
            avatar: avatarFilename
          });
        });
      });
    });
  });
});

// POST /api/user/change-password - Changer le mot de passe
router.post('/change-password', async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }
  
  // Récupérer le mot de passe actuel
  const sql = `SELECT password FROM users WHERE id = ?`;
  req.db.get(sql, [userId], async (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    // Vérifier le mot de passe actuel
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    
    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Mettre à jour
    const updateSql = `UPDATE users SET password = ? WHERE id = ?`;
    req.db.run(updateSql, [hashedPassword, userId], function(updateErr) {
      if (updateErr) {
        console.error('Erreur changement mot de passe:', updateErr);
        return res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
      }
      
      res.json({ message: 'Mot de passe modifié avec succès' });
    });
  });
});

// PUT /api/user/notification-settings - Mettre à jour les paramètres de notification
router.put('/notification-settings', (req, res) => {
  const userId = req.user.id;
  const settings = JSON.stringify(req.body);
  
  const checkSql = `SELECT user_id FROM user_profiles WHERE user_id = ?`;
  req.db.get(checkSql, [userId], (err, profile) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    let sql, params;
    if (profile) {
      sql = `UPDATE user_profiles SET notification_settings = ? WHERE user_id = ?`;
      params = [settings, userId];
    } else {
      sql = `INSERT INTO user_profiles (user_id, notification_settings) VALUES (?, ?)`;
      params = [userId, settings];
    }
    
    req.db.run(sql, params, function(updateErr) {
      if (updateErr) {
        console.error('Erreur mise à jour notifications:', updateErr);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
      }
      
      res.json({ message: 'Paramètres de notification enregistrés' });
    });
  });
});

// PUT /api/user/preferences - Mettre à jour les préférences
router.put('/preferences', (req, res) => {
  const userId = req.user.id;
  const preferences = JSON.stringify(req.body);
  
  const checkSql = `SELECT user_id FROM user_profiles WHERE user_id = ?`;
  req.db.get(checkSql, [userId], (err, profile) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    let sql, params;
    if (profile) {
      sql = `UPDATE user_profiles SET preferences = ? WHERE user_id = ?`;
      params = [preferences, userId];
    } else {
      sql = `INSERT INTO user_profiles (user_id, preferences) VALUES (?, ?)`;
      params = [userId, preferences];
    }
    
    req.db.run(sql, params, function(updateErr) {
      if (updateErr) {
        console.error('Erreur mise à jour préférences:', updateErr);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
      }
      
      res.json({ message: 'Préférences enregistrées' });
    });
  });
});

module.exports = router;
