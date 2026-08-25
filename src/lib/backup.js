const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const { DATA_DIR, DB_PATH } = require('./paths');

// Automatic local snapshots of the database.
//
// This is the second half of "ข้อมูลห้ามหายถาวร": revision history protects
// against a person deleting the wrong thing, snapshots protect against the
// file itself going bad. VACUUM INTO writes a consistent copy while the
// server keeps running, so a snapshot is always a openable database rather
// than a half-written file.
//
// Snapshots live on the same disk, so they do NOT protect against the disk
// being wiped — that is what the persistent disk in render.yaml and the
// "ดาวน์โหลดไฟล์สำรอง" button on the manage page are for. Keep an off-site
// copy of the downloaded file.

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 14);
const INTERVAL_MS = 24 * 60 * 60 * 1000;

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function createSnapshot(targetPath) {
  const destination = targetPath || path.join(BACKUP_DIR, `app-${stamp()}.db`);
  fs.rmSync(destination, { force: true });
  // Path is server-generated, but the quote-doubling keeps the SQL literal
  // well-formed whatever DATA_DIR is set to.
  db.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
  return destination;
}

function listSnapshots() {
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: stat.size, modified: stat.mtime };
    })
    .sort((a, b) => b.modified - a.modified);
}

function prune() {
  const extra = listSnapshots().slice(KEEP);
  for (const file of extra) fs.rmSync(path.join(BACKUP_DIR, file.name), { force: true });
  return extra.length;
}

function runDaily() {
  try {
    const file = createSnapshot();
    const removed = prune();
    console.log(`[backup] snapshot ${path.basename(file)} (pruned ${removed})`);
  } catch (err) {
    console.error('[backup] snapshot failed:', err.message);
  }
}

// Snapshots on boot when the newest one is over 20 hours old, then daily.
// Booting is the one moment we know the process is alive, which matters on
// hosts that idle the server out between visits.
function scheduleDaily() {
  const newest = listSnapshots()[0];
  const age = newest ? Date.now() - newest.modified.getTime() : Infinity;
  if (age > 20 * 60 * 60 * 1000) runDaily();
  const timer = setInterval(runDaily, INTERVAL_MS);
  if (timer.unref) timer.unref();
}

// Loud warning when the database is sitting somewhere a PaaS will wipe.
function warnIfEphemeral() {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.DATA_DIR) return;
  console.warn(
    [
      '',
      '  ============================================================',
      '  คำเตือน: ไม่ได้ตั้งค่า DATA_DIR',
      '  ฐานข้อมูลถูกเก็บไว้ในโฟลเดอร์ของแอป ซึ่งบนโฮสต์ส่วนใหญ่จะถูกล้างทุกครั้งที่ deploy ใหม่',
      '  ผลงานที่ครูส่งเข้ามาทั้งหมดจะหาย',
      '  วิธีแก้: ตั้ง DATA_DIR ให้ชี้ไปยัง persistent disk (ดู render.yaml และ README)',
      '  ============================================================',
      '',
    ].join('\n')
  );
}

module.exports = { createSnapshot, listSnapshots, prune, scheduleDaily, warnIfEphemeral, BACKUP_DIR, DB_PATH };
