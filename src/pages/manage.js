const { layout, escapeHtml, csrfField } = require('../lib/render');
const { SCHOOL_NAME } = require('../lib/config');
const { isSignatureDataUri, MAX_BYTES } = require('../lib/signatureImage');
const { thaiDateTime } = require('../lib/thaiDate');

const AUDIT_LABELS = {
  unlock: 'ปลดล็อกด้วยรหัส',
  unlock_failed: 'ใส่รหัสผิด',
  create: 'เพิ่มผลงานใหม่',
  update: 'แก้ไขผลงาน',
  archive: 'ย้ายผลงานไปถังขยะ',
  restore: 'กู้คืนผลงาน',
  rollback: 'ย้อนกลับเวอร์ชัน',
  certify: 'ผู้อำนวยการรับรองผลงาน',
  uncertify: 'ยกเลิกการรับรอง',
  signature_saved: 'บันทึกลายเซ็นผู้อำนวยการ',
  signature_deleted: 'ลบลายเซ็นผู้อำนวยการ',
  passcode_changed: 'เปลี่ยนรหัสผ่าน',
  backup_created: 'สร้างไฟล์สำรอง',
  backup_downloaded: 'ดาวน์โหลดไฟล์สำรอง',
};

function bytes(n) {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function lockedNotice() {
  return `<div class="narrow">
    <div class="card">
      <h1>จัดการระบบ</h1>
      <p>หน้านี้ใช้สำหรับตั้งค่าลายเซ็นผู้อำนวยการ กลุ่มสาระ รหัสผ่าน ถังขยะ และไฟล์สำรอง</p>
      <p class="hint">ต้องใส่รหัสก่อนจึงจะเข้าใช้งานได้</p>
      <a class="btn" href="/unlock?next=%2Fmanage">🔒 ใส่รหัสเพื่อเข้าจัดการระบบ</a>
    </div>
  </div>`;
}

function managePage({
  canEdit,
  csrfToken,
  flash,
  signature,
  directorName,
  directorPosition,
  subjects = [],
  archived = [],
  snapshots = [],
  auditRows = [],
  passcodeIsDefault,
}) {
  if (!canEdit) {
    return layout({ title: 'จัดการระบบ', body: lockedNotice(), flash, canEdit, csrfToken, activePath: '/manage' });
  }

  const hasSignature = isSignatureDataUri(signature);

  const subjectRows = subjects
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td class="right">
          <form method="post" action="/manage/subjects/${s.id}/delete" data-confirm="ลบกลุ่มสาระ ${escapeHtml(s.name)}?">
            ${csrfField(csrfToken)}<button class="linkbtn danger" type="submit">ลบ</button>
          </form>
        </td>
      </tr>`
    )
    .join('');

  const archivedRows = archived.length
    ? archived
        .map(
          (w) => `<tr>
            <td><a href="/works/${w.id}">${escapeHtml(w.title)}</a><div class="hint">${escapeHtml(w.author_name)}</div></td>
            <td>${escapeHtml(thaiDateTime(w.archived_at))}</td>
            <td class="right">
              <form method="post" action="/works/${w.id}/restore">${csrfField(csrfToken)}<button class="linkbtn" type="submit">กู้คืน</button></form>
            </td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="3" class="hint">ถังขยะว่าง</td></tr>';

  const snapshotRows = snapshots.length
    ? snapshots
        .slice(0, 10)
        .map(
          (s) => `<tr><td>${escapeHtml(s.name)}</td><td>${bytes(s.size)}</td><td>${escapeHtml(thaiDateTime(s.modified))}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3" class="hint">ยังไม่มีไฟล์สำรอง</td></tr>';

  const auditHtml = auditRows.length
    ? `<ul class="timeline">${auditRows
        .map(
          (a) => `<li>
            <strong>${escapeHtml(AUDIT_LABELS[a.action] || a.action)}</strong>${a.work_id ? ` · ผลงาน #${a.work_id}` : ''}
            <div class="meta">${escapeHtml(thaiDateTime(a.at))} · IP ${escapeHtml(a.ip_address || '-')}${
            a.detail ? ` · ${escapeHtml(a.detail)}` : ''
          }</div>
          </li>`
        )
        .join('')}</ul>`
    : '<p class="hint">ยังไม่มีบันทึกการใช้งาน</p>';

  const body = `
  <h1>จัดการระบบ</h1>
  ${
    passcodeIsDefault
      ? '<div class="flash flash-info">ขณะนี้ยังใช้รหัสเริ่มต้น <code>123456</code> อยู่ — เว็บนี้เปิดสาธารณะ แนะนำให้เปลี่ยนรหัสเป็นรหัสที่เฉพาะคณะครูทราบ</div>'
      : ''
  }

  <section class="card">
    <h2>ลายเซ็นผู้อำนวยการ (ใช้รับรองผลงาน)</h2>
    <p class="hint">อัปโหลดครั้งเดียว แล้วนำไปใช้รับรองผลงานได้ทุกชิ้นโดยไม่ต้องอัปโหลดซ้ำ ระบบเก็บรูปไว้ในฐานข้อมูล จึงไม่หายเมื่อเซิร์ฟเวอร์รีสตาร์ต</p>
    ${
      hasSignature
        ? `<div class="signature-preview"><img class="signature-img" src="${escapeHtml(signature)}" alt="ลายเซ็นที่บันทึกไว้"></div>`
        : '<p class="hint">ยังไม่ได้บันทึกลายเซ็น</p>'
    }
    <form method="post" action="/manage/signature" enctype="multipart/form-data">
      ${csrfField(csrfToken)}
      <div class="grid-2">
        <div class="field">
          <label>ชื่อ-สกุล ผู้อำนวยการ</label>
          <input type="text" name="director_name" value="${escapeHtml(directorName || '')}" placeholder="เช่น นายสมชาย รักเรียน">
        </div>
        <div class="field">
          <label>ตำแหน่ง</label>
          <input type="text" name="director_position" value="${escapeHtml(
            directorPosition || `ผู้อำนวยการ${SCHOOL_NAME}`
          )}">
        </div>
      </div>
      <div class="field">
        <label>ไฟล์รูปลายเซ็น (PNG/JPG/WebP ไม่เกิน ${Math.round(MAX_BYTES / 1024)} KB)</label>
        <input type="file" name="signature_file" accept="image/png,image/jpeg,image/webp">
        <p class="hint">เซ็นบนกระดาษขาว ถ่ายรูป แล้วบันทึกเป็น PNG พื้นโปร่งใสจะได้ผลดีที่สุด</p>
      </div>
      <button class="btn" type="submit">บันทึกลายเซ็นและชื่อ</button>
    </form>
    ${
      hasSignature
        ? `<form method="post" action="/manage/signature/delete" data-confirm="ลบลายเซ็นที่บันทึกไว้? (ผลงานที่รับรองไปแล้วจะไม่ได้รับผลกระทบ)">
             ${csrfField(csrfToken)}<button class="linkbtn danger" type="submit">ลบลายเซ็นที่บันทึกไว้</button>
           </form>`
        : ''
    }
  </section>

  <section class="card">
    <h2>รหัสผ่านสำหรับแก้ไข</h2>
    <form method="post" action="/manage/passcode">
      ${csrfField(csrfToken)}
      <div class="grid-2">
        <div class="field"><label>รหัสใหม่ (อย่างน้อย 4 ตัวอักษร)</label><input type="text" name="passcode" required minlength="4"></div>
        <div class="field"><label>ยืนยันรหัสใหม่</label><input type="text" name="passcode_confirm" required minlength="4"></div>
      </div>
      <button class="btn" type="submit">เปลี่ยนรหัส</button>
      <p class="hint">เมื่อเปลี่ยนรหัส ผู้ที่ปลดล็อกค้างไว้ทุกเครื่องจะถูกล็อกทันที</p>
    </form>
  </section>

  <section class="card">
    <h2>กลุ่มสาระการเรียนรู้</h2>
    <form class="inline-form" method="post" action="/manage/subjects">
      ${csrfField(csrfToken)}
      <input type="text" name="name" placeholder="ชื่อกลุ่มสาระ" required>
      <button class="btn secondary" type="submit">เพิ่ม</button>
    </form>
    <table><tbody>${subjectRows}</tbody></table>
  </section>

  <section class="card">
    <h2>ถังขยะ (กู้คืนได้)</h2>
    <p class="hint">การลบผลงานเป็นการย้ายมาที่นี่เท่านั้น ข้อมูลจริงยังอยู่ครบและกู้คืนได้ตลอดเวลา</p>
    <table>
      <thead><tr><th>ผลงาน</th><th>ลบเมื่อ</th><th></th></tr></thead>
      <tbody>${archivedRows}</tbody>
    </table>
  </section>

  <section class="card">
    <h2>ไฟล์สำรองข้อมูล</h2>
    <p class="hint">ระบบสำรองฐานข้อมูลอัตโนมัติวันละครั้ง และเก็บย้อนหลังไว้หลายชุด กดปุ่มด้านล่างเพื่อดาวน์โหลดไฟล์สำรองล่าสุดเก็บไว้นอกเซิร์ฟเวอร์ (แนะนำให้ทำอย่างน้อยภาคเรียนละครั้ง)</p>
    <div class="actions">
      <a class="btn" href="/manage/backup/download">⬇️ ดาวน์โหลดไฟล์สำรองตอนนี้</a>
      <form method="post" action="/manage/backup">${csrfField(csrfToken)}<button class="btn secondary" type="submit">สร้างไฟล์สำรองใหม่</button></form>
    </div>
    <table>
      <thead><tr><th>ไฟล์</th><th>ขนาด</th><th>เมื่อ</th></tr></thead>
      <tbody>${snapshotRows}</tbody>
    </table>
  </section>

  <section class="card">
    <h2>บันทึกการใช้งานล่าสุด</h2>
    ${auditHtml}
  </section>`;

  return layout({ title: 'จัดการระบบ', body, flash, canEdit, csrfToken, activePath: '/manage' });
}

module.exports = { managePage };
