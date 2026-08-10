const fs = require('node:fs');
const path = require('node:path');

// All persistent state (SQLite DB, uploaded files, locked documents) lives
// under one root so a single mounted volume (e.g. a Render persistent disk)
// covers everything. Defaults to ./data for local development.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const LOCKED_DIR = path.join(DATA_DIR, 'locked');

for (const dir of [DATA_DIR, UPLOAD_DIR, LOCKED_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = { DATA_DIR, DB_PATH, UPLOAD_DIR, LOCKED_DIR };
