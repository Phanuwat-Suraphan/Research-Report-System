const crypto = require('node:crypto');
const db = require('../db');
const { DEFAULT_PASSCODE, UNLOCK_HOURS } = require('./config');

// The site is public to read. Adding, editing, deleting and certifying are
// behind one shared passcode. Unlocking mints a signed, expiring cookie —
// there are no user accounts and nothing about the visitor is stored.
//
// The signing secret lives in the database rather than in memory so that a
// redeploy or restart does not sign everyone out mid-edit.
function secret() {
  let value = db.getSetting('gate_secret');
  if (!value) {
    value = crypto.randomBytes(32).toString('hex');
    db.setSetting('gate_secret', value);
  }
  return value;
}

function currentPasscode() {
  return db.getSetting('edit_passcode') || DEFAULT_PASSCODE;
}

function setPasscode(value) {
  db.setSetting('edit_passcode', value);
}

function sign(payload) {
  // The current passcode is part of the signing input, so changing the
  // passcode immediately invalidates every cookie handed out under the old
  // one — which is the whole point of changing it.
  return crypto
    .createHmac('sha256', `${secret()}:${currentPasscode()}`)
    .update(payload)
    .digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkPasscode(input) {
  return safeEqual(String(input || ''), currentPasscode());
}

function mintToken() {
  const expiresAt = Date.now() + UNLOCK_HOURS * 60 * 60 * 1000;
  return { token: `${expiresAt}.${sign(String(expiresAt))}`, expiresAt: new Date(expiresAt) };
}

function verifyToken(token) {
  if (!token) return false;
  const idx = String(token).indexOf('.');
  if (idx === -1) return false;
  const expiresAt = String(token).slice(0, idx);
  const signature = String(token).slice(idx + 1);
  if (!/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) < Date.now()) return false;
  return safeEqual(signature, sign(expiresAt));
}

// CSRF token derived from the unlock cookie, so no server-side session store
// is needed: only a page served to this visitor can carry a matching value.
function csrfFor(token) {
  if (!token) return '';
  return crypto.createHmac('sha256', `${secret()}:csrf`).update(String(token)).digest('hex');
}

function verifyCsrf(token, submitted) {
  if (!token || !submitted) return false;
  return safeEqual(csrfFor(token), submitted);
}

module.exports = {
  currentPasscode,
  setPasscode,
  checkPasscode,
  mintToken,
  verifyToken,
  csrfFor,
  verifyCsrf,
};
