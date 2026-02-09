const express = require('express');

module.exports = function hrRoutes({ authenticateToken, db, bcrypt }) {
  const router = express.Router();

  router.post('/positions', authenticateToken, (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Le titre du poste est requis.' });

    db.run('INSERT INTO positions (title) VALUES (?)', [title], function (err) {
      if (err) {
        console.error('Erreur création poste :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, title });
    });
  });

  router.get('/positions', authenticateToken, (req, res) => {
    db.all('SELECT * FROM positions', [], (err, rows) => {
      if (err) {
        console.error('Erreur récupération postes :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.post('/departments', authenticateToken, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom du département est requis.' });

    db.run('INSERT INTO departments (name) VALUES (?)', [name], function (err) {
      if (err) {
        console.error('Erreur création département :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name });
    });
  });

  router.get('/departments', authenticateToken, (req, res) => {
    db.all('SELECT * FROM departments', [], (err, rows) => {
      if (err) {
        console.error('Erreur récupération départements :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.get('/fonctions', authenticateToken, (req, res) => {
    db.all('SELECT id, title, title_complete FROM fonctions ORDER BY title', [], (err, rows) => {
      if (err) {
        console.error('Erreur récupération fonctions :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.post('/fonctions', authenticateToken, (req, res) => {
    const { title, title_complete } = req.body;
    if (!title) return res.status(400).json({ error: 'Le titre de la fonction est requis.' });

    db.run(
      'INSERT INTO fonctions (title, title_complete) VALUES (?, ?)',
      [title, title_complete || null],
      function (err) {
        if (err) {
          console.error('Erreur création fonction :', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, title, title_complete });
      },
    );
  });

  router.get('/departements', authenticateToken, (req, res) => {
    db.all('SELECT id, name FROM departements ORDER BY name', [], (err, rows) => {
      if (err) {
        console.error('Erreur récupération départements :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.post('/departements', authenticateToken, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom du département est requis.' });

    db.run('INSERT INTO departements (name) VALUES (?)', [name], function (err) {
      if (err) {
        console.error('Erreur création département :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name });
    });
  });

  router.get('/sous_departements', authenticateToken, (req, res) => {
    const { departement_id } = req.query;
    let sql = 'SELECT id, name, departement_id FROM sous_departements';
    const params = [];

    if (departement_id) {
      sql += ' WHERE departement_id = ?';
      params.push(departement_id);
    }

    sql += ' ORDER BY name';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erreur récupération sous-départements :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.post('/sous_departements', authenticateToken, (req, res) => {
    const { name, departement_id } = req.body;
    if (!name || !departement_id) {
      return res.status(400).json({ error: 'Le nom et le département parent sont requis.' });
    }

    db.run(
      'INSERT INTO sous_departements (name, departement_id) VALUES (?, ?)',
      [name, departement_id],
      function (err) {
        if (err) {
          console.error('Erreur création sous-département :', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, name, departement_id });
      },
    );
  });

  router.post('/personnel', authenticateToken, (req, res) => {
    const { name, email, position_id, department_id, phone } = req.body;
    if (!name || !position_id || !department_id) {
      return res.status(400).json({ error: 'Le nom, le poste et le département sont requis.' });
    }

    (async () => {
      try {
        const safeName = String(name || '').trim();
        const rawEmail = typeof email === 'string' ? email.trim() : '';
        const generatedEmail = `personnel_${Date.now()}_${Math.floor(Math.random() * 1e6)}@local`;
        const finalEmail = rawEmail || generatedEmail;
        const finalUsername = finalEmail;

        const passwordHash = await bcrypt.hash('disabled', 10);

        db.run(
          `INSERT INTO users (username, email, password, full_name, phone, fonction_id, departement_id, is_system_user, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
          [finalUsername, finalEmail, passwordHash, safeName, phone || null, position_id, department_id],
          function (err) {
            if (err) {
              console.error('Erreur création personnel (users) :', err.message);
              return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID });
          },
        );
      } catch (e) {
        console.error('Erreur création personnel (hash) :', e.message);
        return res.status(500).json({ error: e.message });
      }
    })();
  });

  router.get('/personnel', authenticateToken, (req, res) => {
    const sql = `
    SELECT 
      u.id, 
      COALESCE(u.full_name, u.username) AS name, 
      u.email, 
      u.phone,
      f.title AS position_title,
      d.name AS department_name,
      u.fonction_id AS position_id,
      u.departement_id AS department_id
    FROM users u
    LEFT JOIN fonctions f ON u.fonction_id = f.id
    LEFT JOIN departements d ON u.departement_id = d.id
    WHERE COALESCE(u.is_system_user, 1) = 0
  `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('Erreur récupération personnel :', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  return router;
};
