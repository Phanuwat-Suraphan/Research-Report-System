const { layout, escapeHtml, csrfField } = require('../lib/render');
const { ACTION_LABELS } = require('../lib/revisions');
const { thaiDateTime } = require('../lib/thaiDate');

// Every stored version of one work, newest first, each restorable.
function historyPage({ work, revisions, canEdit, csrfToken, flash }) {
  const rows = revisions.length
    ? revisions
        .map(
          (r) => `<tr>
            <td>${escapeHtml(ACTION_LABELS[r.action] || r.action)}</td>
            <td>${escapeHtml(thaiDateTime(r.saved_at))}</td>
            <td class="hint">${escapeHtml(r.ip_address || '-')}</td>
            <td class="right">
              <form method="post" action="/works/${work.id}/restore-revision" data-confirm="ย้อนผลงานกลับไปเป็นเวอร์ชันนี้?">
                ${csrfField(csrfToken)}
                <input type="hidden" name="revision_id" value="${r.id}">
                <button class="linkbtn" type="submit">ย้อนกลับไปเวอร์ชันนี้</button>
              </form>
            </td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="hint">ยังไม่มีการแก้ไข</td></tr>';

  const body = `
  <h1>ประวัติการแก้ไข</h1>
  <p><a href="/works/${work.id}">← ${escapeHtml(work.title)}</a></p>
  <div class="card">
    <p class="hint">ทุกครั้งที่มีการแก้ไข ลบ หรือรับรอง ระบบจะเก็บสำเนาของเวอร์ชันก่อนหน้าไว้ทั้งหมด เลือกย้อนกลับได้ทุกเวอร์ชัน และการย้อนกลับเองก็ถูกบันทึกไว้เช่นกัน</p>
    <table>
      <thead><tr><th>การกระทำ</th><th>เมื่อ</th><th>IP</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;

  return layout({ title: `ประวัติ — ${work.title}`, body, flash, canEdit, csrfToken });
}

module.exports = { historyPage };
