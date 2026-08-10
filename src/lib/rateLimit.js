// In-memory login throttle. State resets on process restart, which is an
// accepted trade-off for a single-instance MVP deployment — good enough to
// blunt casual password guessing without needing an external store.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map();

function keyFor(email, ip) {
  return `${email.toLowerCase()}|${ip}`;
}

function isLocked(email, ip) {
  const entry = attempts.get(keyFor(email, ip));
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(keyFor(email, ip));
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(email, ip) {
  const key = keyFor(email, ip);
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function resetAttempts(email, ip) {
  attempts.delete(keyFor(email, ip));
}

module.exports = { isLocked, recordFailure, resetAttempts, MAX_ATTEMPTS };
