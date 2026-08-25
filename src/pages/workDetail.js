const { layout, escapeHtml, nl2br, safeUrl, csrfField, typeBadge, certifiedBadge } = require('../lib/render');
const { DETAIL_FIELDS } = require('../lib/fields');
const { WORK_TYPES, SCHOOL_NAME } = require('../lib/config');
const { thumbnailUrl } = require('../lib/driveLink');
const { mediaTypeLabel, mediaTypeIcon } = require('../lib/mediaLink');
const { isSignatureDataUri } = require('../lib/signatureImage');
const { thaiDate, thaiDateTime } = require('../lib/thaiDate');

function embedFrame(url, { title, ratio = 'ratio-16x9' }) {
  const safe = safeUrl(url);
  if (!safe) return '';
  return `<div class="embed ${ratio}">
    <iframe src="${escapeHtml(safe)}" title="${escapeHtml(title)}" loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      referrerpolicy="no-referrer" allowfullscreen></iframe>
  </div>`;
}

function driveSection(links) {
  if (!links.length) return '';
  const items = links
    .map((link) => {
      const open = safeUrl(link.url);
      const preview = safeUrl(link.embed_url);
      return `<article class="linkcard">
        <div class="linkcard-head">
          <div>
            <h3>📁 ${escapeHtml(link.label || 'ไฟล์ผลงาน')}</h3>
            <div class="hint break">${escapeHtml(link.url)}</div>
          </div>
          ${open ? `<a class="btn" href="${escapeHtml(open)}" target="_blank" rel="noopener noreferrer">เปิดใน Google Drive ↗</a>` : ''}
        </div>
        ${
          preview
            ? `<details class="preview"><summary>ดูตัวอย่างในหน้านี้</summary>${embedFrame(preview, {
                title: link.label || 'ตัวอย่างไฟล์',
                ratio: 'ratio-doc',
              })}<p class="hint">หากขึ้นว่าไม่มีสิทธิ์เข้าถึง แปลว่าเจ้าของยังไม่ได้ตั้งค่าแชร์เป็น "ผู้ที่มีลิงก์"</p></details>`
            : ''
        }
      </article>`;
    })
    .join('');
  return `<section class="card">
    <h2>ผลงานฉบับเต็มบน Google Drive</h2>
    ${items}
  </section>`;
}

function infographicSection(links) {
  if (!links.length) return '';
  const items = links
    .map((link) => {
      const image = safeUrl(thumbnailUrl(link.file_id));
      const open = safeUrl(link.url);
      return `<figure class="infographic">
        ${
          image
            ? `<a href="${escapeHtml(open || image)}" target="_blank" rel="noopener noreferrer">
                 <img src="${escapeHtml(image)}" alt="${escapeHtml(link.label || 'อินโฟกราฟิก')}" loading="lazy" referrerpolicy="no-referrer"
                      data-fallback="ยังเปิดรูปนี้ไม่ได้ — เจ้าของยังไม่ได้ตั้งค่าแชร์ไฟล์เป็นสาธารณะ">
               </a>`
            : ''
        }
        <figcaption>${escapeHtml(link.label || 'อินโฟกราฟิก')}${
          open ? ` · <a href="${escapeHtml(open)}" target="_blank" rel="noopener noreferrer">เปิดรูปเต็ม ↗</a>` : ''
        }</figcaption>
      </figure>`;
    })
    .join('');
  return `<section class="card">
    <h2>อินโฟกราฟิก</h2>
    <div class="infographic-grid">${items}</div>
  </section>`;
}

function mediaSection(links) {
  if (!links.length) return '';
  const items = links
    .map((link) => {
      const open = safeUrl(link.url);
      const embed = safeUrl(link.embed_url);
      const ratio = link.media_type === 'video' ? 'ratio-16x9' : 'ratio-4x3';
      return `<article class="linkcard">
        <div class="linkcard-head">
          <div>
            <h3>${mediaTypeIcon(link.media_type)} ${escapeHtml(link.label || mediaTypeLabel(link.media_type))}</h3>
            <div class="hint">${escapeHtml(mediaTypeLabel(link.media_type))}</div>
          </div>
          ${open ? `<a class="btn ${embed ? 'secondary' : ''}" href="${escapeHtml(open)}" target="_blank" rel="noopener noreferrer">${
            link.media_type === 'game' ? 'เปิดเล่นเต็มจอ ↗' : 'เปิดในแท็บใหม่ ↗'
          }</a>` : ''}
        </div>
        ${
          embed
            ? embedFrame(embed, { title: link.label || mediaTypeLabel(link.media_type), ratio })
            : '<p class="hint">สื่อนี้ผู้ให้บริการไม่อนุญาตให้ฝังในหน้าอื่น กดปุ่มด้านบนเพื่อเปิดดู/เล่นได้ทันที</p>'
        }
      </article>`;
    })
    .join('');
  return `<section class="card">
    <h2>สื่อและผลงานที่เล่น/ชมได้ทันที</h2>
    ${items}
  </section>`;
}

function detailSection(work) {
  const filled = DETAIL_FIELDS.filter((f) => work[f.key]);
  if (!filled.length) return '';
  return `<section class="card">
    <h2>รายละเอียดผลงาน</h2>
    ${filled
      .map((f) => `<div class="field"><label>${escapeHtml(f.label)}</label><div class="readonly-field">${nl2br(work[f.key])}</div></div>`)
      .join('')}
  </section>`;
}

function certificationSection(work) {
  if (!work.certified_at) {
    return `<section class="card">
      <h2>การรับรองของผู้อำนวยการ</h2>
      <p class="hint">ผลงานนี้ยังไม่ได้รับการรับรอง</p>
    </section>`;
  }
  const signature = isSignatureDataUri(work.certify_signature) ? work.certify_signature : null;
  return `<section class="card certified-card">
    <h2>การรับรองของผู้อำนวยการ</h2>
    <div class="certify-row">
      <div>
        <p>ผลงานนี้ได้รับการตรวจสอบและรับรองแล้ว เมื่อ <strong>${escapeHtml(thaiDate(work.certified_at))}</strong></p>
        ${work.doc_number ? `<p class="hint">เลขที่เอกสารรับรอง: ${escapeHtml(work.doc_number)}</p>` : ''}
        ${work.certify_note ? `<p>ความเห็น: ${escapeHtml(work.certify_note)}</p>` : ''}
      </div>
      <div class="signature-block">
        ${signature ? `<img class="signature-img" src="${escapeHtml(signature)}" alt="ลายเซ็นผู้อำนวยการ">` : ''}
        <div class="sig-name">(${escapeHtml(work.certifier_name || '-')})</div>
        <div class="sig-role">${escapeHtml(work.certifier_position || 'ผู้อำนวยการโรงเรียน')}</div>
      </div>
    </div>
    <a class="btn" href="/works/${work.id}/certificate" target="_blank">🖨️ พิมพ์หน้ารับรอง (A4)</a>
  </section>`;
}

function certifyForm({ work, csrfToken, savedSignature, directorName, directorPosition }) {
  const hasSaved = isSignatureDataUri(savedSignature);
  return `<section class="card edit-card">
    <h2>${work.certified_at ? 'แก้ไข/ยกเลิกการรับรอง' : 'รับรองผลงาน (สำหรับผู้อำนวยการ)'}</h2>
    <form method="post" action="/works/${work.id}/certify" enctype="multipart/form-data">
      ${csrfField(csrfToken)}
      <div class="grid-2">
        <div class="field">
          <label>ชื่อ-สกุล ผู้รับรอง</label>
          <input type="text" name="certifier_name" value="${escapeHtml(work.certifier_name || directorName || '')}" required>
        </div>
        <div class="field">
          <label>ตำแหน่ง</label>
          <input type="text" name="certifier_position" value="${escapeHtml(
            work.certifier_position || directorPosition || `ผู้อำนวยการ${SCHOOL_NAME}`
          )}" required>
        </div>
      </div>
      <div class="field">
        <label>ความเห็นประกอบการรับรอง (ถ้ามี)</label>
        <textarea name="certify_note" rows="2">${escapeHtml(work.certify_note || '')}</textarea>
      </div>
      <div class="field">
        <label>ลายเซ็นที่ใช้รับรอง</label>
        ${
          hasSaved
            ? `<label class="radio-row"><input type="radio" name="signature_source" value="saved" checked>
                 ใช้ลายเซ็นที่บันทึกไว้ <img class="signature-thumb" src="${escapeHtml(savedSignature)}" alt="ลายเซ็นที่บันทึกไว้">
               </label>`
            : '<p class="hint">ยังไม่มีลายเซ็นที่บันทึกไว้ — อัปโหลดรูปลายเซ็นด้านล่าง หรือไปบันทึกไว้ครั้งเดียวที่หน้า "จัดการระบบ"</p>'
        }
        <label class="radio-row"><input type="radio" name="signature_source" value="upload" ${hasSaved ? '' : 'checked'}>
          อัปโหลดรูปลายเซ็นใหม่ (PNG/JPG/WebP ไม่เกิน 1 MB)
        </label>
        <input type="file" name="signature_file" accept="image/png,image/jpeg,image/webp">
        <p class="hint">แนะนำให้เซ็นบนกระดาษขาว ถ่ายรูป แล้วลบพื้นหลังให้เป็นไฟล์ PNG พื้นโปร่งใส จะได้ลายเซ็นที่คมชัดบนหน้ารับรอง</p>
      </div>
      <div class="actions">
        <button class="btn" type="submit">${work.certified_at ? 'บันทึกการรับรองใหม่' : '✓ ลงนามรับรองผลงานนี้'}</button>
      </div>
    </form>
    ${
      work.certified_at
        ? `<form method="post" action="/works/${work.id}/uncertify" data-confirm="ยืนยันยกเลิกการรับรองผลงานนี้?">
             ${csrfField(csrfToken)}
             <button class="linkbtn danger" type="submit">ยกเลิกการรับรอง</button>
           </form>`
        : ''
    }
  </section>`;
}

function workDetailPage({ work, links, flash, canEdit, csrfToken, savedSignature, directorName, directorPosition }) {
  const meta = [
    work.author_position,
    work.subject_area,
    work.grade_level,
    work.term ? `ภาคเรียนที่ ${work.term}` : '',
    work.academic_year ? `ปีการศึกษา ${work.academic_year}` : '',
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');

  const editBar = canEdit
    ? `<div class="actions edit-bar">
        <a class="btn secondary" href="/works/${work.id}/edit">✏️ แก้ไขผลงาน</a>
        <form method="post" action="/works/${work.id}/archive" data-confirm="ย้ายผลงานนี้ไปถังขยะ? (กู้คืนได้ที่หน้าจัดการระบบ)">
          ${csrfField(csrfToken)}
          <button class="btn danger" type="submit">🗑️ ลบ (ย้ายไปถังขยะ)</button>
        </form>
      </div>`
    : `<div class="actions edit-bar"><a class="btn secondary" href="/unlock?next=${encodeURIComponent(
        `/works/${work.id}`
      )}">🔒 ใส่รหัสเพื่อแก้ไขผลงานนี้</a></div>`;

  const body = `
  <article class="workhead">
    <div class="card-badges">${typeBadge(work.work_type)} ${certifiedBadge(work)}</div>
    <h1>${escapeHtml(work.title)}</h1>
    <p class="byline">โดย <strong>${escapeHtml(work.author_name)}</strong></p>
    ${meta ? `<p class="hint">${meta}</p>` : ''}
    <p class="hint">เผยแพร่เมื่อ ${escapeHtml(thaiDateTime(work.created_at))}</p>
  </article>

  ${work.status === 'archived' ? '<div class="flash flash-error">ผลงานนี้อยู่ในถังขยะ ผู้ชมทั่วไปจะไม่เห็น — กู้คืนได้ที่หน้าจัดการระบบ</div>' : ''}

  ${driveSection(links.drive)}
  ${infographicSection(links.infographic)}
  ${mediaSection(links.media)}
  ${detailSection(work)}
  ${certificationSection(work)}
  ${editBar}
  ${canEdit ? certifyForm({ work, csrfToken, savedSignature, directorName, directorPosition }) : ''}
  ${canEdit ? `<p class="center"><a class="linkbtn" href="/works/${work.id}/history">ดูประวัติการแก้ไขทั้งหมด</a></p>` : ''}
  `;

  return layout({
    title: work.title,
    body,
    flash,
    canEdit,
    csrfToken,
    activePath: `/?work_type=${work.work_type}`,
  });
}

module.exports = { workDetailPage, WORK_TYPES };
