/**
 * Module de recherche sémantique avec embeddings OpenAI
 * Permet de rechercher des documents par similarité de sens
 */

const { OpenAI } = require('openai');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Modèle d'embeddings (petit et rapide)
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Génère un embedding pour un texte
 */
async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Texte vide');
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000) // Limite tokens
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Erreur génération embedding:', error.message);
    throw error;
  }
}

/**
 * Calcule similarité cosine entre deux vecteurs
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Construit le texte à indexer en ajoutant les métadonnées utiles (objet, expéditeur...)
 */
async function buildEmbeddingText(db, table, documentId, baseText = '') {
  const normalizedTable = table === 'courriers_sortants' ? 'courriers_sortants' : 'incoming_mails';

  const row = await new Promise((resolve, reject) => {
    let sql;
    if (normalizedTable === 'incoming_mails') {
      sql = `SELECT subject, sender, ref_code, statut_global, type_courrier, extracted_text FROM incoming_mails WHERE id = ?`;
    } else {
      sql = `SELECT objet, destinataire, reference_unique, statut, created_at, extracted_text FROM courriers_sortants WHERE id = ?`;
    }

    db.get(sql, [documentId], (err, result) => {
      if (err) reject(err);
      else resolve(result || {});
    });
  });

  const parts = [];

  if (normalizedTable === 'incoming_mails') {
    parts.push(row.subject, row.sender, row.ref_code, row.statut_global, row.type_courrier);
  } else {
    parts.push(row.objet, row.destinataire, row.reference_unique, row.statut);
  }

  parts.push(baseText || row.extracted_text);

  const combined = parts
    .map(part => (part || '').toString().trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!combined || combined.length < 10) {
    console.log(`Document ${documentId} (${normalizedTable}) trop court pour indexation`);
    return null;
  }

  return combined;
}

/**
 * Recherche sémantique dans les courriers
 * @param {string} query - Question en langage naturel
 * @param {Object} db - Instance SQLite
 * @param {Object} options - Options de recherche
 */
async function semanticSearch(query, db, options = {}) {
  const {
    limit = 10,
    threshold = 0.7, // Similarité minimale
    tables,
    status,
    type,
    startDate,
    endDate
  } = options;

  // Sélectionner les tables en fonction du type demandé
  let targetTables = ['incoming_mails', 'courriers_sortants'];
  if (type === 'entrant') {
    targetTables = ['incoming_mails'];
  } else if (type === 'sortant') {
    targetTables = ['courriers_sortants'];
  } else if (type === 'interne') {
    targetTables = ['incoming_mails'];
  }

  if (Array.isArray(tables) && tables.length > 0) {
    targetTables = tables;
  }

  try {
    // 1. Générer embedding de la requête
    console.log('🔍 Recherche sémantique:', query);
    const queryEmbedding = await generateEmbedding(query);

    // 2. Récupérer tous les documents avec embeddings
    const results = [];

    for (const table of targetTables) {
      // Adapter les colonnes selon la table
      let selectClause;
      let conditions = ['embedding IS NOT NULL'];
      const params = [];

      if (table === 'incoming_mails') {
        selectClause = `SELECT id, subject, sender, extracted_text, embedding, ref_code, statut_global as status, date_reception as date, type_courrier FROM ${table}`;

        if (status) {
          conditions.push('statut_global = ?');
          params.push(status);
        }
        if (type === 'interne') {
          conditions.push('type_courrier = ?');
          params.push('Interne');
        }
        if (startDate) {
          conditions.push('date(date_reception) >= date(?)');
          params.push(startDate);
        }
        if (endDate) {
          conditions.push('date(date_reception) <= date(?)');
          params.push(endDate);
        }
      } else if (table === 'courriers_sortants') {
        selectClause = `SELECT id, objet as subject, destinataire as sender, extracted_text, embedding, reference_unique, statut as status, created_at as date FROM ${table}`;

        if (status) {
          conditions.push('statut = ?');
          params.push(status);
        }
        if (startDate) {
          conditions.push('date(created_at) >= date(?)');
          params.push(startDate);
        }
        if (endDate) {
          conditions.push('date(created_at) <= date(?)');
          params.push(endDate);
        }
      } else {
        continue; // Table non supportée
      }

      const rows = await new Promise((resolve, reject) => {
        db.all(
          `${selectClause} WHERE ${conditions.join(' AND ')}`,
          params,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // 3. Calculer similarité pour chaque document
      for (const row of rows) {
        try {
          const docEmbedding = JSON.parse(row.embedding);
          const similarity = cosineSimilarity(queryEmbedding, docEmbedding);

          if (similarity >= threshold) {
            results.push({
              id: row.id,
              reference: row.reference_unique || row.ref_code,
              subject: row.subject,
              sender: row.sender,
              excerpt: (row.extracted_text || '').substring(0, 200),
              similarity: similarity,
              source: table,
              type: table === 'incoming_mails' ? (row.type_courrier === 'Interne' ? 'interne' : 'entrant') : 'sortant',
              status: row.status,
              date: row.date
            });
          }
        } catch (parseErr) {
          // Embedding invalide, ignorer
          continue;
        }
      }
    }

    // 4. Trier par similarité décroissante
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);

  } catch (error) {
    console.error('Erreur recherche sémantique:', error.message);
    throw error;
  }
}

/**
 * Indexe un document (génère et stocke son embedding)
 */
async function indexDocument(db, table, documentId, text) {

  const combinedText = await buildEmbeddingText(db, table, documentId, text);
  if (!combinedText) return null;

  try {
    const embedding = await generateEmbedding(combinedText);
    const embeddingJson = JSON.stringify(embedding);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE ${table} SET embedding = ? WHERE id = ?`,
        [embeddingJson, documentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`✅ Document ${documentId} (${table}) indexé`);
    return embedding;

  } catch (error) {
    console.error(`Erreur indexation document ${documentId}:`, error.message);
    return null;
  }
}

/**
 * Réindexe tous les documents sans embedding
 */
async function reindexAllDocuments(db) {
  const tables = [
    { name: 'incoming_mails', textField: 'extracted_text' },
    { name: 'courriers_sortants', textField: 'extracted_text' }
  ];

  let totalIndexed = 0;

  for (const { name, textField } of tables) {
    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, ${textField} FROM ${name} WHERE embedding IS NULL`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`📚 ${name}: ${rows.length} documents à indexer`);

    for (const row of rows) {
      const embedding = await indexDocument(db, name, row.id, row[textField]);
      if (embedding) {
        totalIndexed++;
      }
      
      // Pause pour éviter rate limits
      if (totalIndexed % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.log(`✅ Indexation terminée: ${totalIndexed} documents`);
  return totalIndexed;
}

/**
 * Trouve documents similaires à un document donné
 */
async function findSimilarDocuments(db, table, documentId, limit = 5) {
  try {
    // Récupérer l'embedding du document source (adapter selon la table)
    let sourceColumn = table === 'incoming_mails' ? 'subject' : 'objet';
    const sourceDoc = await new Promise((resolve, reject) => {
      db.get(
        `SELECT embedding, ${sourceColumn} as subject FROM ${table} WHERE id = ?`,
        [documentId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!sourceDoc || !sourceDoc.embedding) {
      return [];
    }

    const sourceEmbedding = JSON.parse(sourceDoc.embedding);

    // Chercher documents similaires dans toutes les tables
    const tables = ['incoming_mails', 'courriers_sortants'];
    const results = [];

    for (const tbl of tables) {
      // Adapter les colonnes selon la table
      let selectClause;
      if (tbl === 'incoming_mails') {
        selectClause = `SELECT id, subject, sender, reference_unique, embedding FROM ${tbl}`;
      } else if (tbl === 'courriers_sortants') {
        selectClause = `SELECT id, objet as subject, destinataire as sender, reference_unique, embedding FROM ${tbl}`;
      } else {
        continue;
      }
      
      const rows = await new Promise((resolve, reject) => {
        db.all(
          `${selectClause}
           WHERE embedding IS NOT NULL AND NOT (id = ? AND '${tbl}' = '${table}')`,
          [documentId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      for (const row of rows) {
        try {
          const docEmbedding = JSON.parse(row.embedding);
          const similarity = cosineSimilarity(sourceEmbedding, docEmbedding);

          if (similarity > 0.6) { // Seuil plus bas pour similarité
            results.push({
              id: row.id,
              reference: row.reference_unique,
              subject: row.subject,
              sender: row.sender,
              similarity: similarity,
              source: tbl
            });
          }
        } catch (e) {
          continue;
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);

  } catch (error) {
    console.error('Erreur recherche documents similaires:', error.message);
    return [];
  }
}

module.exports = {
  generateEmbedding,
  semanticSearch,
  indexDocument,
  reindexAllDocuments,
  findSimilarDocuments,
  cosineSimilarity
};
