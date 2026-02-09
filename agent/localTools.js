const fs = require('fs');
const path = require('path');

function normalizeLineEndings(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}

function safeToNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getRepoRoot() {
  // backend/agent/localTools.js -> backend/ -> repo root
  return path.resolve(__dirname, '..', '..');
}

function getAllowedRoots() {
  const root = getRepoRoot();
  return {
    repoRoot: root,
    backendRoot: path.join(root, 'backend'),
    frontendRoot: path.join(root, 'frontend', 'src'),
  };
}

function isPathInside(childPath, parentPath) {
  const rel = path.relative(parentPath, childPath);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolveSafeWorkspacePath(relativeFilePath) {
  const { repoRoot, backendRoot, frontendRoot } = getAllowedRoots();
  const rel = String(relativeFilePath || '').replace(/\\/g, '/').replace(/^\//, '');

  const abs = path.resolve(repoRoot, rel);

  const ok =
    abs === backendRoot ||
    abs === frontendRoot ||
    isPathInside(abs, backendRoot) ||
    isPathInside(abs, frontendRoot);

  if (!ok) {
    throw new Error('Accès refusé: chemin hors des dossiers autorisés (backend/, frontend/src/).');
  }

  return { absPath: abs, relPath: rel };
}

function walkFiles(rootDir, options) {
  const {
    maxFiles = 4000,
    maxFileSizeBytes = 5 * 1024 * 1024,
    includeExtensions = ['.js', '.mjs', '.cjs', '.ts', '.vue', '.json', '.md', '.sql'],
  } = options || {};

  const results = [];
  const stack = [rootDir];

  while (stack.length && results.length < maxFiles) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const name = ent.name;
        if (
          name === 'node_modules' ||
          name === '.git' ||
          name === '.venv' ||
          name === 'dist' ||
          name === 'build' ||
          name === '.unused'
        ) {
          continue;
        }
        stack.push(full);
        continue;
      }

      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!includeExtensions.includes(ext)) continue;

      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (!stat || stat.size > maxFileSizeBytes) continue;

      results.push(full);
      if (results.length >= maxFiles) break;
    }
  }

  return results;
}

function searchCode(query, options) {
  const q = String(query || '').trim();
  if (!q) return [];

  const { scope = 'both', limit = 20 } = options || {};
  const maxResults = Math.max(1, Math.min(100, safeToNumber(limit, 20)));

  const { backendRoot, frontendRoot, repoRoot } = getAllowedRoots();
  const roots =
    scope === 'backend'
      ? [backendRoot]
      : scope === 'frontend'
        ? [frontendRoot]
        : [backendRoot, frontendRoot];

  const needle = q.toLowerCase();
  const matches = [];

  for (const root of roots) {
    const files = walkFiles(root);
    for (const file of files) {
      if (matches.length >= maxResults) break;

      let content;
      try {
        content = normalizeLineEndings(fs.readFileSync(file, 'utf8'));
      } catch {
        continue;
      }

      if (!content.toLowerCase().includes(needle)) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxResults) break;
        const line = lines[i];
        if (!line.toLowerCase().includes(needle)) continue;

        const relPath = path.relative(repoRoot, file).replace(/\\/g, '/');
        matches.push({
          path: relPath,
          line: i + 1,
          text: line.slice(0, 240),
        });
      }
    }
  }

  return matches;
}

function readCodeFileSnippet(relativeFilePath, options) {
  const { absPath, relPath } = resolveSafeWorkspacePath(relativeFilePath);

  const maxChars = Math.max(200, Math.min(20000, safeToNumber(options?.max_chars, 6000)));
  const startLine = safeToNumber(options?.start_line, 1);
  const endLine = safeToNumber(options?.end_line, 0);

  let content = normalizeLineEndings(fs.readFileSync(absPath, 'utf8'));
  const lines = content.split('\n');

  let slice;
  if (endLine && endLine >= startLine) {
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.min(lines.length, endLine);
    slice = lines.slice(startIdx, endIdx).join('\n');
  } else {
    slice = content;
  }

  if (slice.length > maxChars) {
    slice = slice.slice(0, maxChars) + '\n…(troncature)…';
  }

  return { path: relPath.replace(/\\/g, '/'), content: slice };
}

function ensureMemoryTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS agent_memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          session_id TEXT,
          content TEXT NOT NULL,
          tags TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  });
}

async function saveMemory(db, { user_id, session_id, content, tags }) {
  await ensureMemoryTables(db);
  const safeContent = String(content || '').trim();
  if (!safeContent) return 'Mémoire vide: rien à enregistrer.';

  const safeTags = tags == null ? null : String(tags);
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO agent_memories (user_id, session_id, content, tags) VALUES (?, ?, ?, ?)',
      [user_id ?? null, session_id ?? null, safeContent, safeTags],
      (err) => (err ? reject(err) : resolve('Mémoire enregistrée.'))
    );
  });
}

async function searchMemories(db, { user_id, query, limit }) {
  await ensureMemoryTables(db);
  const q = String(query || '').trim();
  if (!q) return [];

  const max = Math.max(1, Math.min(10, safeToNumber(limit, 5)));

  const sql = `
    SELECT id, content, tags, created_at
    FROM agent_memories
    WHERE (user_id IS NULL OR user_id = ?)
      AND content LIKE ?
    ORDER BY datetime(created_at) DESC
    LIMIT ${max}
  `;

  return new Promise((resolve, reject) => {
    db.all(sql, [user_id ?? null, `%${q}%`], (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function getDbSchema(db, { table } = {}) {
  const t = typeof table === 'string' && table.trim() ? table.trim() : null;
  if (!t) {
    const sql = `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name`;
    return new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
  }

  const sql = `PRAGMA table_info(${t.replace(/[^a-zA-Z0-9_]/g, '')})`;
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function isSafeSelect(sql) {
  const s = String(sql || '').trim();
  if (!s) return false;
  const lowered = s.toLowerCase();
  if (!lowered.startsWith('select')) return false;
  if (lowered.includes(';')) return false;
  if (/(insert|update|delete|drop|alter|create|pragma|attach|detach|vacuum|reindex)/i.test(lowered)) return false;
  return true;
}

async function dbSelect(db, { sql, max_rows }) {
  if (!isSafeSelect(sql)) {
    throw new Error('Requête refusée: uniquement SELECT simple, sans point-virgule et sans commandes dangereuses.');
  }

  const max = Math.max(1, Math.min(50, safeToNumber(max_rows, 20)));
  const limitedSql = `${String(sql).trim()} LIMIT ${max}`;

  const rows = await new Promise((resolve, reject) => {
    db.all(limitedSql, [], (err, r) => (err ? reject(err) : resolve(r || [])));
  });

  // Masquage basique des champs sensibles
  const sanitized = rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const out = { ...row };
    for (const k of Object.keys(out)) {
      if (String(k).toLowerCase().includes('password')) out[k] = '***';
      if (String(k).toLowerCase().includes('token')) out[k] = '***';
    }
    return out;
  });

  return sanitized;
}

module.exports = {
  searchCode,
  readCodeFileSnippet,
  saveMemory,
  searchMemories,
  getDbSchema,
  dbSelect,
};
