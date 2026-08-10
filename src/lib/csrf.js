const crypto = require('node:crypto');

// Synchronizer-token check: every authenticated POST must echo back the
// CSRF token minted for that session (see auth.createSession), so a form
// submitted from another origin — which cannot read the token — is rejected.
function verifyCsrf(csrfToken, submitted) {
  if (!csrfToken || !submitted) return false;
  const a = Buffer.from(String(csrfToken));
  const b = Buffer.from(String(submitted));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifyCsrf };
