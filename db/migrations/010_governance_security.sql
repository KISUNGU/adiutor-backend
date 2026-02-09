-- =========================
-- AUDIT LOGS
-- =========================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  user_id INTEGER,
  user_email TEXT,
  action TEXT NOT NULL,
  module TEXT,
  entity_type TEXT,
  entity_id TEXT,

  severity TEXT CHECK(severity IN ('info','low','medium','high','critical')) DEFAULT 'info',
  success INTEGER DEFAULT 1,

  ip TEXT,
  user_agent TEXT,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);

-- =========================
-- SECURITY ALERTS
-- =========================
CREATE TABLE IF NOT EXISTS security_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,

  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  severity TEXT CHECK(severity IN ('low','medium','high','critical')) DEFAULT 'medium',
  status TEXT CHECK(status IN ('new','seen','resolved')) DEFAULT 'new',

  source TEXT,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON security_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON security_alerts(status);

-- =========================
-- RBAC
-- =========================
CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  PRIMARY KEY (role, permission_code)
);
