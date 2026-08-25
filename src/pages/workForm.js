const { layout, escapeHtml, csrfField } = require('../lib/render');
const { BASIC_FIELDS, DETAIL_FIELDS } = require('../lib/fields');
const { WORK_TYPES } = require('../lib/config');
const { SHARING_HINT } = require('../lib/driveLink');
const { MEDIA_TYPES } = require('../lib/mediaLink');
const { currentAcademicYear } = require('../lib/thaiDate');

function rowError(row) {
  return row && row.error ? `<div class="row-error">⚠ ${escapeHtml(row.error)}</div>` : '';
}

function driveRow(row = {}) {
  return `<div class="linkrow">
    <input type="text" name="drive_label" placeholder="ชื่อรายการ (เช่น รายงานฉบับเต็ม)" value="${escapeHtml(row.label || '')}">
    <input type="text" name="drive_url" inputmode="url" placeholder="วางลิงก์ Google Drive ที่นี่" value="${escapeHtml(row.url || '')}">
    <button type="button" class="linkbtn" data-remove-row>ลบ</button>
    ${rowError(row)}
  </div>`;
}

function infoRow(row = {}) {
  return `<div class="linkrow">
    <input type="text" name="info_label" placeholder="คำอธิบายภาพ (ไม่บังคับ)" value="${escapeHtml(row.label || '')}">
    <input type="text" name="info_url" inputmode="url" placeholder="วางลิงก์รูปอินโฟกราฟิกที่อยู่ใน Drive" value="${escapeHtml(row.url || '')}">
    <button type="button" class="linkbtn" data-remove-row>ลบ</button>
    ${rowError(row)}
  </div>`;
}

function mediaRow(row = {}) {
  const options = Object.entries(MEDIA_TYPES)
    .map(([k, v]) => `<option value="${k}" ${row.media_type === k ? 'selected' : ''}>${escapeHtml(v)}</option>`)
    .join('');
  return `<div class="linkrow linkrow-3">
    <select name="media_type">${options}</select>
    <input type="text" name="media_label" placeholder="ชื่อสื่อ (เช่น คลิปการสอน)" value="${escapeHtml(row.label || '')}">
    <input type="text" name="media_url" inputmode="url" placeholder="วางลิงก์ YouTube / เกม / เว็บไซต์ / เอกสาร" value="${escapeHtml(row.url || '')}">
    <button type="button" class="linkbtn" data-remove-row>ลบ</button>
    ${rowError(row)}
  </div>`;
}

function section({ id, title, description, rows, renderRow, addLabel, required }) {
  const existing = rows.length ? rows : [{}];
  return `<section class="card">
    <h2>${escapeHtml(title)}${required ? ' <span class="req">*</span>' : ' <span class="optional">(ไม่บังคับ)</span>'}</h2>
    <p class="hint">${description}</p>
    <div class="linkrows" id="${id}">${existing.map(renderRow).join('')}</div>
    <template id="${id}-tpl">${renderRow({})}</template>
    <button type="button" class="btn secondary small" data-add-row="${id}">➕ ${escapeHtml(addLabel)}</button>
  </section>`;
}

function fieldInput(field, work, subjects) {
  const value = work[field.key] || '';
  if (field.type === 'select') {
    const options = subjects
      .map((s) => `<option value="${escapeHtml(s.name)}" ${value === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
      .join('');
    return `<select name="${field.key}"><option value="">— เลือกกลุ่มสาระ —</option>${options}</select>`;
  }
  if (field.type === 'textarea') {
    return `<textarea name="${field.key}" rows="3" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(value)}</textarea>`;
  }
  return `<input type="text" name="${field.key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(
    field.placeholder || ''
  )}" ${field.required ? 'required' : ''}>`;
}

function workFormPage({ work = {}, links = { drive: [], infographic: [], media: [] }, subjects = [], mode, flash, canEdit, csrfToken }) {
  const isEdit = mode === 'edit';
  const workType = work.work_type || 'research';
  const yearDefault = work.academic_year || currentAcademicYear();

  const typeCards = Object.entries(WORK_TYPES)
    .map(
      ([key, label]) => `<label class="typecard">
        <input type="radio" name="work_type" value="${key}" ${workType === key ? 'checked' : ''}>
        <span class="typecard-inner">
          <span class="typecard-emoji">${key === 'research' ? '🔬' : '💡'}</span>
          <strong>${escapeHtml(label)}</strong>
        </span>
      </label>`
    )
    .join('');

  const basicHtml = BASIC_FIELDS.map((f) => {
    const value = f.key === 'academic_year' ? { ...work, academic_year: yearDefault } : work;
    return `<div class="field" style="${f.full ? 'grid-column: 1 / -1;' : ''}">
      <label>${escapeHtml(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
      ${fieldInput(f, value, subjects)}
    </div>`;
  }).join('');

  const detailHtml = DETAIL_FIELDS.map(
    (f) => `<div class="field">
      <label>${escapeHtml(f.label)}</label>
      ${fieldInput(f, work, subjects)}
    </div>`
  ).join('');

  const body = `
  <h1>${isEdit ? 'แก้ไขผลงาน' : 'ส่งผลงานวิจัย / นวัตกรรม'}</h1>
  <p class="hint">งานฉบับเต็มให้เก็บไว้ใน Google Drive ของท่าน แล้วนำ <strong>ลิงก์</strong> มาวางในหน้านี้ — ระบบไม่รับไฟล์อัปโหลด ทำให้ไฟล์ต้นฉบับยังอยู่ในไดรฟ์ของท่านเสมอ</p>

  <form method="post" action="${isEdit ? `/works/${work.id}` : '/works'}" class="workform">
    ${csrfField(csrfToken)}

    <section class="card">
      <h2>ประเภทผลงาน <span class="req">*</span></h2>
      <div class="typecards">${typeCards}</div>
    </section>

    <section class="card">
      <h2>ข้อมูลผลงาน</h2>
      <div class="grid-2">${basicHtml}</div>
    </section>

    ${section({
      id: 'driveRows',
      title: 'ลิงก์ผลงานบน Google Drive',
      description: `ต้องมีอย่างน้อย 1 ลิงก์ — ${escapeHtml(SHARING_HINT)}`,
      rows: links.drive,
      renderRow: driveRow,
      addLabel: 'เพิ่มลิงก์ไดรฟ์',
      required: true,
    })}

    ${section({
      id: 'infoRows',
      title: 'อินโฟกราฟิกสรุปผลงาน',
      description:
        'ถ้ามีภาพอินโฟกราฟิกอยู่ในไดรฟ์ ให้วางลิงก์รูปไว้ที่นี่ ระบบจะนำมาแสดงเป็นภาพหน้าปกและแสดงเต็มภาพในหน้าผลงาน ข้ามได้ถ้าไม่มี',
      rows: links.infographic,
      renderRow: infoRow,
      addLabel: 'เพิ่มอินโฟกราฟิก',
    })}

    ${section({
      id: 'mediaRows',
      title: 'สื่อ/ผลงานที่ให้คนดูและเล่นได้ทันที',
      description:
        'คลิป YouTube, เกม, เว็บไซต์ หรือเอกสารออนไลน์ที่ท่านทำขึ้น ผู้เข้าชมจะกดดูหรือเล่นได้จากหน้าผลงานเลย ข้ามได้ถ้าไม่มี',
      rows: links.media,
      renderRow: mediaRow,
      addLabel: 'เพิ่มสื่อ',
    })}

    <section class="card">
      <details ${DETAIL_FIELDS.some((f) => work[f.key]) ? 'open' : ''}>
        <summary><strong>รายละเอียดเพิ่มเติม (บทคัดย่อ วัตถุประสงค์ ผลที่เกิดขึ้น)</strong> — ไม่บังคับ แต่ช่วยให้ผู้อ่านเข้าใจผลงานโดยไม่ต้องเปิดไฟล์</summary>
        <div class="detail-fields">${detailHtml}</div>
      </details>
    </section>

    <div class="actions sticky-actions">
      <button class="btn" type="submit">${isEdit ? '💾 บันทึกการแก้ไข' : '📤 เผยแพร่ผลงาน'}</button>
      <a class="btn secondary" href="${isEdit ? `/works/${work.id}` : '/'}">ยกเลิก</a>
    </div>
  </form>`;

  return layout({ title: isEdit ? 'แก้ไขผลงาน' : 'ส่งผลงาน', body, flash, canEdit, csrfToken, activePath: '/works/new' });
}

module.exports = { workFormPage };
