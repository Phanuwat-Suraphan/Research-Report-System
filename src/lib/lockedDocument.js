const crypto = require('node:crypto');
const { escapeHtml, nl2br } = require('./render');
const { REPORT_FIELDS } = require('./fields');
const { strokesToSvg } = require('./signature');
const { ROLE_LABELS } = require('./auth');

// Builds the canonical, immutable, self-contained HTML record for a fully
// approved report. It intentionally does NOT link to /css/style.css or any
// other mutable app asset, and embeds signatures as inline vector SVG, so
// the saved file remains byte-identical and independently verifiable no
// matter how the live application evolves later. The browser's own
// print-to-PDF (Ctrl+P) turns this into a PDF on demand, which correctly
// renders Thai text using the viewer's system fonts.
function buildLockedHtml({ report, attachments, approvals }) {
  const fieldsHtml = REPORT_FIELDS.filter((f) => f.key !== 'title')
    .map(
      (f) => `<div class="f"><div class="l">${escapeHtml(f.label)}</div><div class="v">${
        report[f.key] ? nl2br(report[f.key]) : '-'
      }</div></div>`
    )
    .join('');

  const attachHtml = attachments.length
    ? `<ul>${attachments.map((a) => `<li>${escapeHtml(a.file_name)}</li>`).join('')}</ul>`
    : '<p>ไม่มีไฟล์แนบ</p>';

  const signHtml = approvals
    .filter((a) => a.action === 'approve' && !a.revoked_at)
    .map(
      (a) => `<div class="sig-block">
        <div>${strokesToSvg(a.signature_data, { width: 200, height: 60 })}</div>
        <div class="sig-name">${escapeHtml(a.user_name)}</div>
        <div class="sig-role">${escapeHtml(ROLE_LABELS[a.role] || a.role)}</div>
        <div class="sig-time">ลงนามเมื่อ ${escapeHtml(a.signed_at)} น.</div>
      </div>`
    )
    .join('');

  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${escapeHtml(report.title)} — เอกสารฉบับอนุมัติ</title>
<style>
  body { font-family: "Sarabun","Noto Sans Thai","TH Sarabun New",Tahoma,sans-serif; color:#1f2933; max-width: 820px; margin: 0 auto; padding: 32px 24px 80px; line-height: 1.7; }
  h1 { font-size: 1.35rem; text-align:center; margin-bottom: 4px; }
  .subtitle { text-align:center; color:#555; margin-bottom: 24px; }
  .meta { display:flex; justify-content:space-between; font-size:0.85rem; color:#555; border-bottom:1px solid #ccc; padding-bottom:8px; margin-bottom:20px; }
  .f { margin-bottom: 14px; }
  .f .l { font-weight:700; font-size:0.9rem; margin-bottom:2px; }
  .f .v { white-space:pre-wrap; font-size:0.95rem; }
  h2 { font-size:1.05rem; border-bottom:2px solid #1565c0; padding-bottom:4px; margin-top:32px; }
  .sig-area { display:flex; flex-wrap:wrap; gap:24px; margin-top:16px; }
  .sig-block { text-align:center; width: 220px; }
  .sig-name { font-weight:700; margin-top:4px; }
  .sig-role { font-size:0.85rem; color:#555; }
  .sig-time { font-size:0.78rem; color:#777; }
  .stamp { display:inline-block; border:2px solid #2e7d32; color:#2e7d32; padding:6px 16px; border-radius:4px; font-weight:700; margin: 20px 0; }
  .printbar { position: fixed; top: 12px; right: 12px; }
  .printbar button { padding: 8px 16px; border-radius: 6px; border: 1px solid #1565c0; background:#1565c0; color:#fff; cursor:pointer; font-family:inherit; }
  footer { margin-top: 40px; font-size: 0.75rem; color: #888; border-top: 1px solid #ccc; padding-top: 10px; }
  @media print { .printbar { display:none; } body { padding: 0; } }
</style>
</head>
<body>
<div class="printbar"><button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button></div>
<h1>${escapeHtml(report.title)}</h1>
<div class="subtitle">รายงานผลการวิจัยในชั้นเรียน/นวัตกรรมครู (ฉบับอนุมัติ — ล็อกเวอร์ชัน)</div>
<div class="meta">
  <span>เลขที่เอกสาร: ${escapeHtml(report.doc_number || '-')}</span>
  <span>ผู้จัดทำ: ${escapeHtml(report.teacher_name)}</span>
  <span>กลุ่มสาระ: ${escapeHtml(report.subject_area)}</span>
</div>
<div class="stamp">อนุมัติแล้ว — เอกสารนี้ถูกล็อกและไม่สามารถแก้ไขได้</div>
${fieldsHtml}
<h2>ไฟล์แนบหลักฐาน</h2>
${attachHtml}
<h2>ลายมือชื่อผู้ตรวจสอบและรับรอง</h2>
<div class="sig-area">${signHtml}</div>
<footer>
  เอกสารนี้สร้างโดยระบบรายงานวิจัยและนวัตกรรมครูแบบดิจิทัล เมื่อ ${escapeHtml(generatedAt)} (UTC)
  เอกสารฉบับนี้เป็นสำเนาที่ล็อกเวอร์ชันหลังการลงนามครบทุกขั้นตอนตาม Workflow และมี Audit Trail กำกับไว้ในระบบ
</footer>
</body>
</html>`;
}

function hashContent(html) {
  return crypto.createHash('sha256').update(html, 'utf8').digest('hex');
}

module.exports = { buildLockedHtml, hashContent };
