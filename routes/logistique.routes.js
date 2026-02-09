const express = require('express')
const router = express.Router()
const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const authenticateToken = require('../middlewares/authenticateToken')

let db;

function ensureSchema() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_equipements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        designation TEXT,
        categorie TEXT,
        etat TEXT,
        localisation TEXT,
        dateAcquisition TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT UNIQUE,
        article TEXT,
        quantite INTEGER DEFAULT 0,
        unite TEXT,
        stockMin INTEGER DEFAULT 0
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_stock_mouvements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER NOT NULL,
        date TEXT,
        delta INTEGER NOT NULL,
        note TEXT,
        createdAt TEXT,
        FOREIGN KEY(stock_id) REFERENCES logistique_stocks(id)
      )
    `)

    db.run(`CREATE INDEX IF NOT EXISTS idx_logistique_stock_mouvements_stock_id ON logistique_stock_mouvements(stock_id)`)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_vehicules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        immatriculation TEXT UNIQUE,
        marque TEXT,
        modele TEXT,
        kilometrage INTEGER DEFAULT 0,
        statut TEXT,
        affectation TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_carburant (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        vehicule TEXT,
        typeCarburant TEXT,
        typeOperation TEXT,
        litres REAL DEFAULT 0,
        prixUnitaire REAL DEFAULT 0,
        montant REAL DEFAULT 0,
        kilometrage INTEGER,
        fournisseur TEXT,
        note TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_it_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        type TEXT,
        modele TEXT,
        statut TEXT,
        affectation TEXT,
        updatedAt TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_deploiements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        objet TEXT,
        statut TEXT,
        echeance TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_dotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beneficiaire TEXT,
        item TEXT,
        quantite INTEGER DEFAULT 0,
        statut TEXT,
        date TEXT,
        renouvellement TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_acquisitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT UNIQUE,
        objet TEXT,
        demandeur TEXT,
        statut TEXT,
        date TEXT,
        echeance TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_quittances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT UNIQUE,
        objet TEXT,
        fournisseur TEXT,
        statut TEXT,
        montant REAL DEFAULT 0,
        echeance TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS logistique_assurances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        police TEXT UNIQUE,
        type TEXT,
        objet TEXT,
        assureur TEXT,
        debut TEXT,
        fin TEXT
      )
    `)

    seedIfEmpty('logistique_equipements', [
      {
        code: 'EQ-IT-001',
        designation: 'Onduleur 2000VA',
        categorie: 'Informatique',
        etat: 'Fonctionnel',
        localisation: 'Salle serveurs',
        dateAcquisition: '2025-03-18'
      },
      {
        code: 'EQ-LOG-014',
        designation: 'Chariot de manutention',
        categorie: 'Magasin',
        etat: 'En maintenance',
        localisation: 'Dépôt central',
        dateAcquisition: '2024-11-05'
      },
      {
        code: 'EQ-SEC-002',
        designation: 'Extincteur CO2',
        categorie: 'Sécurité',
        etat: 'Hors service',
        localisation: 'Bâtiment A',
        dateAcquisition: '2023-07-20'
      }
    ], (row) => [
      row.code,
      row.designation,
      row.categorie,
      row.etat,
      row.localisation,
      row.dateAcquisition
    ], `INSERT OR IGNORE INTO logistique_equipements (code, designation, categorie, etat, localisation, dateAcquisition) VALUES (?,?,?,?,?,?)`)

    seedIfEmpty('logistique_stocks', [
      { reference: 'ST-001', article: 'Papier A4', quantite: 12, unite: 'Rames', stockMin: 10 },
      { reference: 'ST-002', article: 'Toner imprimante', quantite: 2, unite: 'Pièces', stockMin: 5 },
      { reference: 'ST-003', article: 'Gants de manutention', quantite: 0, unite: 'Paires', stockMin: 10 }
    ], (row) => [row.reference, row.article, row.quantite, row.unite, row.stockMin], `INSERT OR IGNORE INTO logistique_stocks (reference, article, quantite, unite, stockMin) VALUES (?,?,?,?,?)`)

    seedIfEmpty('logistique_vehicules', [
      {
        immatriculation: 'LT-123-AB',
        marque: 'Toyota',
        modele: 'Hilux',
        kilometrage: 84210,
        statut: 'Disponible',
        affectation: 'Logistique'
      },
      {
        immatriculation: 'LT-778-CD',
        marque: 'Nissan',
        modele: 'Navara',
        kilometrage: 120450,
        statut: 'En mission',
        affectation: 'Terrain'
      },
      {
        immatriculation: 'LT-004-EF',
        marque: 'Ford',
        modele: 'Ranger',
        kilometrage: 156300,
        statut: 'Maintenance',
        affectation: 'Atelier'
      }
    ], (row) => [
      row.immatriculation,
      row.marque,
      row.modele,
      row.kilometrage,
      row.statut,
      row.affectation
    ], `INSERT OR IGNORE INTO logistique_vehicules (immatriculation, marque, modele, kilometrage, statut, affectation) VALUES (?,?,?,?,?,?)`)

    seedIfEmpty('logistique_carburant', [
      {
        date: addDaysISO(-3),
        vehicule: 'LT-123-AB',
        typeCarburant: 'Diesel',
        typeOperation: 'Achat',
        litres: 45,
        prixUnitaire: 1.7,
        montant: 76.5,
        kilometrage: 84500,
        fournisseur: 'Station X',
        note: 'Plein'
      },
      {
        date: addDaysISO(-1),
        vehicule: 'LT-778-CD',
        typeCarburant: 'Diesel',
        typeOperation: 'Achat',
        litres: 30,
        prixUnitaire: 1.72,
        montant: 51.6,
        kilometrage: 120900,
        fournisseur: 'Station Y',
        note: 'Mission terrain'
      }
    ],
    (row) => [
      row.date,
      row.vehicule,
      row.typeCarburant,
      row.typeOperation,
      row.litres,
      row.prixUnitaire,
      row.montant,
      row.kilometrage,
      row.fournisseur,
      row.note
    ],
    `INSERT INTO logistique_carburant (date, vehicule, typeCarburant, typeOperation, litres, prixUnitaire, montant, kilometrage, fournisseur, note) VALUES (?,?,?,?,?,?,?,?,?,?)`)

    seedIfEmpty('logistique_it_assets', [
      {
        code: 'IT-PCS-101',
        type: 'PC Portable',
        modele: 'Dell Latitude',
        statut: 'En service',
        affectation: 'Comptabilité',
        updatedAt: '2025-12-18'
      },
      {
        code: 'IT-PRN-014',
        type: 'Imprimante',
        modele: 'HP LaserJet',
        statut: 'En réparation',
        affectation: 'Secrétariat',
        updatedAt: '2025-12-26'
      },
      {
        code: 'IT-NET-003',
        type: 'Switch',
        modele: 'Cisco 24 ports',
        statut: 'En service',
        affectation: 'Salle serveurs',
        updatedAt: '2025-11-02'
      }
    ], (row) => [row.code, row.type, row.modele, row.statut, row.affectation, row.updatedAt], `INSERT OR IGNORE INTO logistique_it_assets (code, type, modele, statut, affectation, updatedAt) VALUES (?,?,?,?,?,?)`)

    seedIfEmpty('logistique_deploiements', [
      { objet: 'Déploiement antivirus', statut: 'En cours', echeance: addDaysISO(5) },
      { objet: 'Mise à jour postes', statut: 'Planifié', echeance: addDaysISO(12) },
      { objet: 'Wi-Fi dépôt central', statut: 'Terminé', echeance: addDaysISO(-10) }
    ], (row) => [row.objet, row.statut, row.echeance], `INSERT INTO logistique_deploiements (objet, statut, echeance) VALUES (?,?,?)`)

    seedIfEmpty('logistique_dotations', [
      {
        beneficiaire: 'Service Informatique',
        item: 'Routeurs 4G',
        quantite: 3,
        statut: 'Active',
        date: '2025-10-15',
        renouvellement: addDaysISO(20)
      },
      {
        beneficiaire: 'Logistique',
        item: 'Gilets réfléchissants',
        quantite: 15,
        statut: 'Active',
        date: '2025-09-01',
        renouvellement: addDaysISO(90)
      },
      {
        beneficiaire: 'Comptabilité',
        item: 'Cartouches toner',
        quantite: 6,
        statut: 'En attente',
        date: '2025-12-20',
        renouvellement: null
      }
    ], (row) => [row.beneficiaire, row.item, row.quantite, row.statut, row.date, row.renouvellement], `INSERT INTO logistique_dotations (beneficiaire, item, quantite, statut, date, renouvellement) VALUES (?,?,?,?,?,?)`)

    seedIfEmpty('logistique_acquisitions', [
      {
        reference: 'ACQ-2025-019',
        objet: 'Achat PC portables',
        demandeur: 'Informatique',
        statut: 'En attente',
        date: '2025-12-05',
        echeance: addDaysISO(-2)
      },
      {
        reference: 'ACQ-2025-021',
        objet: 'Pneus véhicules',
        demandeur: 'Transport',
        statut: 'En attente',
        date: '2025-12-15',
        echeance: addDaysISO(10)
      },
      {
        reference: 'ACQ-2025-015',
        objet: 'Étagères dépôt',
        demandeur: 'Magasin',
        statut: 'Livrée',
        date: '2025-11-10',
        echeance: addDaysISO(-30)
      }
    ], (row) => [row.reference, row.objet, row.demandeur, row.statut, row.date, row.echeance], `INSERT OR IGNORE INTO logistique_acquisitions (reference, objet, demandeur, statut, date, echeance) VALUES (?,?,?,?,?,?)`)

    seedIfEmpty('logistique_quittances', [
      {
        numero: 'Q-2025-778',
        objet: 'Assurance véhicule LT-004-EF',
        fournisseur: 'Assureur X',
        statut: 'Non réglée',
        montant: 420,
        echeance: addDaysISO(-3)
      },
      {
        numero: 'Q-2025-801',
        objet: 'Internet - abonnement',
        fournisseur: 'FAI Y',
        statut: 'Non réglée',
        montant: 150,
        echeance: addDaysISO(4)
      },
      {
        numero: 'Q-2025-690',
        objet: 'Maintenance imprimantes',
        fournisseur: 'Prestataire Z',
        statut: 'Réglée',
        montant: 95,
        echeance: addDaysISO(-20)
      }
    ], (row) => [row.numero, row.objet, row.fournisseur, row.statut, row.montant, row.echeance], `INSERT OR IGNORE INTO logistique_quittances (numero, objet, fournisseur, statut, montant, echeance) VALUES (?,?,?,?,?,?)`)

    seedIfEmpty('logistique_assurances', [
      {
        police: 'POL-VEH-2025-001',
        type: 'Automobile',
        objet: 'LT-123-AB',
        assureur: 'Assureur X',
        debut: '2025-01-01',
        fin: addDaysISO(15)
      },
      {
        police: 'POL-VEH-2024-112',
        type: 'Automobile',
        objet: 'LT-004-EF',
        assureur: 'Assureur X',
        debut: '2024-01-01',
        fin: addDaysISO(-1)
      },
      {
        police: 'POL-MAT-2025-006',
        type: 'Matériel',
        objet: 'Salle serveurs',
        assureur: 'Assureur Y',
        debut: '2025-06-01',
        fin: addDaysISO(120)
      }
    ], (row) => [row.police, row.type, row.objet, row.assureur, row.debut, row.fin], `INSERT OR IGNORE INTO logistique_assurances (police, type, objet, assureur, debut, fin) VALUES (?,?,?,?,?,?)`)
  })
}

function seedIfEmpty(table, seedRows, toParams, insertSql) {
  db.get(`SELECT COUNT(1) as c FROM ${table}`, [], (err, row) => {
    if (err) {
      console.warn(`LOGISTIQUE seed check failed for ${table}:`, err.message)
      return
    }
    if ((row?.c || 0) > 0) return

    const stmt = db.prepare(insertSql)
    for (const r of seedRows) {
      stmt.run(toParams(r))
    }
    stmt.finalize()
  })
}

function addDaysISO(days) {
  const d = new Date()
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().slice(0, 10)
}

function sendAll(sql, params, res) {
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('LOGISTIQUE SQL error:', err.message)
      return res.status(500).json({ error: err.message })
    }
    return res.json(rows || [])
  })
}

function sendRun(sql, params, res) {
  db.run(sql, params, function (err) {
    if (err) {
      console.error('LOGISTIQUE SQL error:', err.message)
      return res.status(500).json({ error: err.message })
    }
    return res.json({ ok: true, changes: this.changes, lastID: this.lastID })
  })
}

function requireNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function requireNonEmptyString(value) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

router.get('/equipements', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, code, designation, categorie, etat, localisation, dateAcquisition FROM logistique_equipements ORDER BY id DESC`,
    [],
    res
  )
})

router.get('/stocks', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, reference, article, quantite, unite, stockMin FROM logistique_stocks ORDER BY article ASC`,
    [],
    res
  )
})

router.get('/stocks/:id/movements', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })

  return sendAll(
    `SELECT id, stock_id, date, delta, note, createdAt
     FROM logistique_stock_mouvements
     WHERE stock_id = ?
     ORDER BY id ASC`,
    [id],
    res
  )
})

router.get('/vehicules', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, immatriculation, marque, modele, kilometrage, statut, affectation FROM logistique_vehicules ORDER BY id DESC`,
    [],
    res
  )
})

router.get('/carburant', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, date, vehicule, typeCarburant, typeOperation, litres, prixUnitaire, montant, kilometrage, fournisseur, note
     FROM logistique_carburant
     ORDER BY date DESC, id DESC`,
    [],
    res
  )
})

router.get('/informatique/actifs', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, code, type, modele, statut, affectation, updatedAt FROM logistique_it_assets ORDER BY id DESC`,
    [],
    res
  )
})

router.get('/deploiements', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, objet, statut, echeance FROM logistique_deploiements ORDER BY id DESC`,
    [],
    res
  )
})

router.get('/dotations', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, beneficiaire, item, quantite, statut, date, renouvellement FROM logistique_dotations ORDER BY id DESC`,
    [],
    res
  )
})

router.get('/acquisitions', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, reference, objet, demandeur, statut, date, echeance FROM logistique_acquisitions ORDER BY id DESC`,
    [],
    res
  )
})

router.get('/quittances', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, numero, objet, fournisseur, statut, montant, echeance FROM logistique_quittances ORDER BY id DESC`,
    [],
    res
  )
})

router.get('/assurances', authenticateToken, (req, res) => {
  return sendAll(
    `SELECT id, police, type, objet, assureur, debut, fin FROM logistique_assurances ORDER BY id DESC`,
    [],
    res
  )
})

// =========================
// ECRITURES (POST/PUT)
// =========================

// Stocks: création
router.post('/stocks', authenticateToken, (req, res) => {
  const reference = requireNonEmptyString(req.body.reference)
  const article = requireNonEmptyString(req.body.article)
  const quantite = requireNumber(req.body.quantite) ?? 0
  const unite = requireNonEmptyString(req.body.unite)
  const stockMin = requireNumber(req.body.stockMin) ?? 0

  if (!reference || !article) {
    return res.status(400).json({ error: 'reference et article requis.' })
  }

  return sendRun(
    `INSERT INTO logistique_stocks (reference, article, quantite, unite, stockMin) VALUES (?,?,?,?,?)`,
    [reference, article, Math.trunc(quantite), unite, Math.trunc(stockMin)],
    res
  )
})

// Stocks: mise à jour
router.put('/stocks/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })

  const article = req.body.article
  const unite = req.body.unite
  const stockMin = req.body.stockMin
  const quantite = req.body.quantite

  return sendRun(
    `UPDATE logistique_stocks
     SET article = COALESCE(?, article),
         unite = COALESCE(?, unite),
         stockMin = COALESCE(?, stockMin),
         quantite = COALESCE(?, quantite)
     WHERE id = ?`,
    [
      article ?? null,
      unite ?? null,
      stockMin === undefined ? null : Math.trunc(requireNumber(stockMin) ?? 0),
      quantite === undefined ? null : Math.trunc(requireNumber(quantite) ?? 0),
      id
    ],
    res
  )
})

// Stocks: mouvement (+/-)
router.post('/stocks/:id/move', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  const delta = requireNumber(req.body.delta)
  if (!id) return res.status(400).json({ error: 'id invalide.' })
  if (delta === null) return res.status(400).json({ error: 'delta requis (nombre).' })

  const note = req.body.note ?? null
  const movementDate = req.body.date ?? null

  db.get(`SELECT quantite FROM logistique_stocks WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'Stock introuvable.' })

    const current = Number(row.quantite) || 0
    const desired = Math.trunc(delta)
    const applied = desired < 0 ? Math.max(-current, desired) : desired
    const next = current + applied

    if (applied === 0) {
      return res.json({ ok: true, id, current, next, applied })
    }

    const createdAt = new Date().toISOString()

    db.serialize(() => {
      db.run('BEGIN')
      db.run(
        `INSERT INTO logistique_stock_mouvements (stock_id, date, delta, note, createdAt) VALUES (?,?,?,?,?)`,
        [id, movementDate, applied, note, createdAt],
        (insErr) => {
          if (insErr) {
            db.run('ROLLBACK')
            return res.status(500).json({ error: insErr.message })
          }

          db.run(
            `UPDATE logistique_stocks SET quantite = ? WHERE id = ?`,
            [next, id],
            (updErr) => {
              if (updErr) {
                db.run('ROLLBACK')
                return res.status(500).json({ error: updErr.message })
              }
              db.run('COMMIT')
              return res.json({ ok: true, id, current, next, applied })
            },
          )
        },
      )
    })

    return
  })
})

// Équipements: création
router.post('/equipements', authenticateToken, (req, res) => {
  const code = requireNonEmptyString(req.body.code)
  const designation = requireNonEmptyString(req.body.designation)
  const categorie = req.body.categorie ?? null
  const etat = req.body.etat ?? 'Fonctionnel'
  const localisation = req.body.localisation ?? null
  const dateAcquisition = req.body.dateAcquisition ?? null

  if (!code || !designation) {
    return res.status(400).json({ error: 'code et designation requis.' })
  }

  return sendRun(
    `INSERT INTO logistique_equipements (code, designation, categorie, etat, localisation, dateAcquisition) VALUES (?,?,?,?,?,?)`,
    [code, designation, categorie, etat, localisation, dateAcquisition],
    res
  )
})

// Équipements: mise à jour (état/localisation/etc)
router.put('/equipements/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })

  const designation = req.body.designation ?? null
  const categorie = req.body.categorie ?? null
  const etat = req.body.etat ?? null
  const localisation = req.body.localisation ?? null
  const dateAcquisition = req.body.dateAcquisition ?? null

  return sendRun(
    `UPDATE logistique_equipements
     SET designation = COALESCE(?, designation),
         categorie = COALESCE(?, categorie),
         etat = COALESCE(?, etat),
         localisation = COALESCE(?, localisation),
         dateAcquisition = COALESCE(?, dateAcquisition)
     WHERE id = ?`,
    [designation, categorie, etat, localisation, dateAcquisition, id],
    res
  )
})

// Équipements: passer en maintenance (raccourci)
router.post('/equipements/:id/maintenance', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })
  return sendRun(`UPDATE logistique_equipements SET etat = 'En maintenance' WHERE id = ?`, [id], res)
})

// Véhicules: création
router.post('/vehicules', authenticateToken, (req, res) => {
  const immatriculation = requireNonEmptyString(req.body.immatriculation)
  const marque = req.body.marque ?? null
  const modele = req.body.modele ?? null
  const kilometrage = requireNumber(req.body.kilometrage) ?? 0
  const statut = req.body.statut ?? 'Disponible'
  const affectation = req.body.affectation ?? null

  if (!immatriculation) return res.status(400).json({ error: 'immatriculation requise.' })

  return sendRun(
    `INSERT INTO logistique_vehicules (immatriculation, marque, modele, kilometrage, statut, affectation) VALUES (?,?,?,?,?,?)`,
    [immatriculation, marque, modele, Math.trunc(kilometrage), statut, affectation],
    res
  )
})

// Véhicules: mise à jour
router.put('/vehicules/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })

  const marque = req.body.marque ?? null
  const modele = req.body.modele ?? null
  const kilometrage = req.body.kilometrage
  const statut = req.body.statut ?? null
  const affectation = req.body.affectation ?? null

  return sendRun(
    `UPDATE logistique_vehicules
     SET marque = COALESCE(?, marque),
         modele = COALESCE(?, modele),
         kilometrage = COALESCE(?, kilometrage),
         statut = COALESCE(?, statut),
         affectation = COALESCE(?, affectation)
     WHERE id = ?`,
    [
      marque,
      modele,
      kilometrage === undefined ? null : Math.trunc(requireNumber(kilometrage) ?? 0),
      statut,
      affectation,
      id
    ],
    res
  )
})

// Carburant: création
router.post('/carburant', authenticateToken, (req, res) => {
  const date = req.body.date ?? new Date().toISOString().slice(0, 10)
  const vehicule = requireNonEmptyString(req.body.vehicule)
  const typeCarburant = req.body.typeCarburant ?? 'Diesel'
  const typeOperation = req.body.typeOperation ?? 'Achat'
  const litres = requireNumber(req.body.litres) ?? 0
  const prixUnitaire = requireNumber(req.body.prixUnitaire) ?? 0
  const montantBody = req.body.montant
  const montant = montantBody === undefined || montantBody === null ? (Number(litres) * Number(prixUnitaire)) : (requireNumber(montantBody) ?? 0)
  const kilometrage = req.body.kilometrage
  const fournisseur = req.body.fournisseur ?? null
  const note = req.body.note ?? null

  if (!date) return res.status(400).json({ error: 'date requise.' })
  if (litres === null) return res.status(400).json({ error: 'litres requis (nombre).' })

  return sendRun(
    `INSERT INTO logistique_carburant (date, vehicule, typeCarburant, typeOperation, litres, prixUnitaire, montant, kilometrage, fournisseur, note)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      date,
      vehicule,
      typeCarburant,
      typeOperation,
      Number(litres),
      Number(prixUnitaire),
      Number(montant),
      kilometrage === undefined ? null : Math.trunc(requireNumber(kilometrage) ?? 0),
      fournisseur,
      note
    ],
    res
  )
})

// Carburant: mise à jour
router.put('/carburant/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })

  const date = req.body.date ?? null
  const vehicule = req.body.vehicule
  const typeCarburant = req.body.typeCarburant ?? null
  const typeOperation = req.body.typeOperation ?? null
  const litres = req.body.litres
  const prixUnitaire = req.body.prixUnitaire
  const montant = req.body.montant
  const kilometrage = req.body.kilometrage
  const fournisseur = req.body.fournisseur ?? null
  const note = req.body.note ?? null

  return sendRun(
    `UPDATE logistique_carburant
     SET date = COALESCE(?, date),
         vehicule = COALESCE(?, vehicule),
         typeCarburant = COALESCE(?, typeCarburant),
         typeOperation = COALESCE(?, typeOperation),
         litres = COALESCE(?, litres),
         prixUnitaire = COALESCE(?, prixUnitaire),
         montant = COALESCE(?, montant),
         kilometrage = COALESCE(?, kilometrage),
         fournisseur = COALESCE(?, fournisseur),
         note = COALESCE(?, note)
     WHERE id = ?`,
    [
      date,
      vehicule === undefined ? null : (requireNonEmptyString(vehicule) ?? null),
      typeCarburant,
      typeOperation,
      litres === undefined ? null : (requireNumber(litres) ?? 0),
      prixUnitaire === undefined ? null : (requireNumber(prixUnitaire) ?? 0),
      montant === undefined ? null : (requireNumber(montant) ?? 0),
      kilometrage === undefined ? null : Math.trunc(requireNumber(kilometrage) ?? 0),
      fournisseur,
      note,
      id
    ],
    res
  )
})

// IT assets: création
router.post('/informatique/actifs', authenticateToken, (req, res) => {
  const code = requireNonEmptyString(req.body.code)
  const type = requireNonEmptyString(req.body.type)
  const modele = req.body.modele ?? null
  const statut = req.body.statut ?? 'En service'
  const affectation = req.body.affectation ?? null
  const updatedAt = req.body.updatedAt ?? new Date().toISOString().slice(0, 10)

  if (!code || !type) return res.status(400).json({ error: 'code et type requis.' })

  return sendRun(
    `INSERT INTO logistique_it_assets (code, type, modele, statut, affectation, updatedAt) VALUES (?,?,?,?,?,?)`,
    [code, type, modele, statut, affectation, updatedAt],
    res
  )
})

// IT assets: mise à jour
router.put('/informatique/actifs/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })

  const type = req.body.type ?? null
  const modele = req.body.modele ?? null
  const statut = req.body.statut ?? null
  const affectation = req.body.affectation ?? null
  const updatedAt = req.body.updatedAt ?? new Date().toISOString().slice(0, 10)

  return sendRun(
    `UPDATE logistique_it_assets
     SET type = COALESCE(?, type),
         modele = COALESCE(?, modele),
         statut = COALESCE(?, statut),
         affectation = COALESCE(?, affectation),
         updatedAt = COALESCE(?, updatedAt)
     WHERE id = ?`,
    [type, modele, statut, affectation, updatedAt, id],
    res
  )
})

// Déploiements
router.post('/deploiements', authenticateToken, (req, res) => {
  const objet = requireNonEmptyString(req.body.objet)
  const statut = req.body.statut ?? 'Planifié'
  const echeance = req.body.echeance ?? null
  if (!objet) return res.status(400).json({ error: 'objet requis.' })
  return sendRun(
    `INSERT INTO logistique_deploiements (objet, statut, echeance) VALUES (?,?,?)`,
    [objet, statut, echeance],
    res
  )
})

router.put('/deploiements/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })
  const objet = req.body.objet ?? null
  const statut = req.body.statut ?? null
  const echeance = req.body.echeance ?? null
  return sendRun(
    `UPDATE logistique_deploiements
     SET objet = COALESCE(?, objet),
         statut = COALESCE(?, statut),
         echeance = COALESCE(?, echeance)
     WHERE id = ?`,
    [objet, statut, echeance, id],
    res
  )
})

// Dotations
router.post('/dotations', authenticateToken, (req, res) => {
  const beneficiaire = requireNonEmptyString(req.body.beneficiaire)
  const item = requireNonEmptyString(req.body.item)
  const quantite = requireNumber(req.body.quantite) ?? 0
  const statut = req.body.statut ?? 'En attente'
  const date = req.body.date ?? new Date().toISOString().slice(0, 10)
  const renouvellement = req.body.renouvellement ?? null
  if (!beneficiaire || !item) return res.status(400).json({ error: 'beneficiaire et item requis.' })
  return sendRun(
    `INSERT INTO logistique_dotations (beneficiaire, item, quantite, statut, date, renouvellement) VALUES (?,?,?,?,?,?)`,
    [beneficiaire, item, Math.trunc(quantite), statut, date, renouvellement],
    res
  )
})

router.put('/dotations/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })
  const beneficiaire = req.body.beneficiaire ?? null
  const item = req.body.item ?? null
  const quantite = req.body.quantite
  const statut = req.body.statut ?? null
  const date = req.body.date ?? null
  const renouvellement = req.body.renouvellement ?? null
  return sendRun(
    `UPDATE logistique_dotations
     SET beneficiaire = COALESCE(?, beneficiaire),
         item = COALESCE(?, item),
         quantite = COALESCE(?, quantite),
         statut = COALESCE(?, statut),
         date = COALESCE(?, date),
         renouvellement = COALESCE(?, renouvellement)
     WHERE id = ?`,
    [
      beneficiaire,
      item,
      quantite === undefined ? null : Math.trunc(requireNumber(quantite) ?? 0),
      statut,
      date,
      renouvellement,
      id
    ],
    res
  )
})

// Acquisitions
router.post('/acquisitions', authenticateToken, (req, res) => {
  const reference = requireNonEmptyString(req.body.reference)
  const objet = requireNonEmptyString(req.body.objet)
  const demandeur = req.body.demandeur ?? null
  const statut = req.body.statut ?? 'En attente'
  const date = req.body.date ?? new Date().toISOString().slice(0, 10)
  const echeance = req.body.echeance ?? null
  if (!reference || !objet) return res.status(400).json({ error: 'reference et objet requis.' })
  return sendRun(
    `INSERT INTO logistique_acquisitions (reference, objet, demandeur, statut, date, echeance) VALUES (?,?,?,?,?,?)`,
    [reference, objet, demandeur, statut, date, echeance],
    res
  )
})

router.put('/acquisitions/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })
  const objet = req.body.objet ?? null
  const demandeur = req.body.demandeur ?? null
  const statut = req.body.statut ?? null
  const date = req.body.date ?? null
  const echeance = req.body.echeance ?? null
  return sendRun(
    `UPDATE logistique_acquisitions
     SET objet = COALESCE(?, objet),
         demandeur = COALESCE(?, demandeur),
         statut = COALESCE(?, statut),
         date = COALESCE(?, date),
         echeance = COALESCE(?, echeance)
     WHERE id = ?`,
    [objet, demandeur, statut, date, echeance, id],
    res
  )
})

// Quittances
router.post('/quittances', authenticateToken, (req, res) => {
  const numero = requireNonEmptyString(req.body.numero)
  const objet = requireNonEmptyString(req.body.objet)
  const fournisseur = req.body.fournisseur ?? null
  const statut = req.body.statut ?? 'Non réglée'
  const montant = requireNumber(req.body.montant) ?? 0
  const echeance = req.body.echeance ?? null
  if (!numero || !objet) return res.status(400).json({ error: 'numero et objet requis.' })
  return sendRun(
    `INSERT INTO logistique_quittances (numero, objet, fournisseur, statut, montant, echeance) VALUES (?,?,?,?,?,?)`,
    [numero, objet, fournisseur, statut, montant, echeance],
    res
  )
})

router.put('/quittances/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })
  const objet = req.body.objet ?? null
  const fournisseur = req.body.fournisseur ?? null
  const statut = req.body.statut ?? null
  const montant = req.body.montant
  const echeance = req.body.echeance ?? null
  return sendRun(
    `UPDATE logistique_quittances
     SET objet = COALESCE(?, objet),
         fournisseur = COALESCE(?, fournisseur),
         statut = COALESCE(?, statut),
         montant = COALESCE(?, montant),
         echeance = COALESCE(?, echeance)
     WHERE id = ?`,
    [
      objet,
      fournisseur,
      statut,
      montant === undefined ? null : requireNumber(montant) ?? 0,
      echeance,
      id
    ],
    res
  )
})

// Assurances
router.post('/assurances', authenticateToken, (req, res) => {
  const police = requireNonEmptyString(req.body.police)
  const type = req.body.type ?? null
  const objet = req.body.objet ?? null
  const assureur = req.body.assureur ?? null
  const debut = req.body.debut ?? null
  const fin = req.body.fin ?? null
  if (!police) return res.status(400).json({ error: 'police requise.' })
  return sendRun(
    `INSERT INTO logistique_assurances (police, type, objet, assureur, debut, fin) VALUES (?,?,?,?,?,?)`,
    [police, type, objet, assureur, debut, fin],
    res
  )
})

router.put('/assurances/:id', authenticateToken, (req, res) => {
  const id = requireNumber(req.params.id)
  if (!id) return res.status(400).json({ error: 'id invalide.' })
  const type = req.body.type ?? null
  const objet = req.body.objet ?? null
  const assureur = req.body.assureur ?? null
  const debut = req.body.debut ?? null
  const fin = req.body.fin ?? null
  return sendRun(
    `UPDATE logistique_assurances
     SET type = COALESCE(?, type),
         objet = COALESCE(?, objet),
         assureur = COALESCE(?, assureur),
         debut = COALESCE(?, debut),
         fin = COALESCE(?, fin)
     WHERE id = ?`,
    [type, objet, assureur, debut, fin, id],
    res
  )
})

module.exports = (database) => {
  db = database;
  ensureSchema();
  return router;
}
