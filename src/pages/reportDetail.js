const { layout, escapeHtml, nl2br } = require('../lib/render');
const { REPORT_FIELDS } = require('../lib/fields');
const { STATUS_LABELS, STAGE_ROLE } = require('../lib/status');
const { ROLE_LABELS } = require('../lib/auth');
const { statusBadge } = require('./dashboard');
const { strokesToSvg } = require('../lib/signature');

function canEdit(user, report) {
  return user.role === 'teacher' && user.id === report.teacher_id && (report.status === 'draft' || report.status === 'returned');
}

function canActOn(user, report) {
  const requiredRole = STAGE_ROLE[report.status];
  if (!requiredRole || user.role !== requiredRole) return false;
  if (requiredRole === 'head' && report.subject_area !== user.subject_group) return false;
  return true;
}

function reportDetailPage({ user, report, attachments, approvals, flash }) {
  const fieldsHtml = REPORT_FIELDS.filter((f) => f.key !== 'title' && f.key !== 'subject_area')
    .map(
      (f) => `<div class="field">
        <label>${escapeHtml(f.label)}</label>
        <div class="readonly-field">${report[f.key] ? nl2br(report[f.key]) : '<span class="hint">-</span>'}</div>
      </div>`
    )
    .join('');

  const attachHtml = attachments.length
    ? `<ul class="attach-list">${attachments
        .map((a) => `<li>📎 <a href="/uploads/${a.stored_name}" target="_blank">${escapeHtml(a.file_name)}</a></li>`)
        .join('')}</ul>`
    : '<p class="hint">ไม่มีไฟล์แนบ</p>';

  const timelineHtml = approvals.length
    ? `<ul class="timeline">${approvals
        .map((a) => {
          const revoked = a.revoked_at ? ' <span class="hint">(ถูกเพิกถอนเนื่องจากมีการแก้ไขเอกสารภายหลัง)</span>' : '';
          const sig = a.signature_data && !a.revoked_at ? `<div>${strokesToSvg(a.signature_data)}</div>` : '';
          return `<li class="${a.action === 'reject' ? 'reject' : ''}">
            <strong>${escapeHtml(ROLE_LABELS[a.role] || a.role)}</strong> (${escapeHtml(a.user_name)})
            ${a.action === 'approve' ? 'ลงนามรับรอง' : 'ส่งกลับให้แก้ไข'}${revoked}
            <div class="meta">${escapeHtml(a.signed_at)} · IP ${escapeHtml(a.ip_address || '-')}</div>
            ${a.comment ? `<div>ความเห็น: ${escapeHtml(a.comment)}</div>` : ''}
            ${sig}
          </li>`;
        })
        .join('')}</ul>`
    : '<p class="hint">ยังไม่มีการตรวจ/ลงนาม</p>';

  let actionPanel = '';
  if (canEdit(user, report)) {
    actionPanel = `<div class="card">
      <a class="btn" href="/reports/${report.id}/edit">แก้ไขรายงาน</a>
    </div>`;
  } else if (canActOn(user, report)) {
    actionPanel = `<div class="card">
      <h2>ตรวจสอบและลงนาม</h2>
      <form method="post" action="/reports/${report.id}/decision">
        <div class="field">
          <label>ความเห็น (ถ้ามี)</label>
          <textarea name="comment" placeholder="ความเห็นประกอบการพิจารณา"></textarea>
        </div>
        <div class="field">
          <label>ลงลายมือชื่อ (วาดด้วยเมาส์หรือนิ้ว)</label>
          <div class="sig-canvas-wrap">
            <canvas id="sigCanvas"></canvas>
          </div>
          <button type="button" id="clearSig" class="linkbtn">ล้างลายเซ็น</button>
          <input type="hidden" name="signature_data" id="signatureData">
        </div>
        <div class="actions">
          <button class="btn" type="submit" name="decision" value="approve" id="approveBtn" disabled>ลงชื่อรับรอง / อนุมัติ</button>
          <button class="btn danger" type="submit" name="decision" value="reject" data-confirm="ยืนยันการส่งกลับให้แก้ไข?">ส่งกลับให้แก้ไข</button>
        </div>
      </form>
    </div>
    <script src="/js/signature.js"></script>
    <script>
      var canvas = document.getElementById('sigCanvas');
      var hidden = document.getElementById('signatureData');
      var clearBtn = document.getElementById('clearSig');
      var approveBtn = document.getElementById('approveBtn');
      initSignaturePad(canvas, hidden, clearBtn);
      canvas.addEventListener('mouseup', sync);
      canvas.addEventListener('touchend', sync);
      function sync() { approveBtn.disabled = !hidden.value; }
      setInterval(sync, 400);
    </script>`;
  } else if (report.status === 'approved') {
    actionPanel = `<div class="card">
      <p>เอกสารฉบับนี้ผ่านการอนุมัติและล็อกเวอร์ชันแล้ว</p>
      <a class="btn" href="/reports/${report.id}/document" target="_blank">เปิดเอกสารฉบับสมบูรณ์ (พิมพ์/บันทึกเป็น PDF ได้)</a>
    </div>`;
  }

  const body = `
  <h1>${escapeHtml(report.title)}</h1>
  <p>${statusBadge(report.status)} ${report.doc_number ? `· เลขที่เอกสาร ${escapeHtml(report.doc_number)}` : ''}</p>
  ${report.status === 'returned' && report.return_comment ? `<div class="flash flash-error"><strong>เหตุผลที่ส่งกลับ:</strong> ${escapeHtml(report.return_comment)}</div>` : ''}

  <div class="card">
    <div class="grid-2">
      <div class="field"><label>กลุ่มสาระการเรียนรู้</label><div class="readonly-field">${escapeHtml(report.subject_area)}</div></div>
      <div class="field"><label>ระดับชั้น</label><div class="readonly-field">${escapeHtml(report.grade_level || '-')}</div></div>
      <div class="field"><label>ภาคเรียน</label><div class="readonly-field">${escapeHtml(report.term || '-')}</div></div>
      <div class="field"><label>ปีการศึกษา</label><div class="readonly-field">${escapeHtml(report.academic_year || '-')}</div></div>
      <div class="field"><label>ผู้จัดทำ</label><div class="readonly-field">${escapeHtml(report.teacher_name)}</div></div>
    </div>
    ${fieldsHtml}
  </div>

  <div class="card">
    <h2>ไฟล์แนบหลักฐาน</h2>
    ${attachHtml}
  </div>

  ${actionPanel}

  <div class="card">
    <h2>ประวัติการตรวจสอบและลงนาม (Audit Trail)</h2>
    ${timelineHtml}
  </div>`;

  return layout({ title: report.title, user, body, flash });
}

module.exports = { reportDetailPage, canEdit, canActOn };
