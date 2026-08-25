const { layout, escapeHtml, typeBadge, safeUrl } = require('../lib/render');
const { SCHOOL_NAME, SITE_TAGLINE, WORK_TYPES } = require('../lib/config');
const { mediaTypeIcon } = require('../lib/mediaLink');
const { thaiShortDate } = require('../lib/thaiDate');

const TYPE_EMOJI = { research: '🔬', innovation: '💡' };

function cover(work) {
  const url = safeUrl(work.cover_url);
  const emoji = TYPE_EMOJI[work.work_type] || '📘';
  if (url) {
    // A Drive image only loads when its owner shared it with "anyone with the
    // link"; public/js/app.js swaps in the plain cover below if it fails.
    return `<div class="card-cover card-cover-${escapeHtml(work.work_type)}" data-emoji="${emoji}">
      <img src="${escapeHtml(url)}" alt="อินโฟกราฟิก ${escapeHtml(work.title)}" loading="lazy" referrerpolicy="no-referrer">
    </div>`;
  }
  return `<div class="card-cover card-cover-blank card-cover-${escapeHtml(work.work_type)}"><span>${emoji}</span></div>`;
}

function attachmentIcons(work) {
  const icons = [];
  if (work.drive_count) icons.push(`<span title="ไฟล์บน Google Drive ${work.drive_count} รายการ">📁 ${work.drive_count}</span>`);
  if (work.infographic_count) icons.push('<span title="มีอินโฟกราฟิก">🖼️</span>');
  for (const type of work.media_types || []) {
    icons.push(`<span title="${escapeHtml(type)}">${mediaTypeIcon(type)}</span>`);
  }
  return icons.length ? `<div class="card-icons">${icons.join('')}</div>` : '';
}

function workCard(work) {
  return `<a class="workcard" href="/works/${work.id}">
    ${cover(work)}
    <div class="card-body">
      <div class="card-badges">${typeBadge(work.work_type)}${
        work.certified_at ? '<span class="badge badge-certified">✓ รับรองแล้ว</span>' : ''
      }</div>
      <h3>${escapeHtml(work.title)}</h3>
      <div class="card-meta">${escapeHtml(work.author_name)}</div>
      <div class="card-meta hint">${[work.subject_area, work.grade_level, work.academic_year ? `ปีการศึกษา ${work.academic_year}` : '']
        .filter(Boolean)
        .map(escapeHtml)
        .join(' · ')}</div>
      ${attachmentIcons(work)}
    </div>
  </a>`;
}

function statTile(count, label, emoji) {
  return `<div class="stat-tile"><div class="stat-emoji">${emoji}</div><div class="stat-count">${count}</div><div class="stat-label">${escapeHtml(
    label
  )}</div></div>`;
}

function galleryPage({ works, filters = {}, stats, subjects = [], years = [], flash, canEdit, csrfToken }) {
  const typeOptions = Object.entries(WORK_TYPES)
    .map(([k, v]) => `<option value="${k}" ${filters.work_type === k ? 'selected' : ''}>${escapeHtml(v)}</option>`)
    .join('');
  const subjectOptions = subjects
    .map((s) => `<option value="${escapeHtml(s.name)}" ${filters.subject_area === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
    .join('');
  const yearOptions = years
    .map((y) => `<option value="${escapeHtml(y)}" ${filters.academic_year === y ? 'selected' : ''}>${escapeHtml(y)}</option>`)
    .join('');

  const body = `
  <section class="hero">
    <h1>ผลงานวิจัยและนวัตกรรมของครู</h1>
    <p>${escapeHtml(SCHOOL_NAME)} — ${escapeHtml(SITE_TAGLINE)}</p>
    <div class="stats-row">
      ${statTile(stats.total, 'ผลงานทั้งหมด', '📚')}
      ${statTile(stats.research, WORK_TYPES.research, '🔬')}
      ${statTile(stats.innovation, WORK_TYPES.innovation, '💡')}
      ${statTile(stats.certified, 'ผู้อำนวยการรับรองแล้ว', '✅')}
    </div>
    <div class="hero-actions">
      <a class="btn" href="/works/new">➕ ส่งผลงานของฉัน</a>
      ${canEdit ? '' : '<span class="hint">ทุกคนเข้าชมได้โดยไม่ต้องเข้าสู่ระบบ · ใส่รหัสเฉพาะตอนเพิ่ม/แก้ไข/ลบ</span>'}
    </div>
  </section>

  <form class="filters card" method="get" action="/">
    <input type="search" name="q" placeholder="ค้นหาชื่อเรื่อง / ชื่อครู" value="${escapeHtml(filters.q || '')}">
    <select name="work_type"><option value="">ทุกประเภท</option>${typeOptions}</select>
    <select name="subject_area"><option value="">ทุกกลุ่มสาระ</option>${subjectOptions}</select>
    <select name="academic_year"><option value="">ทุกปีการศึกษา</option>${yearOptions}</select>
    <select name="certified">
      <option value="">ทุกสถานะ</option>
      <option value="yes" ${filters.certified === 'yes' ? 'selected' : ''}>รับรองแล้ว</option>
      <option value="no" ${filters.certified === 'no' ? 'selected' : ''}>ยังไม่ได้รับรอง</option>
    </select>
    <button class="btn secondary" type="submit">ค้นหา</button>
    ${Object.values(filters).some(Boolean) ? '<a class="linkbtn" href="/">ล้างตัวกรอง</a>' : ''}
  </form>

  ${
    works.length === 0
      ? `<div class="card empty"><p>ยังไม่มีผลงานที่ตรงกับเงื่อนไข</p><a class="btn" href="/works/new">ส่งผลงานชิ้นแรก</a></div>`
      : `<div class="workgrid">${works.map(workCard).join('')}</div>
         <p class="hint center">แสดง ${works.length} ผลงาน · อัปเดตล่าสุด ${escapeHtml(thaiShortDate(works[0].updated_at))}</p>`
  }`;

  return layout({ title: 'ผลงานทั้งหมด', body, flash, canEdit, csrfToken, activePath: '/' });
}

module.exports = { galleryPage };
