const { SCHOOL_NAME, SITE_TITLE, SITE_TAGLINE, WORK_TYPES } = require('./config');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

// Only ever emit a URL into an href/src after this: the stored value comes
// from a form, and a javascript: or data: URL must never become a link.
function safeUrl(value) {
  const text = String(value || '').trim();
  if (!/^https:\/\//i.test(text)) return null;
  return text;
}

function csrfField(csrfToken) {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken || '')}">`;
}

function typeBadge(workType) {
  const label = WORK_TYPES[workType] || WORK_TYPES.research;
  return `<span class="badge badge-${escapeHtml(workType)}">${escapeHtml(label)}</span>`;
}

function certifiedBadge(work) {
  if (!work.certified_at) return '<span class="badge badge-pending">ยังไม่ได้รับรอง</span>';
  return '<span class="badge badge-certified">✓ ผู้อำนวยการรับรองแล้ว</span>';
}

const NAV_ITEMS = [
  { href: '/', label: 'ผลงานทั้งหมด' },
  { href: '/?work_type=research', label: 'งานวิจัยในชั้นเรียน' },
  { href: '/?work_type=innovation', label: 'นวัตกรรม' },
  { href: '/works/new', label: 'ส่งผลงาน' },
  { href: '/manage', label: 'จัดการระบบ' },
];

function layout({ title, body, flash, canEdit, csrfToken, activePath = '', headExtra = '' }) {
  const nav = NAV_ITEMS.map(
    (item) =>
      `<a class="navlink${item.href === activePath ? ' active' : ''}" href="${item.href}">${escapeHtml(item.label)}</a>`
  ).join('');

  const lockBox = canEdit
    ? `<form class="lockbox" method="post" action="/lock">${csrfField(csrfToken)}
         <span class="lock-state unlocked">🔓 ปลดล็อกแล้ว</span>
         <button class="linkbtn" type="submit">ล็อก</button>
       </form>`
    : `<a class="lockbox lock-state" href="/unlock">🔒 ใส่รหัสเพื่อแก้ไข</a>`;

  const flashHtml = flash ? `<div class="flash flash-${escapeHtml(flash.type)}">${escapeHtml(flash.message)}</div>` : '';

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(SITE_TITLE)} ${escapeHtml(SCHOOL_NAME)}</title>
<meta name="description" content="${escapeHtml(SITE_TAGLINE)} ${escapeHtml(SCHOOL_NAME)}">
<link rel="stylesheet" href="/css/style.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>📚</text></svg>">
${headExtra}
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/">
      <span class="brand-mark">📚</span>
      <span class="brand-text">
        <strong>${escapeHtml(SITE_TITLE)}</strong>
        <small>${escapeHtml(SCHOOL_NAME)}</small>
      </span>
    </a>
    <nav class="nav">${nav}</nav>
    ${lockBox}
  </div>
</header>
<main class="container">
${flashHtml}
${body}
</main>
<footer class="sitefoot">
  <div>${escapeHtml(SCHOOL_NAME)}</div>
  <div class="hint">${escapeHtml(SITE_TAGLINE)}</div>
</footer>
<script src="/js/app.js"></script>
</body>
</html>`;
}

module.exports = { escapeHtml, nl2br, safeUrl, layout, csrfField, typeBadge, certifiedBadge };
