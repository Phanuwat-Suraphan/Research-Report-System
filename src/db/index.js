const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('../lib/paths');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
// WAL survives an unclean shutdown far better than the default rollback
// journal, which matters because this database is the *only* copy of the
// school's submissions (see src/lib/backup.js for the snapshot schedule).
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = FULL;');

db.exec(`
-- Small key/value store: the director's signature image, the display name
-- printed under it, and the edit passcode when the school changes it from
-- the default. Kept in the database so it survives a restart along with
-- everything else.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0
);

-- One submitted piece of work: classroom research or a teaching innovation.
-- The work itself lives in Google Drive; this row holds the catalogue entry
-- plus the director's certification once it is granted.
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_type TEXT NOT NULL DEFAULT 'research' CHECK(work_type IN ('research','innovation')),
  title TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_position TEXT,
  subject_area TEXT,
  grade_level TEXT,
  term TEXT,
  academic_year TEXT,
  abstract TEXT,
  objectives TEXT,
  methodology TEXT,
  results TEXT,
  benefits TEXT,
  -- 'published' is visible to everyone; 'archived' is the recoverable
  -- trash that a delete puts a work into. Rows are never removed.
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','archived')),
  archived_at TEXT,
  -- Director's certification. The signature image and the names are
  -- snapshotted onto the row at the moment of signing so that changing the
  -- stored signature later never rewrites an already-issued certificate.
  doc_number TEXT,
  certified_at TEXT,
  certifier_name TEXT,
  certifier_position TEXT,
  certify_note TEXT,
  certify_signature TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every link attached to a work.
--   drive       — the work itself on Google Drive (at least one required)
--   infographic — an image in Drive, shown inline on the page (optional)
--   media       — YouTube / game / website / online document, embedded so a
--                 visitor can watch or play it without leaving the page
CREATE TABLE IF NOT EXISTS work_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('drive','infographic','media')),
  media_type TEXT,
  label TEXT,
  url TEXT NOT NULL,
  provider TEXT,
  file_id TEXT,
  embed_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A full JSON snapshot of a work (and its links) taken before every edit,
-- delete or certification. Nothing a teacher types is ever overwritten
-- without the previous version being recoverable from here.
CREATE TABLE IF NOT EXISTS work_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  ip_address TEXT,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Who changed what, from which address. The site is protected by one shared
-- passcode, so this log is what makes changes traceable afterwards.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  work_id INTEGER,
  detail TEXT,
  ip_address TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_works_status ON works(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_links_work ON work_links(work_id, category, position);
CREATE INDEX IF NOT EXISTS idx_revisions_work ON work_revisions(work_id, saved_at);
`);

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}

function logAudit(action, { workId = null, detail = null, ip = null } = {}) {
  db.prepare('INSERT INTO audit_log (action, work_id, detail, ip_address) VALUES (?, ?, ?, ?)').run(
    action,
    workId,
    detail,
    ip
  );
}

module.exports = db;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
module.exports.logAudit = logAudit;
