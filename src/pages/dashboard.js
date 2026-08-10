const { layout, escapeHtml } = require('../lib/render');
const { STATUS_LABELS } = require('../lib/status');
const { ROLE_LABELS } = require('../lib/auth');

function statusBadge(status) {
  return `<span class="badge badge-${status}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

function dashboardPage({ user, reports, filters, flash }) {
  const rows = reports
    .map(
      (r) => `<tr>
        <td><a href="/reports/${r.id}">${escapeHtml(r.title)}</a></td>
        <td>${escapeHtml(r.subject_area)}</td>
        <td>${escapeHtml(r.grade_level || '-')}</td>
        <td>${escapeHtml(r.academic_year || '-')}</td>
        <td>${escapeHtml(r.teacher_name || '-')}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${r.submitted_at ? escapeHtml(r.submitted_at) : '-'}</td>
      </tr>`
    )
    .join('');

  const f = filters || {};
  const body = `
  <h1>แดชบอร์ด — ${escapeHtml(ROLE_LABELS[user.role])}</h1>
  <div class="card">
    <form class="filters" method="get" action="/">
      <input type="text" name="q" placeholder="ค้นหาชื่อเรื่อง" value="${escapeHtml(f.q || '')}">
      <input type="text" name="subject_area" placeholder="กลุ่มสาระ" value="${escapeHtml(f.subject_area || '')}">
      <input type="text" name="grade_level" placeholder="ระดับชั้น" value="${escapeHtml(f.grade_level || '')}">
      <input type="text" name="academic_year" placeholder="ปีการศึกษา" value="${escapeHtml(f.academic_year || '')}">
      <select name="status">
        <option value="">ทุกสถานะ</option>
        ${Object.entries(STATUS_LABELS)
          .map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${escapeHtml(v)}</option>`)
          .join('')}
      </select>
      <button class="btn secondary" type="submit">ค้นหา</button>
    </form>
  </div>
  <div class="card">
    ${reports.length === 0 ? '<p>ไม่พบรายงาน</p>' : `
    <table>
      <thead><tr><th>ชื่อเรื่อง</th><th>กลุ่มสาระ</th><th>ชั้น</th><th>ปีการศึกษา</th><th>ผู้จัดทำ</th><th>สถานะ</th><th>วันที่ส่ง</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`}
  </div>`;

  return layout({ title: 'แดชบอร์ด', user, body, flash });
}

module.exports = { dashboardPage, statusBadge };
