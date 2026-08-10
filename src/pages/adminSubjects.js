const { layout, escapeHtml, csrfField } = require('../lib/render');

function adminSubjectsPage({ user, subjects, flash, csrfToken }) {
  const rows = subjects
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td>
          <form method="post" action="/admin/subjects/${s.id}/delete" data-confirm="ลบกลุ่มสาระ &quot;${escapeHtml(s.name)}&quot; ใช่หรือไม่?" style="display:inline">
            ${csrfField(csrfToken)}
            <button class="linkbtn" type="submit">ลบ</button>
          </form>
        </td>
      </tr>`
    )
    .join('');

  const body = `
  <h1>จัดการกลุ่มสาระการเรียนรู้</h1>
  <p class="hint">รายชื่อนี้ใช้เป็นตัวเลือกในฟอร์มรายงานและการกำหนดกลุ่มสาระของผู้ใช้ เพื่อให้ข้อความตรงกันเป๊ะ งานจึงไปเข้าคิวของหัวหน้าสาระที่ถูกต้องเสมอ</p>
  <div class="card">
    <h2>เพิ่มกลุ่มสาระใหม่</h2>
    <form method="post" action="/admin/subjects">
      ${csrfField(csrfToken)}
      <div class="field">
        <label>ชื่อกลุ่มสาระ</label>
        <input type="text" name="name" required>
      </div>
      <button class="btn" type="submit">เพิ่ม</button>
    </form>
  </div>
  <div class="card">
    <h2>รายชื่อกลุ่มสาระ</h2>
    ${subjects.length === 0 ? '<p class="hint">ยังไม่มีกลุ่มสาระ</p>' : `<table><thead><tr><th>ชื่อ</th><th></th></tr></thead><tbody>${rows}</tbody></table>`}
  </div>`;

  return layout({ title: 'จัดการกลุ่มสาระ', user, csrfToken, body, flash });
}

module.exports = { adminSubjectsPage };
