async function listMessagesBySession({ dbAll, sessionId }) {
  return dbAll(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId],
  );
}

async function listConversations({ dbAll, requestedUserId }) {
  return dbAll(
    `SELECT DISTINCT session_id, MAX(timestamp) as last FROM messages WHERE user_id = ? GROUP BY session_id ORDER BY last DESC`,
    [requestedUserId],
  );
}

async function createMessage({ dbRun, sessionId, userId, role, content }) {
  const result = await dbRun(
    `INSERT INTO messages (session_id, user_id, role, content) VALUES (?, ?, ?, ?)`
    ,
    [sessionId, userId, role, content],
  );
  return { id: result.lastID };
}

module.exports = {
  listMessagesBySession,
  listConversations,
  createMessage,
};
