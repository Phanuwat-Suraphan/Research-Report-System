const { layout, escapeHtml } = require('../lib/render');

function loginPage({ flash, email = '' }) {
  const body = `
  <div class="login-wrap">
    <div class="card">
      <h1>เข้าสู่ระบบ</h1>
      <form method="post" action="/login">
        <div class="field">
          <label for="email">อีเมล</label>
          <input type="email" id="email" name="email" value="${escapeHtml(email)}" required autofocus>
        </div>
        <div class="field">
          <label for="password">รหัสผ่าน</label>
          <input type="password" id="password" name="password" required>
        </div>
        <button class="btn block" type="submit">เข้าสู่ระบบ</button>
      </form>
      <div class="demo-accounts">
        <p>บัญชีทดลองใช้งาน (สร้างโดย <code>npm run seed</code>):</p>
        <table>
          <tr><th>บทบาท</th><th>อีเมล</th><th>รหัสผ่าน</th></tr>
          <tr><td>ครู</td><td>teacher@school.ac.th</td><td>teacher123</td></tr>
          <tr><td>หัวหน้าสาระ</td><td>head@school.ac.th</td><td>head1234</td></tr>
          <tr><td>ฝ่ายวิชาการ</td><td>academic@school.ac.th</td><td>academic123</td></tr>
          <tr><td>ผู้อำนวยการ</td><td>director@school.ac.th</td><td>director123</td></tr>
          <tr><td>ผู้ดูแลระบบ</td><td>admin@school.ac.th</td><td>admin1234</td></tr>
        </table>
      </div>
    </div>
  </div>`;
  return layout({ title: 'เข้าสู่ระบบ', user: null, body, flash });
}

module.exports = { loginPage };
