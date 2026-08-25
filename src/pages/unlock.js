const { layout, escapeHtml, csrfField } = require('../lib/render');
const { SCHOOL_NAME } = require('../lib/config');

// The site is fully public to read; this page only appears when someone wants
// to add, edit, delete or certify.
function unlockPage({ flash, next = '/', canEdit = false, csrfToken }) {
  const body = `
  <div class="narrow">
    <div class="card">
      <h1>🔒 ใส่รหัสเพื่อแก้ไข</h1>
      <p class="hint">การเข้าชมผลงานไม่ต้องใช้รหัส — ใส่รหัสเฉพาะเมื่อต้องการ <strong>เพิ่ม แก้ไข ลบ หรือรับรอง</strong> ผลงานของ${escapeHtml(
        SCHOOL_NAME
      )}</p>
      <form method="post" action="/unlock">
        ${csrfField(csrfToken)}
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <div class="field">
          <label for="passcode">รหัสผ่าน</label>
          <input type="password" id="passcode" name="passcode" inputmode="numeric" autocomplete="current-password" required autofocus>
        </div>
        <button class="btn block" type="submit">ปลดล็อก</button>
      </form>
      <p class="hint">รหัสเริ่มต้นของระบบคือ <code>123456</code> — เปลี่ยนได้ที่หน้า "จัดการระบบ" หลังปลดล็อก</p>
    </div>
  </div>`;
  return layout({ title: 'ใส่รหัสเพื่อแก้ไข', body, flash, canEdit, csrfToken, activePath: '' });
}

module.exports = { unlockPage };
