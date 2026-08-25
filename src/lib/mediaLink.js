const { parseDriveLink } = require('./driveLink');

// Links to the things a teacher built alongside the paper: a YouTube clip, a
// game, a website, an online document. Visitors should be able to watch or
// play without leaving the page, so known providers get a real embed URL.
//
// Embedding is allowlist-only. Anything outside the list still gets stored
// and shown, but as a button that opens in a new tab — the site never drops
// an arbitrary third-party page into an iframe on the school's own domain.

const MEDIA_TYPES = {
  video: 'วิดีโอ / YouTube',
  game: 'เกม / สื่อโต้ตอบ',
  website: 'เว็บไซต์',
  document: 'เอกสารออนไลน์',
  other: 'สื่ออื่น ๆ',
};

const MEDIA_ICONS = {
  video: '▶',
  game: '🎮',
  website: '🌐',
  document: '📄',
  other: '🔗',
};

function youtubeId(url) {
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return segments[0] || null;
  if (host !== 'youtube.com') return null;
  if (segments[0] === 'watch') return url.searchParams.get('v');
  if (['embed', 'shorts', 'live', 'v'].includes(segments[0])) return segments[1] || null;
  return null;
}

function detect(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  const ytId = youtubeId(url);
  if (ytId && /^[A-Za-z0-9_-]{6,}$/.test(ytId)) {
    return { provider: 'youtube', type: 'video', embedUrl: `https://www.youtube.com/embed/${ytId}` };
  }

  if (host === 'scratch.mit.edu' && segments[0] === 'projects' && /^\d+$/.test(segments[1] || '')) {
    return { provider: 'scratch', type: 'game', embedUrl: `https://scratch.mit.edu/projects/${segments[1]}/embed` };
  }

  if (host === 'wordwall.net') {
    const id = segments[0] === 'resource' || segments[0] === 'embed' ? segments[1] : null;
    if (id && /^[A-Za-z0-9]+$/.test(id)) {
      return { provider: 'wordwall', type: 'game', embedUrl: `https://wordwall.net/embed/${id}` };
    }
  }

  if (host === 'canva.com' && segments[0] === 'design' && segments[1] && segments[2]) {
    const id = encodeURIComponent(segments[1]);
    const token = encodeURIComponent(segments[2]);
    return { provider: 'canva', type: 'document', embedUrl: `https://www.canva.com/design/${id}/${token}/view?embed` };
  }

  if (host === 'drive.google.com' || host === 'docs.google.com' || host === 'forms.gle') {
    const drive = parseDriveLink(url.href);
    if (drive.ok) {
      return {
        provider: 'google',
        type: drive.kind === 'forms' ? 'website' : 'document',
        embedUrl: drive.previewUrl,
      };
    }
  }

  return { provider: 'web', type: 'website', embedUrl: null };
}

// Returns { ok, url, provider, mediaType, embedUrl } or { ok:false, error }.
// `preferredType` is what the teacher picked in the dropdown; it wins over
// the guess except that it can never turn a non-embeddable link into an
// embedded one.
function parseMediaLink(raw, preferredType) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return { ok: false, error: 'ยังไม่ได้วางลิงก์' };

  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: 'รูปแบบลิงก์ไม่ถูกต้อง กรุณาวางลิงก์เต็ม เช่น https://www.youtube.com/watch?v=...' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'ลิงก์ต้องขึ้นต้นด้วย https://' };
  }
  if (url.protocol === 'http:') {
    // Browsers block plain-http frames inside an https page anyway, and the
    // upgrade is almost always available.
    url.protocol = 'https:';
  }

  const detected = detect(url);
  const mediaType = MEDIA_TYPES[preferredType] ? preferredType : detected.type;

  return {
    ok: true,
    url: url.href,
    provider: detected.provider,
    mediaType,
    embedUrl: detected.embedUrl,
  };
}

function mediaTypeLabel(type) {
  return MEDIA_TYPES[type] || MEDIA_TYPES.other;
}

function mediaTypeIcon(type) {
  return MEDIA_ICONS[type] || MEDIA_ICONS.other;
}

module.exports = { parseMediaLink, mediaTypeLabel, mediaTypeIcon, MEDIA_TYPES };
