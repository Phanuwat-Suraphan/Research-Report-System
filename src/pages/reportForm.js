const { layout, escapeHtml, csrfField } = require('../lib/render');
const { REPORT_FIELDS } = require('../lib/fields');

function reportFormPage({ user, report, attachments = [], subjects = [], flash, mode, csrfToken }) {
  const isEdit = mode === 'edit';
  const r = report || {};

  const fieldsHtml = REPORT_FIELDS.map((f) => {
    const value = r[f.key] || '';
    let inputHtml;
    if (f.key === 'subject_area') {
      const options = subjects
        .map((s) => `<option value="${escapeHtml(s.name)}" ${value === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
        .join('');
      inputHtml = `<select name="${f.key}" required><option value="">— เลือกกลุ่มสาระ —</option>${options}</select>`;
    } else if (f.type === 'textarea') {
      inputHtml = `<textarea name="${f.key}" ${f.required ? 'required' : ''}>${escapeHtml(value)}</textarea>`;
    } else {
      inputHtml = `<input type="text" name="${f.key}" value="${escapeHtml(value)}" ${f.required ? 'required' : ''}>`;
    }
    return `<div class="field" style="${f.full ? 'grid-column: 1 / -1;' : ''}">
      <label>${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
      ${inputHtml}
    </div>`;
  }).join('');

  const attachHtml = attachments.length
    ? `<ul class="attach-list">${attachments
        .map((a) => `<li>📎 <a href="/uploads/${a.stored_name}" target="_blank">${escapeHtml(a.file_name)}</a></li>`)
        .join('')}</ul>`
    : '<p class="hint">ยังไม่มีไฟล์แนบ</p>';

  const body = `
  <h1>${isEdit ? 'แก้ไขรายงาน' : 'สร้างรายงานวิจัย/นวัตกรรมใหม่'}</h1>
  ${r.status === 'returned' && r.return_comment ? `<div class="flash flash-error"><strong>ข้อเสนอแนะจากผู้ตรวจ:</strong> ${escapeHtml(r.return_comment)}</div>` : ''}
  <form method="post" action="${isEdit ? `/reports/${r.id}` : '/reports'}" enctype="multipart/form-data">
    ${csrfField(csrfToken)}
    <div class="card">
      <div class="grid-2">
        ${fieldsHtml}
      </div>
    </div>
    <div class="card">
      <h2>ไฟล์แนบหลักฐาน</h2>
      ${isEdit ? attachHtml : ''}
      <div class="field">
        <label>แนบไฟล์เพิ่มเติม (PDF, Word, รูปภาพ)</label>
        <input type="file" name="files" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
      </div>
    </div>
    <div class="actions">
      <button class="btn secondary" type="submit" name="action" value="save">บันทึกฉบับร่าง</button>
      <button class="btn" type="submit" name="action" value="submit">ส่งเพื่อขอตรวจสอบ</button>
      <a class="btn secondary" href="/">ยกเลิก</a>
    </div>
  </form>`;

  return layout({ title: isEdit ? 'แก้ไขรายงาน' : 'สร้างรายงานใหม่', user, csrfToken, body, flash });
}

module.exports = { reportFormPage };
