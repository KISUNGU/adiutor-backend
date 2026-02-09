function normalizeEmail(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}

function normalizeUsername(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

module.exports = {
  normalizeEmail,
  normalizeUsername,
};
