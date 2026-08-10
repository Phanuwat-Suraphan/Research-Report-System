const crypto = require('node:crypto');
const db = require('../db');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return { token, expiresAt };
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getUserByToken(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
}

const ROLE_LABELS = {
  teacher: 'ครูผู้จัดทำ',
  head: 'หัวหน้ากลุ่มสาระ',
  academic: 'ฝ่ายวิชาการ',
  director: 'ผู้อำนวยการ',
  admin: 'ผู้ดูแลระบบ',
};

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getUserByToken,
  ROLE_LABELS,
};
