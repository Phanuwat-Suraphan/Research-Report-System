const path = require('node:path');
const fs = require('node:fs');
const { URL } = require('node:url');

const db = require('./db');
const { getClientIp, parseCookies, serializeCookie, parseRequestBody, sendHtml, redirect } = require('./lib/http');
const { serveFromDir } = require('./lib/static');
const gate = require('./lib/gate');
const { isLocked, recordFailure, resetAttempts, MAX_ATTEMPTS, WINDOW_MINUTES } = require('./lib/rateLimit');
const { COLUMNS } = require('./lib/fields');
const { collectLinks, loadLinks, saveLinks } = require('./lib/workLinks');
const { thumbnailUrl } = require('./lib/driveLink');
const { toDataUri, isSignatureDataUri } = require('./lib/signatureImage');
const { buildCertificateHtml } = require('./lib/certificate');
const { currentAcademicYear } = require('./lib/thaiDate');
const { DEFAULT_PASSCODE, WORK_TYPES } = require('./lib/config');
const revisions = require('./lib/revisions');
const backup = require('./lib/backup');

const { galleryPage } = require('./pages/gallery');
const { workDetailPage } = require('./pages/workDetail');
const { workFormPage } = require('./pages/workForm');
const { unlockPage } = require('./pages/unlock');
const { managePage } = require('./pages/manage');
const { historyPage } = require('./pages/history');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const COOKIE_NAME = 'edit_token';

// ---------- small helpers ----------

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

// Only ever redirect back to a path on this site — never to an absolute URL
// supplied in a query string.
function safeNext(value, fallback = '/') {
  const text = String(value || '');
  if (!text.startsWith('/') || text.startsWith('//')) return fallback;
  return text;
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

function loadWork(id) {
  if (!/^\d+$/.test(String(id))) return null;
  return db.prepare('SELECT * FROM works WHERE id = ?').get(Number(id));
}

function docNumberFor(work) {
  return `${String(work.id).padStart(4, '0')}/${work.academic_year || currentAcademicYear()}`;
}

function loadSubjects() {
  return db.prepare('SELECT * FROM subjects ORDER BY position, name').all();
}

function directorDetails() {
  return {
    savedSignature: db.getSetting('director_signature'),
    directorName: db.getSetting('director_name', ''),
    directorPosition: db.getSetting('director_position', ''),
  };
}

function siteUrlFor(req, pathname) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return host ? `${proto}://${host}${pathname}` : pathname;
}

const routes = [];
function on(method, routePath, handler, { requireUnlock = false } = {}) {
  routes.push({ method, path: routePath, handler, requireUnlock });
}

// ---------- passcode gate ----------

on('GET', '/unlock', (ctx) => {
  const next = safeNext(ctx.url.searchParams.get('next'));
  if (ctx.canEdit) return redirect(ctx.res, next);
  sendHtml(ctx.res, 200, unlockPage({ flash: ctx.flash, next, canEdit: false, csrfToken: ctx.csrfToken }));
});

on('POST', '/unlock', (ctx) => {
  const ip = getClientIp(ctx.req);
  const next = safeNext(ctx.fields.next);

  if (isLocked(ip)) {
    return sendHtml(
      ctx.res,
      429,
      unlockPage({
        flash: { type: 'error', message: `ใส่รหัสผิดเกิน ${MAX_ATTEMPTS} ครั้ง กรุณารอ ${WINDOW_MINUTES} นาทีแล้วลองใหม่` },
        next,
        csrfToken: ctx.csrfToken,
      })
    );
  }

  if (!gate.checkPasscode(ctx.fields.passcode)) {
    recordFailure(ip);
    db.logAudit('unlock_failed', { ip });
    return sendHtml(
      ctx.res,
      401,
      unlockPage({ flash: { type: 'error', message: 'รหัสไม่ถูกต้อง' }, next, csrfToken: ctx.csrfToken })
    );
  }

  resetAttempts(ip);
  db.logAudit('unlock', { ip });
  const { token, expiresAt } = gate.mintToken();
  redirect(ctx.res, next, { 'Set-Cookie': serializeCookie(COOKIE_NAME, token, { expires: expiresAt }) });
});

on('POST', '/lock', (ctx) => {
  redirect(ctx.res, safeNext(ctx.fields.next), { 'Set-Cookie': serializeCookie(COOKIE_NAME, '', { maxAge: 0 }) });
});

// ---------- public gallery ----------

on('GET', '/', (ctx) => {
  const filters = {
    q: ctx.url.searchParams.get('q') || '',
    work_type: ctx.url.searchParams.get('work_type') || '',
    subject_area: ctx.url.searchParams.get('subject_area') || '',
    academic_year: ctx.url.searchParams.get('academic_year') || '',
    certified: ctx.url.searchParams.get('certified') || '',
  };

  const clauses = ["status = 'published'"];
  const params = [];
  if (filters.q) {
    clauses.push('(title LIKE ? OR author_name LIKE ? OR abstract LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }
  if (WORK_TYPES[filters.work_type]) {
    clauses.push('work_type = ?');
    params.push(filters.work_type);
  }
  if (filters.subject_area) {
    clauses.push('subject_area = ?');
    params.push(filters.subject_area);
  }
  if (filters.academic_year) {
    clauses.push('academic_year = ?');
    params.push(filters.academic_year);
  }
  if (filters.certified === 'yes') clauses.push('certified_at IS NOT NULL');
  if (filters.certified === 'no') clauses.push('certified_at IS NULL');

  const works = db
    .prepare(`SELECT * FROM works WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC, id DESC`)
    .all(...params);

  // One query for every listed work's links, grouped in JS, rather than a
  // per-card query.
  const byWork = new Map(works.map((w) => [w.id, { drive: 0, info: [], media: [] }]));
  if (works.length) {
    const placeholders = works.map(() => '?').join(',');
    const links = db
      .prepare(`SELECT work_id, category, media_type, file_id, position FROM work_links WHERE work_id IN (${placeholders}) ORDER BY position`)
      .all(...works.map((w) => w.id));
    for (const link of links) {
      const bucket = byWork.get(link.work_id);
      if (!bucket) continue;
      if (link.category === 'drive') bucket.drive += 1;
      else if (link.category === 'infographic') bucket.info.push(link);
      else if (link.media_type) bucket.media.push(link.media_type);
    }
  }

  const cards = works.map((work) => {
    const bucket = byWork.get(work.id);
    const firstInfo = bucket.info[0];
    return {
      ...work,
      drive_count: bucket.drive,
      infographic_count: bucket.info.length,
      media_types: [...new Set(bucket.media)],
      cover_url: firstInfo ? thumbnailUrl(firstInfo.file_id, 800) : null,
    };
  });

  const counts = db
    .prepare("SELECT work_type, COUNT(*) AS c, SUM(CASE WHEN certified_at IS NOT NULL THEN 1 ELSE 0 END) AS certified FROM works WHERE status = 'published' GROUP BY work_type")
    .all();
  const stats = { total: 0, research: 0, innovation: 0, certified: 0 };
  for (const row of counts) {
    stats.total += row.c;
    stats.certified += row.certified || 0;
    if (row.work_type in stats) stats[row.work_type] = row.c;
  }

  const years = db
    .prepare("SELECT DISTINCT academic_year FROM works WHERE status = 'published' AND academic_year IS NOT NULL AND academic_year <> '' ORDER BY academic_year DESC")
    .all()
    .map((r) => r.academic_year);

  sendHtml(
    ctx.res,
    200,
    galleryPage({
      works: cards,
      filters,
      stats,
      subjects: loadSubjects(),
      years,
      flash: ctx.flash,
      canEdit: ctx.canEdit,
      csrfToken: ctx.csrfToken,
    })
  );
});

// ---------- create / edit ----------

on(
  'GET',
  '/works/new',
  (ctx) => {
    sendHtml(
      ctx.res,
      200,
      workFormPage({ mode: 'create', subjects: loadSubjects(), flash: ctx.flash, canEdit: ctx.canEdit, csrfToken: ctx.csrfToken })
    );
  },
  { requireUnlock: true }
);

function readWorkFields(fields) {
  const values = {};
  for (const key of COLUMNS) values[key] = (fields[key] || '').trim() || null;
  return values;
}

function validate(values, links) {
  const errors = [];
  if (!values.title) errors.push('กรุณากรอกชื่อเรื่องผลงาน');
  if (!values.author_name) errors.push('กรุณากรอกชื่อผู้จัดทำ');
  if (!links.drive.filter((r) => !r.error).length) errors.push('กรุณาใส่ลิงก์ผลงานบน Google Drive อย่างน้อย 1 ลิงก์');
  return errors.concat(links.errors);
}

function renderFormWithErrors(ctx, { mode, work, links, errors, status = 400 }) {
  sendHtml(
    ctx.res,
    status,
    workFormPage({
      mode,
      work,
      links,
      subjects: loadSubjects(),
      canEdit: ctx.canEdit,
      csrfToken: ctx.csrfToken,
      flash: { type: 'error', message: errors.join(' · ') },
    })
  );
}

on(
  'POST',
  '/works',
  (ctx) => {
    const values = readWorkFields(ctx.fields);
    const workType = WORK_TYPES[ctx.fields.work_type] ? ctx.fields.work_type : 'research';
    const links = collectLinks(ctx.multi);
    const errors = validate(values, links);
    if (errors.length) {
      return renderFormWithErrors(ctx, { mode: 'create', work: { ...values, work_type: workType }, links, errors });
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO works (${COLUMNS.join(', ')}, work_type, created_at, updated_at)
         VALUES (${COLUMNS.map(() => '?').join(', ')}, ?, ?, ?)`
      )
      .run(...COLUMNS.map((c) => values[c]), workType, now, now);

    const workId = Number(result.lastInsertRowid);
    saveLinks(workId, links);
    revisions.record(workId, 'create', ctx.ip);
    db.logAudit('create', { workId, detail: values.title, ip: ctx.ip });

    redirect(ctx.res, withFlash(`/works/${workId}`, 'success', 'เผยแพร่ผลงานเรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

on(
  'GET',
  '/works/:id/edit',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);
    sendHtml(
      ctx.res,
      200,
      workFormPage({
        mode: 'edit',
        work,
        links: loadLinks(work.id),
        subjects: loadSubjects(),
        flash: ctx.flash,
        canEdit: ctx.canEdit,
        csrfToken: ctx.csrfToken,
      })
    );
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/works/:id',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);

    const values = readWorkFields(ctx.fields);
    const workType = WORK_TYPES[ctx.fields.work_type] ? ctx.fields.work_type : work.work_type;
    const links = collectLinks(ctx.multi);
    const errors = validate(values, links);
    if (errors.length) {
      return renderFormWithErrors(ctx, { mode: 'edit', work: { ...work, ...values, work_type: workType }, links, errors });
    }

    // Snapshot the current state before overwriting anything.
    revisions.record(work.id, 'update', ctx.ip);

    db.prepare(
      `UPDATE works SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')}, work_type = ?, updated_at = ? WHERE id = ?`
    ).run(...COLUMNS.map((c) => values[c]), workType, new Date().toISOString(), work.id);

    saveLinks(work.id, links);
    db.logAudit('update', { workId: work.id, detail: values.title, ip: ctx.ip });

    redirect(ctx.res, withFlash(`/works/${work.id}`, 'success', 'บันทึกการแก้ไขเรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

// ---------- view ----------

on('GET', '/works/:id', (ctx) => {
  const work = loadWork(ctx.params.id);
  if (!work) return notFound(ctx);
  // Archived works stay reachable for whoever holds the passcode so they can
  // be restored, but are hidden from the public.
  if (work.status === 'archived' && !ctx.canEdit) return notFound(ctx);

  const { savedSignature, directorName, directorPosition } = directorDetails();
  sendHtml(
    ctx.res,
    200,
    workDetailPage({
      work,
      links: loadLinks(work.id),
      flash: ctx.flash,
      canEdit: ctx.canEdit,
      csrfToken: ctx.csrfToken,
      savedSignature,
      directorName,
      directorPosition,
    })
  );
});

on('GET', '/works/:id/certificate', (ctx) => {
  const work = loadWork(ctx.params.id);
  if (!work) return notFound(ctx);
  if (work.status === 'archived' && !ctx.canEdit) return notFound(ctx);
  if (!work.certified_at) {
    return redirect(ctx.res, withFlash(`/works/${work.id}`, 'error', 'ผลงานนี้ยังไม่ได้รับการรับรอง จึงยังพิมพ์หน้ารับรองไม่ได้'));
  }
  sendHtml(ctx.res, 200, buildCertificateHtml({ work, siteUrl: siteUrlFor(ctx.req, `/works/${work.id}`) }));
});

on(
  'GET',
  '/works/:id/history',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);
    sendHtml(
      ctx.res,
      200,
      historyPage({ work, revisions: revisions.listFor(work.id), canEdit: ctx.canEdit, csrfToken: ctx.csrfToken, flash: ctx.flash })
    );
  },
  { requireUnlock: true }
);

// ---------- certify ----------

on(
  'POST',
  '/works/:id/certify',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);

    const name = (ctx.fields.certifier_name || '').trim();
    const position = (ctx.fields.certifier_position || '').trim();
    if (!name || !position) {
      return redirect(ctx.res, withFlash(`/works/${work.id}`, 'error', 'กรุณากรอกชื่อและตำแหน่งผู้รับรอง'));
    }

    const upload = (ctx.files || []).find((f) => f.fieldName === 'signature_file' && f.data.length > 0);
    const useSaved = ctx.fields.signature_source !== 'upload' && !upload;
    let signature = null;

    if (useSaved) {
      signature = db.getSetting('director_signature');
      if (!isSignatureDataUri(signature)) {
        return redirect(
          ctx.res,
          withFlash(`/works/${work.id}`, 'error', 'ยังไม่มีลายเซ็นที่บันทึกไว้ กรุณาอัปโหลดรูปลายเซ็น หรือบันทึกไว้ที่หน้าจัดการระบบก่อน')
        );
      }
    } else {
      if (!upload) {
        return redirect(ctx.res, withFlash(`/works/${work.id}`, 'error', 'กรุณาเลือกไฟล์รูปลายเซ็นที่จะอัปโหลด'));
      }
      const converted = toDataUri(upload.data);
      if (!converted.ok) return redirect(ctx.res, withFlash(`/works/${work.id}`, 'error', converted.error));
      signature = converted.dataUri;
      // Keep it as the default so the next certification needs no upload.
      db.setSetting('director_signature', signature);
    }

    revisions.record(work.id, 'certify', ctx.ip);

    db.prepare(
      `UPDATE works SET certified_at = ?, certifier_name = ?, certifier_position = ?, certify_note = ?,
        certify_signature = ?, doc_number = ?, updated_at = ? WHERE id = ?`
    ).run(
      work.certified_at || new Date().toISOString(),
      name,
      position,
      (ctx.fields.certify_note || '').trim() || null,
      signature,
      work.doc_number || docNumberFor(work),
      new Date().toISOString(),
      work.id
    );

    // Remember the director's details so the next certification is one click.
    db.setSetting('director_name', name);
    db.setSetting('director_position', position);
    db.logAudit('certify', { workId: work.id, detail: name, ip: ctx.ip });

    redirect(ctx.res, withFlash(`/works/${work.id}`, 'success', 'ลงนามรับรองเรียบร้อยแล้ว พิมพ์หน้ารับรอง A4 ได้ทันที'));
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/works/:id/uncertify',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);
    revisions.record(work.id, 'uncertify', ctx.ip);
    db.prepare(
      "UPDATE works SET certified_at = NULL, certify_signature = NULL, updated_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), work.id);
    db.logAudit('uncertify', { workId: work.id, ip: ctx.ip });
    redirect(ctx.res, withFlash(`/works/${work.id}`, 'success', 'ยกเลิกการรับรองแล้ว'));
  },
  { requireUnlock: true }
);

// ---------- archive / restore ----------

on(
  'POST',
  '/works/:id/archive',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);
    revisions.record(work.id, 'archive', ctx.ip);
    db.prepare("UPDATE works SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      new Date().toISOString(),
      work.id
    );
    db.logAudit('archive', { workId: work.id, detail: work.title, ip: ctx.ip });
    redirect(ctx.res, withFlash('/manage', 'success', 'ย้ายผลงานไปถังขยะแล้ว — กู้คืนได้จากหน้านี้'));
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/works/:id/restore',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);
    revisions.record(work.id, 'restore', ctx.ip);
    db.prepare("UPDATE works SET status = 'published', archived_at = NULL, updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      work.id
    );
    db.logAudit('restore', { workId: work.id, detail: work.title, ip: ctx.ip });
    redirect(ctx.res, withFlash(`/works/${work.id}`, 'success', 'กู้คืนผลงานเรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/works/:id/restore-revision',
  (ctx) => {
    const work = loadWork(ctx.params.id);
    if (!work) return notFound(ctx);
    const revision = revisions.get(ctx.fields.revision_id);
    if (!revision || revision.work_id !== work.id) {
      return redirect(ctx.res, withFlash(`/works/${work.id}/history`, 'error', 'ไม่พบเวอร์ชันที่เลือก'));
    }
    revisions.restore(revision.id, ctx.ip);
    db.logAudit('rollback', { workId: work.id, detail: `revision ${revision.id}`, ip: ctx.ip });
    redirect(ctx.res, withFlash(`/works/${work.id}`, 'success', 'ย้อนกลับไปเวอร์ชันที่เลือกเรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

// ---------- manage ----------

on('GET', '/manage', (ctx) => {
  if (!ctx.canEdit) {
    return sendHtml(ctx.res, 200, managePage({ canEdit: false, csrfToken: ctx.csrfToken, flash: ctx.flash }));
  }
  const { savedSignature, directorName, directorPosition } = directorDetails();
  sendHtml(
    ctx.res,
    200,
    managePage({
      canEdit: true,
      csrfToken: ctx.csrfToken,
      flash: ctx.flash,
      signature: savedSignature,
      directorName,
      directorPosition,
      subjects: loadSubjects(),
      archived: db.prepare("SELECT * FROM works WHERE status = 'archived' ORDER BY archived_at DESC").all(),
      snapshots: backup.listSnapshots(),
      auditRows: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 25').all(),
      passcodeIsDefault: gate.currentPasscode() === DEFAULT_PASSCODE,
    })
  );
});

on(
  'POST',
  '/manage/signature',
  (ctx) => {
    const name = (ctx.fields.director_name || '').trim();
    const position = (ctx.fields.director_position || '').trim();
    if (name) db.setSetting('director_name', name);
    if (position) db.setSetting('director_position', position);

    const upload = (ctx.files || []).find((f) => f.fieldName === 'signature_file' && f.data.length > 0);
    if (upload) {
      const converted = toDataUri(upload.data);
      if (!converted.ok) return redirect(ctx.res, withFlash('/manage', 'error', converted.error));
      db.setSetting('director_signature', converted.dataUri);
      db.logAudit('signature_saved', { ip: ctx.ip });
      return redirect(ctx.res, withFlash('/manage', 'success', 'บันทึกลายเซ็นเรียบร้อยแล้ว'));
    }
    redirect(ctx.res, withFlash('/manage', 'success', 'บันทึกชื่อผู้รับรองเรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/manage/signature/delete',
  (ctx) => {
    db.prepare('DELETE FROM settings WHERE key = ?').run('director_signature');
    db.logAudit('signature_deleted', { ip: ctx.ip });
    redirect(ctx.res, withFlash('/manage', 'success', 'ลบลายเซ็นที่บันทึกไว้แล้ว'));
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/manage/passcode',
  (ctx) => {
    const next = String(ctx.fields.passcode || '').trim();
    if (next.length < 4) return redirect(ctx.res, withFlash('/manage', 'error', 'รหัสใหม่ต้องมีอย่างน้อย 4 ตัวอักษร'));
    if (next !== String(ctx.fields.passcode_confirm || '').trim()) {
      return redirect(ctx.res, withFlash('/manage', 'error', 'การยืนยันรหัสไม่ตรงกัน'));
    }
    gate.setPasscode(next);
    db.logAudit('passcode_changed', { ip: ctx.ip });
    // Changing the passcode invalidates every existing cookie, including this
    // one, so hand out a fresh cookie for the person who just changed it.
    const { token, expiresAt } = gate.mintToken();
    redirect(ctx.res, withFlash('/manage', 'success', 'เปลี่ยนรหัสเรียบร้อยแล้ว'), {
      'Set-Cookie': serializeCookie(COOKIE_NAME, token, { expires: expiresAt }),
    });
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/manage/subjects',
  (ctx) => {
    const name = (ctx.fields.name || '').trim();
    if (!name) return redirect(ctx.res, withFlash('/manage', 'error', 'กรุณาระบุชื่อกลุ่มสาระ'));
    try {
      db.prepare('INSERT INTO subjects (name) VALUES (?)').run(name);
    } catch {
      return redirect(ctx.res, withFlash('/manage', 'error', 'มีกลุ่มสาระนี้อยู่แล้ว'));
    }
    redirect(ctx.res, withFlash('/manage', 'success', 'เพิ่มกลุ่มสาระเรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/manage/subjects/:id/delete',
  (ctx) => {
    db.prepare('DELETE FROM subjects WHERE id = ?').run(ctx.params.id);
    redirect(ctx.res, withFlash('/manage', 'success', 'ลบกลุ่มสาระเรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

on(
  'POST',
  '/manage/backup',
  (ctx) => {
    backup.createSnapshot();
    backup.prune();
    db.logAudit('backup_created', { ip: ctx.ip });
    redirect(ctx.res, withFlash('/manage', 'success', 'สร้างไฟล์สำรองใหม่เรียบร้อยแล้ว'));
  },
  { requireUnlock: true }
);

on(
  'GET',
  '/manage/backup/download',
  (ctx) => {
    const file = backup.createSnapshot(path.join(backup.BACKUP_DIR, 'download.db'));
    const stat = fs.statSync(file);
    const name = `research-backup-${new Date().toISOString().slice(0, 10)}.db`;
    ctx.res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${name}"`,
    });
    fs.createReadStream(file).pipe(ctx.res);
    db.logAudit('backup_downloaded', { ip: ctx.ip });
  },
  { requireUnlock: true }
);

// ---------- errors ----------

function notFound(ctx) {
  sendHtml(ctx.res, 404, errorHtml('404', 'ไม่พบหน้าที่ต้องการ'));
}

function errorHtml(code, message) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${code}</title><link rel="stylesheet" href="/css/style.css"></head>
<body><main class="container narrow"><div class="card"><h1>${code}</h1><p>${message}</p>
<a class="btn" href="/">← กลับหน้าแรก</a></div></main></body></html>`;
}

// ---------- request handling ----------

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://internal');
  const pathname = url.pathname;

  if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
    return serveFromDir(res, PUBLIC_DIR, pathname);
  }

  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  const canEdit = gate.verifyToken(token);
  const csrfToken = canEdit ? gate.csrfFor(token) : '';

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const params = matchRoute(route.path, pathname);
    if (!params) continue;

    const ctx = {
      req,
      res,
      url,
      params,
      cookies,
      canEdit,
      csrfToken,
      ip: getClientIp(req),
      flash: readFlash(url),
    };

    try {
      if (req.method === 'POST') {
        const body = await parseRequestBody(req);
        ctx.fields = body.fields || {};
        ctx.multi = body.multi || {};
        ctx.files = body.files || [];

        // /unlock is the one POST reachable while locked; every other write
        // needs both the passcode cookie and its matching CSRF token.
        if (pathname !== '/unlock' && pathname !== '/lock') {
          if (!canEdit) return redirect(res, `/unlock?next=${encodeURIComponent(pathname)}`);
          if (!gate.verifyCsrf(token, ctx.fields._csrf)) {
            return sendHtml(res, 403, errorHtml('403', 'คำขอไม่ถูกต้อง (หมดอายุหรือถูกส่งมาจากหน้าอื่น) กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง'));
          }
        } else if (pathname === '/lock' && canEdit && !gate.verifyCsrf(token, ctx.fields._csrf)) {
          return sendHtml(res, 403, errorHtml('403', 'คำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่'));
        }
      }

      if (route.requireUnlock && !canEdit) {
        return redirect(res, `/unlock?next=${encodeURIComponent(pathname + url.search)}`);
      }

      await route.handler(ctx);
    } catch (err) {
      console.error(err);
      sendHtml(res, 500, errorHtml('500', 'เกิดข้อผิดพลาดภายในระบบ'));
    }
    return;
  }

  notFound({ res });
}

module.exports = { handleRequest };
