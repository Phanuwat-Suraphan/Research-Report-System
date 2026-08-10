const { layout, csrfField } = require('../lib/render');

function changePasswordPage({ user, flash, csrfToken }) {
  const body = `
  <h1>เปลี่ยนรหัสผ่าน</h1>
  <div class="card" style="max-width:420px">
    <form method="post" action="/account/password">
      ${csrfField(csrfToken)}
      <div class="field">
        <label>รหัสผ่านปัจจุบัน</label>
        <input type="password" name="current_password" required>
      </div>
      <div class="field">
        <label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
        <input type="password" name="new_password" minlength="8" required>
      </div>
      <div class="field">
        <label>ยืนยันรหัสผ่านใหม่</label>
        <input type="password" name="confirm_password" minlength="8" required>
      </div>
      <button class="btn block" type="submit">บันทึกรหัสผ่านใหม่</button>
    </form>
  </div>`;

  return layout({ title: 'เปลี่ยนรหัสผ่าน', user, csrfToken, body, flash });
}

module.exports = { changePasswordPage };
