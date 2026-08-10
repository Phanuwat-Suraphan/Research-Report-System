const { layout, escapeHtml, csrfField } = require('../lib/render');
const { ROLE_LABELS } = require('../lib/auth');

function adminUsersPage({ user, users, subjects = [], flash, csrfToken }) {
  const rows = users
    .map(
      (u) => `<tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(ROLE_LABELS[u.role] || u.role)}</td>
        <td>${escapeHtml(u.subject_group || '-')}</td>
      </tr>`
    )
    .join('');

  const roleOptions = Object.entries(ROLE_LABELS)
    .map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`)
    .join('');

  const subjectOptions = subjects.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');

  const body = `
  <h1>จัดการผู้ใช้</h1>
  <div class="card">
    <h2>เพิ่มผู้ใช้ใหม่</h2>
    <form method="post" action="/admin/users">
      ${csrfField(csrfToken)}
      <div class="grid-2">
        <div class="field"><label>ชื่อ-นามสกุล</label><input type="text" name="name" required></div>
        <div class="field"><label>อีเมล</label><input type="email" name="email" required></div>
        <div class="field"><label>บทบาท</label><select name="role" required>${roleOptions}</select></div>
        <div class="field">
          <label>กลุ่มสาระ (สำหรับครู/หัวหน้าสาระ)</label>
          <select name="subject_group"><option value="">— ไม่ระบุ —</option>${subjectOptions}</select>
        </div>
        <div class="field"><label>รหัสผ่านเริ่มต้น</label><input type="text" name="password" required></div>
      </div>
      <button class="btn" type="submit">เพิ่มผู้ใช้</button>
    </form>
  </div>
  <div class="card">
    <h2>รายชื่อผู้ใช้ทั้งหมด</h2>
    <table>
      <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>กลุ่มสาระ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;

  return layout({ title: 'จัดการผู้ใช้', user, csrfToken, body, flash });
}

module.exports = { adminUsersPage };
