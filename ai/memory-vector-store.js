const { OpenAI } = require('openai')
const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./vector_memory.db')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Crée la table si elle n'existe pas
db.run(`
  CREATE TABLE IF NOT EXISTS memory_vectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    content TEXT,
    embedding TEXT
  )
`)

// Convertit un texte en vecteur
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  })
  return response.data[0].embedding
}

// Enregistre un vecteur dans la base
async function buildMemoryStore(source, content) {
  const embedding = await embedText(content)
  const embeddingStr = JSON.stringify(embedding)
  db.run(
    `INSERT INTO memory_vectors (source, content, embedding) VALUES (?, ?, ?)`,
    [source, content, embeddingStr]
  )
}

// Recherche les vecteurs les plus proches
async function queryMemoryStore(query, topK = 5) {
  const queryEmbedding = await embedText(query)
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM memory_vectors`, [], (err, rows) => {
      if (err) return reject(err)
      const scored = rows.map(row => {
        const vector = JSON.parse(row.embedding)
        const score = cosineSimilarity(queryEmbedding, vector)
        return { ...row, score }
      })
      const sorted = scored.sort((a, b) => b.score - a.score).slice(0, topK)
      resolve(sorted)
    })
  })
}

// Cosine similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dot / (normA * normB)
}

module.exports = { buildMemoryStore, queryMemoryStore }
