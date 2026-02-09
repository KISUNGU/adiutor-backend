import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

// --- NOUVEAUX IMPORTS DE L'ANCIEN SERVEUR ---
import { OpenAI } from 'openai';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import winston from 'winston';
import PDFParse from 'pdf-parse';


// Importation des fonctions du memory-vector-store (ASSUREZ-VOUS QUE CES FICHIERS EXISTENT
// ET SONT ADAPTÉS À MySQL si elles interagissent avec la DB)
// import { queryMemoryStore, buildMemoryStore } from './ai/memory-vector-store.js';


// --- CONFIGURATION EXISTANTE (NOUVEAU SERVEUR) ---
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_token_fort_et_long';

const app = express();
app.use(cors());
app.use(express.json());

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'chatbot_admin';
const PORT = process.env.PORT || 4000;

// --- NOUVELLES INITIALISATIONS DE L'ANCIEN SERVEUR ---
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Not loaded');

// Configuration du logger Winston
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log' }),
  ],
});

// __dirname n'est pas directement disponible avec les modules ES6.
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, 'Uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// Configuration pour les fichiers joints (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(UPLOADS_DIR, { recursive: true }).then(() => {
      cb(null, UPLOADS_DIR);
    }).catch(err => {
      logger.error('Erreur lors de la création du dossier Uploads:', err.message);
      cb(err);
    });
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });


// --- CONNEXION À LA BASE DE DONNÉES ET CRÉATION DES TABLES (MODIFIÉ) ---
let pool;

async function connectToDatabase() {
  try {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    await pool.getConnection(); // Teste la connexion
    console.log('✅ Connecté à MySQL avec un pool de connexions !');
    await createTables(); // Appelle la fonction de création des tables
  } catch (err) {
    console.error('❌ Erreur MySQL lors de la connexion ou création des tables :', err);
    process.exit(1);
  }
}

// Nouvelle fonction pour créer toutes les tables
async function createTables() {
    console.log('Vérification et création des tables MySQL...');
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user'
        )`,
        `CREATE TABLE IF NOT EXISTS incoming_mails (
            id INT PRIMARY KEY AUTO_INCREMENT,
            subject VARCHAR(255) NOT NULL,
            sender VARCHAR(255) NOT NULL,
            mail_date VARCHAR(255) NOT NULL, -- Date as string, adjust if specific date type is needed
            arrival_date VARCHAR(255) NOT NULL, -- Date as string
            ref_code VARCHAR(255),
            file_path VARCHAR(255),
            status VARCHAR(50),
            comment TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS outgoing_mails (
            id INT PRIMARY KEY AUTO_INCREMENT,
            subject VARCHAR(255) NOT NULL,
            recipient VARCHAR(255) NOT NULL,
            send_date VARCHAR(255) NOT NULL, -- Date as string
            file_path VARCHAR(255)
        )`,
        `CREATE TABLE IF NOT EXISTS contrats (
            id INT PRIMARY KEY AUTO_INCREMENT,
            employee VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
            start_date VARCHAR(255) NOT NULL, -- Date as string
            end_date VARCHAR(255), -- Date as string
            file_path VARCHAR(255)
        )`,
        `CREATE TABLE IF NOT EXISTS approvisionnements (
            id INT PRIMARY KEY AUTO_INCREMENT,
            date VARCHAR(255) NOT NULL, -- Date as string
            amount DOUBLE NOT NULL, -- Utilisez DOUBLE pour les montants décimaux
            description TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS achats (
            id INT PRIMARY KEY AUTO_INCREMENT,
            date VARCHAR(255) NOT NULL, -- Date as string
            supplier VARCHAR(255) NOT NULL,
            amount DOUBLE NOT NULL, -- Utilisez DOUBLE
            description TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS paiements (
            id INT PRIMARY KEY AUTO_INCREMENT,
            date VARCHAR(255) NOT NULL, -- Date as string
            amount DOUBLE NOT NULL, -- Utilisez DOUBLE
            description TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS stocks (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(255) NOT NULL,
            quantity INT NOT NULL,
            entry_date VARCHAR(255) NOT NULL -- Date as string
        )`,
        `CREATE TABLE IF NOT EXISTS reservations (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            destination VARCHAR(255) NOT NULL,
            date VARCHAR(255) NOT NULL, -- Date as string
            type VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS appels (
            id INT PRIMARY KEY AUTO_INCREMENT,
            reference VARCHAR(255) NOT NULL,
            datePublication VARCHAR(255) NOT NULL, -- Date as string
            dateCloture VARCHAR(255) NOT NULL, -- Date as string
            statut VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS rapports (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            date VARCHAR(255) NOT NULL, -- Date as string
            type VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS mobilisations (
            id INT PRIMARY KEY AUTO_INCREMENT,
            source VARCHAR(255) NOT NULL,
            amount DOUBLE NOT NULL, -- Utilisez DOUBLE
            date VARCHAR(255) NOT NULL -- Date as string
        )`,
        `CREATE TABLE IF NOT EXISTS archives (
            id INT PRIMARY KEY AUTO_INCREMENT,
            reference VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
            date VARCHAR(255) NOT NULL, -- Date as string
            description TEXT,
            file_path VARCHAR(255),
            category VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS pv (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS directory (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            position VARCHAR(255),
            organization VARCHAR(255),
            email VARCHAR(255),
            category VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS equipments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
            status VARCHAR(255) NOT NULL,
            acquisition_date VARCHAR(255) NOT NULL -- Date as string
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
            id INT PRIMARY KEY AUTO_INCREMENT,
            session_id VARCHAR(255) NOT NULL,
            user_id VARCHAR(255), -- VARCHAR pour compatibilité avec 'user_123'
            role VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP -- Utilisation de DATETIME pour les timestamps
        )`,
        `CREATE TABLE IF NOT EXISTS files (
            id INT PRIMARY KEY AUTO_INCREMENT,
            filename VARCHAR(255) NOT NULL,
            path VARCHAR(255) NOT NULL,
            upload_date VARCHAR(255) NOT NULL, -- Date as string
            extracted_text LONGTEXT -- LONGTEXT pour de très longs textes extraits de PDF
        )`
    ];

    for (const sql of tables) {
        try {
            await pool.execute(sql);
            console.log(`Table créée ou existante: ${sql.split(' ')[5]}`); // Log le nom de la table
        } catch (err) {
            console.error(`Erreur lors de la création de la table : ${sql}`, err.message);
            // Ne pas arrêter l'application, juste logger l'erreur
        }
    }
}

connectToDatabase();

// --- MIDDLEWARE D'AUTHENTIFICATION (EXISTANT) ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Accès non autorisé : Token manquant.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT Verification Error:', err.name, err.message);
      return res.status(403).json({ message: 'Token invalide ou expiré.' });
    }
    req.user = user;
    next();
  });
}

// --- FONCTIONS UTILITAIRES (DÉPLACÉES ET ADAPTÉES) ---

// Fonction pour extraire le texte d'un PDF
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const pdf = await PDFParse(dataBuffer);
    return pdf.text.trim();
  } catch (error) {
    logger.error('Erreur extraction texte PDF', { filePath, error: error.message });
    return '';
  }
}

// Fonction pour extraire le texte de tous les PDF dans Uploads
async function getAllPDFContent() {
  try {
    const files = await fs.readdir(UPLOADS_DIR); // Utilise la variable UPLOADS_DIR
    const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');
    let combinedText = '';

    for (const file of pdfFiles) {
      const filePath = path.join(UPLOADS_DIR, file);
      const text = await extractTextFromPDF(filePath);
      if (text) {
        combinedText += `\n--- Contenu de ${file} ---\n${text}\n`;
      }
    }
    return combinedText;
  } catch (error) {
    logger.error('Erreur lecture dossier Uploads', { error: error.message });
    return '';
  }
}

// --- ROUTES API (MIGRÉES DE SQLite VERS MySQL) ---

app.get('/', (req, res) => {
  res.send('Bienvenue dans le backend !');
});

// Récupérer les courriers entrants (PROTÉGÉE)
app.get('/api/mails/incoming', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM incoming_mails');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des courriers entrants :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les contrats (PROTÉGÉE)
app.get('/api/contrats', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM contrats');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des contrats :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les approvisionnements (PROTÉGÉE)
app.get('/api/approvisionnements', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM approvisionnements');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des approvisionnements :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les stocks (PROTÉGÉE)
app.get('/api/stocks', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM stocks');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des stocks :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les archives par catégorie (PROTÉGÉE)
app.get('/api/archives/:category', authenticateToken, async (req, res) => {
  const { category } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM archives WHERE category = ?', [category]);
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des documents (archives) :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les PV par catégorie (PROTÉGÉE)
app.get('/api/pv/:category', authenticateToken, async (req, res) => {
  const { category } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM pv WHERE category = ?', [category]);
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des documents (PV) :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer le répertoire (PROTÉGÉE)
app.get('/api/directory', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM directory');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des entrées de répertoire :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les équipements (PROTÉGÉE)
app.get('/api/equipments', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM equipments');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des équipements :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les achats (PROTÉGÉE)
app.get('/api/achats', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM achats');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des achats :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les paiements (PROTÉGÉE)
app.get('/api/paiements', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM paiements');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des paiements :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les réservations (PROTÉGÉE)
app.get('/api/reservations', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reservations');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des réservations :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les appels d'offres (PROTÉGÉE)
app.get('/api/appels', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM appels');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des appels d\'offres :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les rapports (PROTÉGÉE)
app.get('/api/rapports', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rapports');
    res.json(rows);
  } catch (err) {
    logger.error('Erreur lors de la récupération des rapports :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les noms de fichiers (PROTÉGÉE)
app.get('/api/files', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT filename FROM files');
    const files = rows.map((row) => row.filename);
    res.json({ files });
  } catch (err) {
    logger.error('Erreur lors de la récupération des fichiers', { error: err.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un approvisionnement (PROTÉGÉE)
app.post('/api/approvisionnements', authenticateToken, async (req, res) => {
  const { date, amount, description } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO approvisionnements (date, amount, description) VALUES (?, ?, ?)`,
      [date, amount, description]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un approvisionnement :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un achat (PROTÉGÉE)
app.post('/api/achats', authenticateToken, async (req, res) => {
  const { date, supplier, amount, description } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO achats (date, supplier, amount, description) VALUES (?, ?, ?, ?)`,
      [date, supplier, amount, description]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un achat :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une mobilisation (PROTÉGÉE)
app.post('/api/mobilisations', authenticateToken, async (req, res) => {
  const { source, amount, date } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO mobilisations (source, amount, date) VALUES (?, ?, ?)`,
      [source, amount, date]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'une mobilisation :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un stock (PROTÉGÉE)
app.post('/api/stocks', authenticateToken, async (req, res) => {
  const { name, category, quantity, entry_date } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO stocks (name, category, quantity, entry_date) VALUES (?, ?, ?, ?)`,
      [name, category, quantity, entry_date]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un stock :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un contrat avec upload de fichier (PROTÉGÉE)
app.post('/api/contrats', authenticateToken, upload.single('file'), async (req, res) => {
  const { employee, type, start_date, end_date } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  console.log('Données reçues pour ajout de contrat :', { employee, type, start_date, end_date, file_path });

  try {
    const [results] = await pool.execute(
      `INSERT INTO contrats (employee, type, start_date, end_date, file_path)
       VALUES (?, ?, ?, ?, ?)`,
      [employee, type, start_date, end_date, file_path]
    );
    res.status(201).json({ id: results.insertId, message: 'Contrat ajouté avec succès' });
  } catch (err) {
    logger.error('Erreur lors de l\'insertion d\'un contrat :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un rapport (PROTÉGÉE)
app.post('/api/rapports', authenticateToken, async (req, res) => {
  const { title, date, type } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO rapports (title, date, type) VALUES (?, ?, ?)`,
      [title, date, type]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un rapport :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un courrier sortant avec upload de fichier (PROTÉGÉE)
app.post('/api/mails/outgoing', authenticateToken, upload.single('file'), async (req, res) => {
  const { subject, recipient, send_date } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [results] = await pool.execute(
      `INSERT INTO outgoing_mails (subject, recipient, send_date, file_path)
       VALUES (?, ?, ?, ?)`,
      [subject, recipient, send_date, file_path]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout du courrier sortant :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un paiement (PROTÉGÉE)
app.post('/api/paiements', authenticateToken, async (req, res) => {
  const { date, amount, description } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO paiements (date, amount, description) VALUES (?, ?, ?)`,
      [date, amount, description]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un paiement :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une archive (PROTÉGÉE)
app.post('/api/archives', authenticateToken, async (req, res) => {
  const { reference, type, date, description, file_path, category } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO archives (reference, type, date, description, file_path, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [reference, type, date, description, file_path, category]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un document (archive) :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un PV (PROTÉGÉE)
app.post('/api/pv', authenticateToken, async (req, res) => {
  const { title, category } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO pv (title, category) VALUES (?, ?)`,
      [title, category]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un document (PV) :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un courrier entrant avec upload de fichier (PROTÉGÉE)
app.post('/api/mails/incoming', authenticateToken, upload.single('file'), async (req, res) => {
  const { subject, sender, mail_date, arrival_date, ref_code } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  if (!subject || !sender || !mail_date || !arrival_date) {
    return res.status(400).json({ error: 'Les champs subject, sender, mail_date et arrival_date sont requis.' });
  }

  console.log('Données reçues pour courrier entrant :', { subject, sender, mail_date, arrival_date, ref_code, file_path });

  try {
    const [results] = await pool.execute(
      `INSERT INTO incoming_mails (subject, sender, mail_date, arrival_date, ref_code, file_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subject, sender, mail_date, arrival_date, ref_code, file_path]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout du courrier entrant :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une entrée d'annuaire (PROTÉGÉE)
app.post('/api/directory', authenticateToken, async (req, res) => {
  const { name, position, organization, email, category } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO directory (name, position, organization, email, category) VALUES (?, ?, ?, ?, ?)`,
      [name, position, organization, email, category]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout de l\'entrée d\'annuaire :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un équipement (PROTÉGÉE)
app.post('/api/equipments', authenticateToken, async (req, res) => {
  const { name, type, status, acquisition_date } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO equipments (name, type, status, acquisition_date) VALUES (?, ?, ?, ?)`,
      [name, type, status, acquisition_date]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un équipement :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une réservation (PROTÉGÉE)
app.post('/api/reservations', authenticateToken, async (req, res) => {
  const { name, destination, date, type } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO reservations (name, destination, date, type) VALUES (?, ?, ?, ?)`,
      [name, destination, date, type]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'une réservation :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un appel d'offres (PROTÉGÉE)
app.post('/api/appels', authenticateToken, async (req, res) => {
  const { reference, datePublication, dateCloture, statut } = req.body;
  try {
    const [results] = await pool.execute(
      `INSERT INTO appels (reference, datePublication, dateCloture, statut) VALUES (?, ?, ?, ?)`,
      [reference, datePublication, dateCloture, statut]
    );
    res.status(201).json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un appel d\'offres :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Requête AI générique (PROTÉGÉE)
app.post('/api/ai-query', authenticateToken, async (req, res) => {
  const { query } = req.body;
  if (typeof query !== 'string' || query.length > 1000) {
    return res.status(400).json({ error: 'Query invalide ou trop long.' });
  }

  if (!query) {
    return res.status(400).json({ error: 'Le champ query est requis.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Clé API OpenAI manquante.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: query }],
      max_tokens: 1000,
    });

    res.json({ result: completion.choices[0].message.content });
  } catch (error) {
    logger.error(`Erreur IA: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: `Erreur lors de la requête IA: ${error.message}` });
  }
});

// Demander à OpenAI avec contexte (PROTÉGÉE)
app.post('/api/ask-openai', authenticateToken, async (req, res) => {
  const { question, user_id } = req.body; // user_id peut être extrait de req.user.id maintenant

  if (!question || question.trim() === '' || typeof question !== 'string' || question.length > 1000) {
    return res.status(400).json({ error: 'Question invalide ou trop longue.' });
  }

  try {
    // Obtenir le contexte du magasin vectoriel
    // !!! ATTENTION : Assurez-vous que queryMemoryStore est compatible avec MySQL si elle interagit avec la DB !!!
    const vectorContext = await queryMemoryStore(question);

    // Obtenir le contenu des PDF
    const pdfContent = await getAllPDFContent();

    const prompt = `
      Tu es un assistant IA qui aide à gérer les courriers internes, contrats, et documents de l’organisation.
      Contexte du magasin vectoriel :
      ${vectorContext || 'Aucun contexte vectoriel disponible.'}
      
      Contenu des documents PDF uploadés :
      ${pdfContent || 'Aucun document PDF disponible.'}
      
      Question de l'utilisateur : ${question.trim()}
      
      Réponds précisément en te basant sur le contexte et les documents fournis si pertinent, sinon utilise tes connaissances générales.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Tu es un assistant IA précis et professionnel.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const result = completion.choices[0].message.content.trim();

    const currentUserId = req.user ? req.user.id : (user_id || 'anonymous'); // Utilise l'ID de l'utilisateur authentifié

    // Sauvegarder dans messages (UTILISE pool.execute)
    await pool.execute(
      `INSERT INTO messages (session_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [Date.now().toString(), currentUserId, 'user', question.trim(), new Date().toISOString()]
    );
    await pool.execute(
      `INSERT INTO messages (session_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [Date.now().toString(), currentUserId, 'assistant', result, new Date().toISOString()]
    );

    res.json({ result });
  } catch (error) {
    logger.error('Erreur lors de la requête IA', { error: error.message, stack: error.stack });
    res.status(500).json({ error: `Erreur lors de la requête IA: ${error.message}` });
  }
});

// Upload de PDF avec extraction de texte (PROTÉGÉE)
app.post('/api/upload', authenticateToken, upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  const filePath = path.join(UPLOADS_DIR, req.file.filename); // Utilise UPLOADS_DIR
  const extractedText = await extractTextFromPDF(filePath);

  try {
    const [results] = await pool.execute(
      `INSERT INTO files (filename, path, upload_date, extracted_text) VALUES (?, ?, ?, ?)`,
      [req.file.originalname, `/uploads/${req.file.filename}`, new Date().toISOString(), extractedText]
    );
    res.json({ message: `Fichier ${req.file.originalname} téléversé avec succès.`, id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'enregistrement du fichier :', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de l\'enregistrement du fichier.' });
  }
});

// Réindexation des documents (PROTÉGÉE)
app.post('/api/reindex', authenticateToken, async (req, res) => {
  try {
    const files = await fs.readdir(UPLOADS_DIR); // Utilise UPLOADS_DIR
    const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

    for (const file of pdfFiles) {
      const filePath = path.join(UPLOADS_DIR, file); // Utilise UPLOADS_DIR
      const extractedText = await extractTextFromPDF(filePath);
      await pool.execute( // Utilise pool.execute pour UPDATE
        `UPDATE files SET extracted_text = ? WHERE path = ?`,
        [extractedText, `/uploads/${file}`]
      );
    }

    // Relancer l'indexation du magasin vectoriel
    // !!! ATTENTION : Assurez-vous que buildMemoryStore est compatible avec MySQL si elle interagit avec la DB !!!
    await buildMemoryStore();

    logger.info('Réindexation déclenchée.');
    res.json({ message: 'Réindexation effectuée.' });
  } catch (error) {
    logger.error('Erreur réindexation', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la réindexation' });
  }
});

// Ajouter un message (PROTÉGÉE)
app.post('/api/messages', authenticateToken, async (req, res) => {
  const { session_id, user_id, role, content } = req.body;
  const currentUserId = req.user ? req.user.id : (user_id || 'anonymous'); // Utilise l'ID de l'utilisateur authentifié
  try {
    const [results] = await pool.execute(
      `INSERT INTO messages (session_id, user_id, role, content) VALUES (?, ?, ?, ?)`,
      [session_id, currentUserId, role, content]
    );
    res.json({ id: results.insertId });
  } catch (err) {
    logger.error('Erreur lors de l\'ajout d\'un message :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les messages d'une session (PROTÉGÉE)
app.get('/api/messages/:session_id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
      [req.params.session_id]
    );
    res.json({ messages: rows });
  } catch (err) {
    logger.error('Erreur lors de la récupération des messages de session :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les conversations d'un utilisateur (PROTÉGÉE)
app.get('/api/conversations/:user_id', authenticateToken, async (req, res) => {
  // L'ID utilisateur devrait correspondre à req.user.id pour des raisons de sécurité
  if (req.params.user_id !== String(req.user.id)) {
      return res.status(403).json({ message: 'Accès non autorisé aux conversations d\'un autre utilisateur.' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT session_id, MAX(timestamp) as last FROM messages WHERE user_id = ? GROUP BY session_id ORDER BY last DESC`,
      [req.params.user_id]
    );
    res.json({ sessions: rows });
  } catch (err) {
    logger.error('Erreur lors de la récupération des conversations :', err.message);
    res.status(500).json({ error: err.message });
  }
});


// Mettre à jour le statut d'un courrier entrant (PROTÉGÉE)
app.put('/api/mails/incoming/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, comment } = req.body;

  try {
    const [results] = await pool.execute(
      `UPDATE incoming_mails SET status = ?, comment = ? WHERE id = ?`,
      [status, comment, id]
    );
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Courrier non trouvé.' });
    }
    res.status(200).json({ message: 'Courrier mis à jour avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la mise à jour du courrier entrant :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Archiver un courrier entrant (PROTÉGÉE)
app.put('/api/mails/incoming/:id/archive', authenticateToken, async (req, res) => {
  const { id } = req.params;

  console.log(`Tentative d'archivage pour l'ID : ${id}`);
  try {
    const [results] = await pool.execute(
      `UPDATE incoming_mails SET status = 'Archivé' WHERE id = ?`,
      [id]
    );
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Courrier non trouvé.' });
    }
    console.log(`Courrier avec l'ID ${id} archivé avec succès.`);
    res.status(200).json({ message: 'Courrier archivé avec succès' });
  } catch (err) {
    logger.error('Erreur lors de l\'archivage du courrier :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une archive (PROTÉGÉE)
app.delete('/api/archives/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM archives WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Document d\'archive non trouvé.' });
    }
    res.status(200).json({ message: 'Document supprimé avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression du document (archive) :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un PV (PROTÉGÉE)
app.delete('/api/pv/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM pv WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Document PV non trouvé.' });
    }
    res.status(200).json({ message: 'Document PV supprimé avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression du document (PV) :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une entrée d'annuaire (PROTÉGÉE)
app.delete('/api/directory/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM directory WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Entrée d\'annuaire non trouvée.' });
    }
    res.status(200).json({ message: 'Entrée supprimée avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression de l\'entrée d\'annuaire :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un contrat (PROTÉGÉE)
app.delete('/api/contrats/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM contrats WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Contrat non trouvé.' });
    }
    res.status(200).json({ message: 'Contrat supprimé avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression du contrat :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un courrier entrant (PROTÉGÉE)
app.delete('/api/mails/incoming/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM incoming_mails WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Courrier entrant non trouvé.' });
    }
    res.status(200).json({ message: 'Courrier supprimé avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression du courrier entrant :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un stock (PROTÉGÉE)
app.delete('/api/stocks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM stocks WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Stock non trouvé.' });
    }
    res.status(200).json({ message: 'Stock supprimé avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression d\'un stock :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un équipement (PROTÉGÉE)
app.delete('/api/equipments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM equipments WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Équipement non trouvé.' });
    }
    res.status(200).json({ message: 'Équipement supprimé avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression de l\'équipement :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une réservation (PROTÉGÉE)
app.delete('/api/reservations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.execute(`DELETE FROM reservations WHERE id = ?`, [id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Réservation non trouvée.' });
    }
    res.status(200).json({ message: 'Réservation supprimée avec succès' });
  } catch (err) {
    logger.error('Erreur lors de la suppression de la réservation :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🆔 Authentification (EXISTANTE)
// 🔐 Connexion
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('🛂 Reçu dans login:', { email, password });

  try {
    const [results] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (results.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const user = results[0];
    console.log('🔐 Utilisateur trouvé :', user);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('🔥 Erreur login :', err);
    res.status(500).json({ message: 'Erreur serveur' }); // ← Vérifie que cette ligne est bien là
  }
});


// 🔐 Changement de mot de passe
app.post('/api/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ message: 'Mot de passe mis à jour.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});


// 🆕 Enregistrement
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nom, email et mot de passe sont requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultRole = 'user';

    await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, defaultRole]
    );

    res.status(201).json({ message: 'Utilisateur enregistré avec succès !' });
  } catch (err) {
    console.error('Erreur enregistrement :', err);
    res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement.' });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});