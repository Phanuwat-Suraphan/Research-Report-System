// In-memory throttle for passcode attempts, keyed by client IP.
//
// The whole site is guarded by one short shared code, so slowing down guessing
// matters. State resets when the process restarts, which is an accepted
// trade-off for a single-instance deployment: it blunts casual guessing
// without needing an external store.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map();

function isLocked(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const entry = attempts.get(ip);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function resetAttempts(ip) {
  attempts.delete(ip);
}

module.exports = { isLocked, recordFailure, resetAttempts, MAX_ATTEMPTS, WINDOW_MINUTES: WINDOW_MS / 60000 };
