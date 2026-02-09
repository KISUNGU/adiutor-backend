/* eslint-disable no-console */

const axios = require('axios')
const path = require('path')
const { spawn } = require('child_process')

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000'
const EMAIL = process.env.API_EMAIL || 'admin@mail.com'
const PASSWORD = process.env.API_PASSWORD || 'adminpassword'

async function login() {
  const res = await axios.post(
    `${BASE_URL}/api/login`,
    { email: EMAIL, password: PASSWORD },
    { headers: { 'Content-Type': 'application/json' } },
  )

  const token = res.data?.token || res.data?.accessToken || res.data?.data?.token
  if (!token) {
    throw new Error(`Token not found in login response: ${JSON.stringify(res.data)}`)
  }

  return token
}

async function waitForServer({ timeoutMs = 20000 } = {}) {
  const startedAt = Date.now()
  // /health exists in this backend; use it as readiness probe.
  // If it doesn't exist for some reason, any non-network error will break.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await axios.get(`${BASE_URL}/health`, { timeout: 2000 })
      if (res.status >= 200 && res.status < 500) return
    } catch (err) {
      const isNetwork = !err?.response
      if (!isNetwork) return
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Backend not reachable at ${BASE_URL} after ${timeoutMs}ms`)
      }
      await new Promise((r) => setTimeout(r, 750))
    }
  }
}

async function maybeSpawnServer() {
  const shouldSpawn = process.env.SPAWN_SERVER === '1'
  if (!shouldSpawn) return null

  const backendDir = path.resolve(__dirname, '..')
  console.log('SPAWN_SERVER=1 → starting backend via node server.js')

  const child = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env: process.env,
    stdio: 'inherit',
  })

  // Wait until server is reachable before continuing.
  await waitForServer({ timeoutMs: 30000 })

  return async () => {
    if (!child.pid) return
    console.log('Stopping spawned backend (pid)', child.pid)
    try {
      child.kill('SIGTERM')
    } catch {
      // ignore
    }

    // On Windows, SIGTERM is not always sufficient.
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
        killer.on('close', () => resolve())
        killer.on('error', () => resolve())
      })
    }
  }
}

async function main() {
  console.log('BASE_URL', BASE_URL)

  const stopServer = await maybeSpawnServer()
  try {
    await waitForServer({ timeoutMs: 30000 })

    const token = await login()
    const client = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${token}` },
    })

  const stocksRes = await client.get('/api/logistique/stocks')
  console.log('GET /api/logistique/stocks', stocksRes.status, Array.isArray(stocksRes.data) ? stocksRes.data.length : null)

  const firstStock = Array.isArray(stocksRes.data) ? stocksRes.data[0] : null
  if (!firstStock?.id) {
    throw new Error('No stock item returned; cannot test move endpoint')
  }

  const moveRes = await client.post(`/api/logistique/stocks/${firstStock.id}/move`, { delta: 1 })
  console.log('POST /api/logistique/stocks/:id/move', moveRes.status, moveRes.data)

  const eqRes = await client.get('/api/logistique/equipements')
  console.log('GET /api/logistique/equipements', eqRes.status, Array.isArray(eqRes.data) ? eqRes.data.length : null)

  const firstEq = Array.isArray(eqRes.data) ? eqRes.data[0] : null
  if (!firstEq?.id) {
    throw new Error('No equipment returned; cannot test maintenance endpoint')
  }

  const maintRes = await client.post(`/api/logistique/equipements/${firstEq.id}/maintenance`, { note: 'Test maintenance via script' })
  console.log('POST /api/logistique/equipements/:id/maintenance', maintRes.status, maintRes.data)

  const vehRes = await client.get('/api/logistique/vehicules')
  console.log('GET /api/logistique/vehicules', vehRes.status, Array.isArray(vehRes.data) ? vehRes.data.length : null)

  const firstVeh = Array.isArray(vehRes.data) ? vehRes.data[0] : null
  if (!firstVeh?.id) {
    throw new Error('No vehicle returned; cannot test PUT endpoint')
  }

  const nextStatut = firstVeh.statut === 'Disponible' ? 'En maintenance' : 'Disponible'
  const putRes = await client.put(`/api/logistique/vehicules/${firstVeh.id}`, {
    statut: nextStatut,
    kilometrage: (Number(firstVeh.kilometrage) || 0) + 1,
  })
  console.log('PUT /api/logistique/vehicules/:id', putRes.status, putRes.data)

  const quitRes = await client.get('/api/logistique/quittances')
  console.log('GET /api/logistique/quittances', quitRes.status, Array.isArray(quitRes.data) ? quitRes.data.length : null)

  const firstQuit = Array.isArray(quitRes.data) ? quitRes.data[0] : null
  if (!firstQuit?.id) {
    throw new Error('No quittance returned; cannot test PUT endpoint')
  }

  const nextQuitStatut = firstQuit.statut === 'Réglée' ? 'Non réglée' : 'Réglée'
  const putQuitRes = await client.put(`/api/logistique/quittances/${firstQuit.id}`, {
    statut: nextQuitStatut,
    montant: (Number(firstQuit.montant) || 0) + 5,
  })
  console.log('PUT /api/logistique/quittances/:id', putQuitRes.status, putQuitRes.data)

  const assRes = await client.get('/api/logistique/assurances')
  console.log('GET /api/logistique/assurances', assRes.status, Array.isArray(assRes.data) ? assRes.data.length : null)

  const firstAss = Array.isArray(assRes.data) ? assRes.data[0] : null
  if (!firstAss?.id) {
    throw new Error('No assurance returned; cannot test PUT endpoint')
  }

  const putAssRes = await client.put(`/api/logistique/assurances/${firstAss.id}`, {
    assureur: `${firstAss.assureur || 'Assureur'} (MAJ)`,
  })
  console.log('PUT /api/logistique/assurances/:id', putAssRes.status, putAssRes.data)

  const carbRes = await client.get('/api/logistique/carburant')
  console.log('GET /api/logistique/carburant', carbRes.status, Array.isArray(carbRes.data) ? carbRes.data.length : null)

  const today = new Date().toISOString().slice(0, 10)
  const createCarbRes = await client.post('/api/logistique/carburant', {
    date: today,
    vehicule: 'LT-123-AB',
    typeCarburant: 'Diesel',
    typeOperation: 'Achat',
    litres: 10,
    prixUnitaire: 1.75,
    kilometrage: 90000,
    fournisseur: 'Station Test',
    note: 'Test carburant via script',
  })
  console.log('POST /api/logistique/carburant', createCarbRes.status, createCarbRes.data)

  const createdCarbId = createCarbRes.data?.id || createCarbRes.data?.lastID
  if (!createdCarbId) {
    throw new Error('No carburant id returned; cannot test PUT endpoint')
  }

  const putCarbRes = await client.put(`/api/logistique/carburant/${createdCarbId}`, {
    note: 'Test carburant via script (MAJ)',
    litres: 12,
    prixUnitaire: 1.8,
  })
  console.log('PUT /api/logistique/carburant/:id', putCarbRes.status, putCarbRes.data)

    console.log('OK')
  } finally {
    if (stopServer) await stopServer()
  }
}

main().catch((err) => {
  const status = err?.response?.status
  const data = err?.response?.data
  console.error('FAILED', status || '', data || err.message)
  process.exit(1)
})
