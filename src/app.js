const path = require('node:path');
const fs = require('node:fs');
const { URL } = require('node:url');

const db = require('./db');
const { hashPassword, verifyPassword, createSession, destroySession, getUserByToken, ROLE_LABELS } = require('./lib/auth');
const { parseCookies, serializeCookie, parseRequestBody, sendHtml, redirect } = require('./lib/http');
const { serveFromDir } = require('./lib/static');
const { saveUploadedFiles, UPLOAD_DIR } = require('./lib/uploads');
const { STAGE_ROLE, NEXT_STATUS } = require('./lib/status');
const { REPORT_FIELDS } = require('./lib/fields');
const { buildLockedHtml, hashContent } = require('./lib/lockedDocument');
const { LOCKED_DIR } = require('./lib/paths');

const { loginPage } = require('./pages/login');
const { dashboardPage } = require('./pages/dashboard');
const { reportFormPage } = require('./pages/reportForm');
const { reportDetailPage, canEdit, canActOn } = require('./pages/reportDetail');
const { adminUsersPage } = require('./pages/adminUsers');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function withFlash(location, type, message) {
  const url = new URL(location, 'http://internal');
  if (type && message) {
    url.searchParams.set('flash_type', type);
    url.searchParams.set('flash_msg', message);
  }
  return url.pathname + url.search;
}

function readFlash(url) {
  const type = url.searchParams.get('flash_type');
  const message = url.searchParams.get('flash_msg');
  if (!type || !message) return null;
  return { type, message };
}

function matchRoute(routePath, actualPath) {
  const routeParts = routePath.split('/').filter(Boolean);
  const actualParts = actualPath.split('/').filter(Boolean);
  if (routeParts.length !== actualParts.length) return null;
  const params = {};
  for (let i = 0; i < routeParts.length; i++) {
    const rp = routeParts[i];
    const ap = actualParts[i];
    if (rp.startsWith(':')) params[rp.slice(1)] = decodeURIComponent(ap);
    else if (rp !== ap) return null;
  }
  return params;
}

function docNumber(report) {
  const year = report.academic_year || String(new Date().getFullYear());
  return `รายงาน-${year}-${String(report.id).padStart(5, '0')}`;
}

function canView(user, report) {
  if (user.role === 'teacher') return report.teacher_id === user.id;
  if (user.role === 'head') return report.subject_area === user.subject_group;
  return ['academic', 'director', 'admin'].includes(user.role);
}

function loadReportWithTeacher(id) {
  return db
    .prepare(
      `SELECT reports.*, users.name AS teacher_name
       FROM reports JOIN users ON users.id = reports.teacher_id
       WHERE reports.id = ?`
    )
    .get(id);
}

function loadAttachments(reportId) {
  return db.prepare('SELECT * FROM attachments WHERE report_id = ? ORDER BY uploaded_at').all(reportId);
}

function loadApprovals(reportId) {
  return db
    .prepare(
      `SELECT approvals.*, users.name AS user_name
       FROM approvals JOIN users ON users.id = approvals.user_id
       WHERE report_id = ? ORDER BY signed_at`
    )
    .all(reportId);
}

const routes = [];
function on(method, path, handler) {
  routes.push({ method, path, handler });
}

// ---------- Auth ----------

on('GET', '/login', (ctx) => {
  if (ctx.user) return redirect(ctx.res, '/');
  sendHtml(ctx.res, 200, loginPage({ flash: ctx.flash }));
});

on('POST', '/login', async (ctx) => {
  const { fields } = await parseRequestBody(ctx.req);
  const email = (fields.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);
  if (!user || !verifyPassword(fields.password || '', user.password_salt, user.password_hash)) {
    return sendHtml(ctx.res, 401, loginPage({ flash: { type: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, email }));
  }
  const { token, expiresAt } = createSession(user.id);
  redirect(ctx.res, '/', { 'Set-Cookie': serializeCookie('session', token, { expires: new Date(expiresAt) }) });
});

on('POST', '/logout', (ctx) => {
  const token = ctx.cookies.session;
  if (token) destroySession(token);
  redirect(ctx.res, '/login', { 'Set-Cookie': serializeCookie('session', '', { maxAge: 0 }) });
});

// ---------- Dashboard ----------

on('GET', '/', (ctx) => {
  const { user } = ctx;
  const url = ctx.url;
  const filters = {
    q: url.searchParams.get('q') || '',
    subject_area: url.searchParams.get('subject_area') || '',
    grade_level: url.searchParams.get('grade_level') || '',
    academic_year: url.searchParams.get('academic_year') || '',
    status: url.searchParams.get('status') || '',
  };

  const clauses = [];
  const params = [];

  if (user.role === 'teacher') {
    clauses.push('reports.teacher_id = ?');
    params.push(user.id);
  } else if (user.role === 'head') {
    clauses.push('reports.subject_area = ?');
    params.push(user.subject_group);
  }

  if (filters.q) {
    clauses.push('reports.title LIKE ?');
    params.push(`%${filters.q}%`);
  }
  if (filters.subject_area) {
    clauses.push('reports.subject_area LIKE ?');
    params.push(`%${filters.subject_area}%`);
  }
  if (filters.grade_level) {
    clauses.push('reports.grade_level LIKE ?');
    params.push(`%${filters.grade_level}%`);
  }
  if (filters.academic_year) {
    clauses.push('reports.academic_year = ?');
    params.push(filters.academic_year);
  }
  if (filters.status) {
    clauses.push('reports.status = ?');
    params.push(filters.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const reports = db
    .prepare(
      `SELECT reports.*, users.name AS teacher_name
       FROM reports JOIN users ON users.id = reports.teacher_id
       ${where}
       ORDER BY reports.updated_at DESC`
    )
    .all(...params);

  sendHtml(ctx.res, 200, dashboardPage({ user, reports, filters, flash: ctx.flash }));
});

// ---------- Report create/edit ----------

on('GET', '/reports/new', (ctx) => {
  if (ctx.user.role !== 'teacher') return redirect(ctx.res, withFlash('/', 'error', 'เฉพาะครูผู้จัดทำเท่านั้นที่สร้างรายงานได้'));
  sendHtml(ctx.res, 200, reportFormPage({ user: ctx.user, mode: 'create', flash: ctx.flash }));
});

on('POST', '/reports', async (ctx) => {
  if (ctx.user.role !== 'teacher') return redirect(ctx.res, withFlash('/', 'error', 'ไม่มีสิทธิ์'));
  const { fields, files } = await parseRequestBody(ctx.req);
  if (!fields.title || !fields.subject_area) {
    return sendHtml(ctx.res, 400, reportFormPage({ user: ctx.user, mode: 'create', report: fields, flash: { type: 'error', message: 'กรุณากรอกชื่อเรื่องและกลุ่มสาระ' } }));
  }
  const isSubmit = fields.action === 'submit';
  const cols = REPORT_FIELDS.map((f) => f.key);
  const values = cols.map((k) => fields[k] || null);
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO reports (${cols.join(', ')}, teacher_id, status, submitted_at, created_at, updated_at)
       VALUES (${cols.map(() => '?').join(', ')}, ?, ?, ?, ?, ?)`
    )
    .run(...values, ctx.user.id, isSubmit ? 'submitted' : 'draft', isSubmit ? now : null, now, now);

  const reportId = Number(result.lastInsertRowid);
  const saved = saveUploadedFiles(files.filter((f) => f.fieldName === 'files'));
  const insertAttach = db.prepare('INSERT INTO attachments (report_id, file_name, stored_name, file_type, file_size) VALUES (?, ?, ?, ?, ?)');
  for (const a of saved) insertAttach.run(reportId, a.file_name, a.stored_name, a.file_type, a.file_size);

  redirect(ctx.res, withFlash(`/reports/${reportId}`, 'success', isSubmit ? 'ส่งรายงานเรียบร้อยแล้ว' : 'บันทึกฉบับร่างแล้ว'));
});

on('GET', '/reports/:id/edit', (ctx) => {
  const report = loadReportWithTeacher(ctx.params.id);
  if (!report) return notFoundPage(ctx);
  if (!canEdit(ctx.user, report)) return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'error', 'ไม่สามารถแก้ไขรายงานนี้ได้'));
  const attachments = loadAttachments(report.id);
  sendHtml(ctx.res, 200, reportFormPage({ user: ctx.user, mode: 'edit', report, attachments, flash: ctx.flash }));
});

on('POST', '/reports/:id', async (ctx) => {
  const report = loadReportWithTeacher(ctx.params.id);
  if (!report) return notFoundPage(ctx);
  if (!canEdit(ctx.user, report)) return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'error', 'ไม่สามารถแก้ไขรายงานนี้ได้'));

  const { fields, files } = await parseRequestBody(ctx.req);
  const isSubmit = fields.action === 'submit';
  const wasReturned = report.status === 'returned';
  const now = new Date().toISOString();

  const cols = REPORT_FIELDS.map((f) => f.key);
  const setClause = cols.map((k) => `${k} = ?`).join(', ');
  const values = cols.map((k) => fields[k] || null);

  let newStatus = report.status;
  let submittedAt = report.submitted_at;
  if (isSubmit) {
    newStatus = 'submitted';
    submittedAt = now;
  }

  db.prepare(
    `UPDATE reports SET ${setClause}, status = ?, return_stage = ?, return_comment = ?, submitted_at = ?, updated_at = ? WHERE id = ?`
  ).run(...values, newStatus, isSubmit ? null : report.return_stage, isSubmit ? null : report.return_comment, submittedAt, now, report.id);

  if (isSubmit && wasReturned) {
    // Revoke prior approvals so the whole chain re-signs the revised content.
    db.prepare("UPDATE approvals SET revoked_at = ? WHERE report_id = ? AND revoked_at IS NULL").run(now, report.id);
  }

  const saved = saveUploadedFiles(files.filter((f) => f.fieldName === 'files'));
  const insertAttach = db.prepare('INSERT INTO attachments (report_id, file_name, stored_name, file_type, file_size) VALUES (?, ?, ?, ?, ?)');
  for (const a of saved) insertAttach.run(report.id, a.file_name, a.stored_name, a.file_type, a.file_size);

  redirect(ctx.res, withFlash(`/reports/${report.id}`, 'success', isSubmit ? 'ส่งรายงานอีกครั้งเรียบร้อยแล้ว' : 'บันทึกการแก้ไขแล้ว'));
});

// ---------- Report view ----------

on('GET', '/reports/:id', (ctx) => {
  const report = loadReportWithTeacher(ctx.params.id);
  if (!report) return notFoundPage(ctx);
  if (!canView(ctx.user, report)) return forbiddenPage(ctx);
  const attachments = loadAttachments(report.id);
  const approvals = loadApprovals(report.id);
  sendHtml(ctx.res, 200, reportDetailPage({ user: ctx.user, report, attachments, approvals, flash: ctx.flash }));
});

on('POST', '/reports/:id/decision', async (ctx) => {
  const report = loadReportWithTeacher(ctx.params.id);
  if (!report) return notFoundPage(ctx);
  if (!canActOn(ctx.user, report)) return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'error', 'ไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้'));

  const { fields } = await parseRequestBody(ctx.req);
  const ip = ctx.req.socket.remoteAddress || '';
  const now = new Date().toISOString();

  if (fields.decision === 'approve') {
    if (!fields.signature_data) {
      return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'error', 'กรุณาลงลายมือชื่อก่อนยืนยันการอนุมัติ'));
    }
    db.prepare(
      'INSERT INTO approvals (report_id, user_id, role, action, signature_data, comment, ip_address, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(report.id, ctx.user.id, ctx.user.role, 'approve', fields.signature_data, fields.comment || null, ip, now);

    const newStatus = NEXT_STATUS[ctx.user.role];
    db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, report.id);

    if (newStatus === 'approved') {
      const finalNumber = docNumber(report);
      const attachments = loadAttachments(report.id);
      const approvals = loadApprovals(report.id);
      const fullReport = { ...report, doc_number: finalNumber };
      const html = buildLockedHtml({ report: fullReport, attachments, approvals });
      const hash = hashContent(html);
      const filePath = path.join(LOCKED_DIR, `${report.id}.html`);
      fs.writeFileSync(filePath, html, 'utf8');
      db.prepare('UPDATE reports SET doc_number = ?, locked_html_path = ?, locked_hash = ? WHERE id = ?').run(
        finalNumber,
        filePath,
        hash,
        report.id
      );
    }

    return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'success', 'ลงนามรับรองเรียบร้อยแล้ว'));
  }

  if (fields.decision === 'reject') {
    if (!fields.comment) {
      return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'error', 'กรุณาระบุเหตุผลที่ส่งกลับให้แก้ไข'));
    }
    db.prepare(
      'INSERT INTO approvals (report_id, user_id, role, action, comment, ip_address, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(report.id, ctx.user.id, ctx.user.role, 'reject', fields.comment, ip, now);

    db.prepare('UPDATE reports SET status = ?, return_stage = ?, return_comment = ?, updated_at = ? WHERE id = ?').run(
      'returned',
      ctx.user.role,
      fields.comment,
      now,
      report.id
    );

    return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'success', 'ส่งรายงานกลับให้แก้ไขแล้ว'));
  }

  redirect(ctx.res, withFlash(`/reports/${report.id}`, 'error', 'คำขอไม่ถูกต้อง'));
});

on('GET', '/reports/:id/document', (ctx) => {
  const report = loadReportWithTeacher(ctx.params.id);
  if (!report) return notFoundPage(ctx);
  if (!canView(ctx.user, report)) return forbiddenPage(ctx);
  if (report.status !== 'approved' || !report.locked_html_path || !fs.existsSync(report.locked_html_path)) {
    return redirect(ctx.res, withFlash(`/reports/${report.id}`, 'error', 'ยังไม่มีเอกสารฉบับอนุมัติ'));
  }
  const html = fs.readFileSync(report.locked_html_path, 'utf8');
  sendHtml(ctx.res, 200, html);
});

// ---------- Attachments ----------

on('GET', '/uploads/:filename', (ctx) => {
  const attachment = db.prepare('SELECT * FROM attachments WHERE stored_name = ?').get(ctx.params.filename);
  if (!attachment) return notFoundPage(ctx);
  const report = loadReportWithTeacher(attachment.report_id);
  if (!report || !canView(ctx.user, report)) return forbiddenPage(ctx);
  serveFromDir(ctx.res, UPLOAD_DIR, attachment.stored_name, { download: attachment.file_name });
});

// ---------- Admin ----------

on('GET', '/admin/users', (ctx) => {
  if (ctx.user.role !== 'admin') return forbiddenPage(ctx);
  const users = db.prepare('SELECT * FROM users ORDER BY role, name').all();
  sendHtml(ctx.res, 200, adminUsersPage({ user: ctx.user, users, flash: ctx.flash }));
});

on('POST', '/admin/users', async (ctx) => {
  if (ctx.user.role !== 'admin') return forbiddenPage(ctx);
  const { fields } = await parseRequestBody(ctx.req);
  const email = (fields.email || '').trim().toLowerCase();
  if (!fields.name || !email || !fields.role || !fields.password) {
    return redirect(ctx.res, withFlash('/admin/users', 'error', 'กรุณากรอกข้อมูลให้ครบถ้วน'));
  }
  if (db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email)) {
    return redirect(ctx.res, withFlash('/admin/users', 'error', 'อีเมลนี้ถูกใช้งานแล้ว'));
  }
  const { hash, salt } = hashPassword(fields.password);
  db.prepare('INSERT INTO users (name, email, password_hash, password_salt, role, subject_group) VALUES (?, ?, ?, ?, ?, ?)').run(
    fields.name,
    email,
    hash,
    salt,
    fields.role,
    fields.subject_group || null
  );
  redirect(ctx.res, withFlash('/admin/users', 'success', 'เพิ่มผู้ใช้เรียบร้อยแล้ว'));
});

// ---------- Error pages ----------

function notFoundPage(ctx) {
  sendHtml(ctx.res, 404, `<h1>404</h1><p>ไม่พบหน้าที่ต้องการ</p><a href="/">กลับหน้าหลัก</a>`);
}
function forbiddenPage(ctx) {
  sendHtml(ctx.res, 403, `<h1>403</h1><p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p><a href="/">กลับหน้าหลัก</a>`);
}

const PUBLIC_ROUTES = new Set(['/login']);

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://internal');
  const pathname = url.pathname;

  if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
    return serveFromDir(res, PUBLIC_DIR, pathname);
  }

  const cookies = parseCookies(req);
  const user = getUserByToken(cookies.session);

  if (!user && !PUBLIC_ROUTES.has(pathname)) {
    return redirect(res, '/login');
  }

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const params = matchRoute(route.path, pathname);
    if (!params) continue;
    const ctx = { req, res, url, params, cookies, user, flash: readFlash(url) };
    try {
      await route.handler(ctx);
    } catch (err) {
      console.error(err);
      sendHtml(res, 500, `<h1>500</h1><p>เกิดข้อผิดพลาดภายในระบบ</p>`);
    }
    return;
  }

  notFoundPage({ res });
}

module.exports = { handleRequest };
