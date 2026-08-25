const db = require('../db');

// "ข้อมูลห้ามหายถาวร" — nothing a teacher submits may be lost for good.
//
// The site is guarded by a single shared passcode, so any holder of it can
// edit or delete any entry. That makes an undo path essential rather than
// nice to have: every edit, delete, restore and certification snapshots the
// complete previous state of the work (its fields AND its links) as JSON
// first. Deleting only archives the row, and a snapshot can be restored from
// the manage page, so a mistake is always recoverable.

const ACTION_LABELS = {
  create: 'สร้างผลงาน',
  update: 'แก้ไขข้อมูล',
  archive: 'ย้ายไปถังขยะ',
  restore: 'กู้คืนจากถังขยะ',
  certify: 'ผู้อำนวยการรับรอง',
  uncertify: 'ยกเลิกการรับรอง',
  rollback: 'ย้อนคืนเวอร์ชันก่อนหน้า',
};

function snapshotOf(workId) {
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
  if (!work) return null;
  const links = db.prepare('SELECT * FROM work_links WHERE work_id = ? ORDER BY category, position, id').all(workId);
  return { work, links };
}

// Records the state a work is in *right now*, before the caller changes it.
function record(workId, action, ip = null) {
  const snapshot = snapshotOf(workId);
  if (!snapshot) return;
  db.prepare('INSERT INTO work_revisions (work_id, action, snapshot, ip_address) VALUES (?, ?, ?, ?)').run(
    workId,
    action,
    JSON.stringify(snapshot),
    ip
  );
}

function listFor(workId) {
  return db
    .prepare('SELECT id, action, ip_address, saved_at FROM work_revisions WHERE work_id = ? ORDER BY saved_at DESC, id DESC')
    .all(workId);
}

function get(revisionId) {
  const row = db.prepare('SELECT * FROM work_revisions WHERE id = ?').get(revisionId);
  if (!row) return null;
  try {
    return { ...row, data: JSON.parse(row.snapshot) };
  } catch {
    return null;
  }
}

// Writes a stored snapshot back over the current row, after first snapshotting
// what is there now — so a rollback is itself undoable.
function restore(revisionId, ip = null) {
  const revision = get(revisionId);
  if (!revision || !revision.data || !revision.data.work) return false;
  const { work, links } = revision.data;

  record(work.id, 'rollback', ip);

  const columns = Object.keys(work).filter((k) => k !== 'id');
  db.prepare(`UPDATE works SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(
    ...columns.map((c) => work[c]),
    work.id
  );

  db.prepare('DELETE FROM work_links WHERE work_id = ?').run(work.id);
  const insert = db.prepare(
    `INSERT INTO work_links (work_id, category, media_type, label, url, provider, file_id, embed_url, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const link of links || []) {
    insert.run(
      work.id,
      link.category,
      link.media_type,
      link.label,
      link.url,
      link.provider,
      link.file_id,
      link.embed_url,
      link.position
    );
  }
  return true;
}

module.exports = { record, listFor, get, restore, ACTION_LABELS };
