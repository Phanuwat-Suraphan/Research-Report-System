const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'app.db');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('teacher','head','academic','director','admin')),
  subject_group TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_number TEXT,
  title TEXT NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  subject_area TEXT NOT NULL,
  grade_level TEXT,
  term TEXT,
  academic_year TEXT,
  problem TEXT,
  objectives TEXT,
  hypothesis TEXT,
  target_group TEXT,
  tools TEXT,
  methodology TEXT,
  results TEXT,
  summary TEXT,
  discussion TEXT,
  recommendation TEXT,
  reference_list TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','submitted','head_approved','academic_approved','approved','returned')),
  return_stage TEXT,
  return_comment TEXT,
  locked_html_path TEXT,
  locked_hash TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('approve','reject')),
  signature_data TEXT,
  comment TEXT,
  ip_address TEXT,
  signed_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
`);

module.exports = db;
