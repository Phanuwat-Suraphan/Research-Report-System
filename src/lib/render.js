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

const NAV_ITEMS = [
  { href: '/', label: 'แดชบอร์ด', roles: ['teacher', 'head', 'academic', 'director', 'admin'] },
  { href: '/reports/new', label: 'สร้างรายงานใหม่', roles: ['teacher'] },
  { href: '/admin/users', label: 'จัดการผู้ใช้', roles: ['admin'] },
  { href: '/admin/subjects', label: 'จัดการกลุ่มสาระ', roles: ['admin'] },
  { href: '/account/password', label: 'เปลี่ยนรหัสผ่าน', roles: ['teacher', 'head', 'academic', 'director', 'admin'] },
];

function csrfField(csrfToken) {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken || '')}">`;
}

function layout({ title, user, csrfToken, body, flash }) {
  const nav = user
    ? NAV_ITEMS.filter((item) => item.roles.includes(user.role))
        .map((item) => `<a class="navlink" href="${item.href}">${escapeHtml(item.label)}</a>`)
        .join('')
    : '';

  const userBox = user
    ? `<div class="userbox"><span>${escapeHtml(user.name)}</span><form method="post" action="/logout" style="display:inline">${csrfField(csrfToken)}<button class="linkbtn" type="submit">ออกจากระบบ</button></form></div>`
    : '';

  const flashHtml = flash ? `<div class="flash flash-${flash.type}">${escapeHtml(flash.message)}</div>` : '';

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ระบบรายงานวิจัยและนวัตกรรมครู</title>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<header class="topbar">
  <div class="brand"><a href="/">ระบบรายงานวิจัย-นวัตกรรมครู</a></div>
  <nav class="nav">${nav}</nav>
  ${userBox}
</header>
<main class="container">
${flashHtml}
${body}
</main>
<script src="/js/app.js"></script>
</body>
</html>`;
}

module.exports = { escapeHtml, nl2br, layout, csrfField };
