// End-to-end smoke test. Boots a real server against a throwaway database and
// walks the paths a visitor, a teacher and the director actually take.
//
//   node scripts/smoke-test.js
//
// Exits non-zero on the first failure.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3400 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rrs-smoke-'));

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let passed = 0;
const failures = [];

function check(label, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label} ${extra}`);
  }
}

let cookie = '';

async function req(method, urlPath, { body, headers = {}, useCookie = true, redirect = 'manual' } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    body,
    redirect,
    headers: { ...(useCookie && cookie ? { cookie } : {}), ...headers },
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = res.headers.get('content-type')?.includes('octet-stream') ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location'), text, headers: res.headers };
}

function form(pairs) {
  const params = new URLSearchParams();
  for (const [k, v] of pairs) params.append(k, v);
  return {
    body: params.toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  };
}

function multipart(fields, file) {
  const boundary = '----smoke' + Date.now();
  const chunks = [];
  for (const [name, value] of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`
      ),
      file.data,
      Buffer.from('\r\n')
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

function csrfFrom(html) {
  const match = /name="_csrf" value="([^"]+)"/.exec(html);
  return match ? match[1] : '';
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(BASE, { redirect: 'manual' });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return false;
}

async function run() {
  console.log('\n▶ หน้าสาธารณะ (ไม่ต้องใส่รหัส)');
  let res = await req('GET', '/', { useCookie: false });
  check('หน้าแรกเปิดได้โดยไม่ต้องเข้าสู่ระบบ', res.status === 200 && res.text.includes('ผลงานวิจัยและนวัตกรรมของครู'), res.status);
  check('หน้าแรกแสดงชื่อโรงเรียน', res.text.includes('โรงเรียนเจ้าพ่อหลวงอุปถัมภ์ ๑'));
  check('หน้าแรกที่ยังไม่ปลดล็อกแสดงปุ่มใส่รหัส', res.text.includes('ใส่รหัสเพื่อแก้ไข'));

  res = await req('GET', '/works/new', { useCookie: false });
  check('เข้าหน้าส่งผลงานขณะล็อกอยู่ ถูกพาไปหน้าใส่รหัส', res.status === 302 && res.location.startsWith('/unlock'), res.status);

  console.log('\n▶ ประตูรหัสผ่าน');
  res = await req('POST', '/unlock', { ...form([['passcode', '999999'], ['next', '/']]), useCookie: false });
  check('รหัสผิดถูกปฏิเสธ', res.status === 401 && res.text.includes('รหัสไม่ถูกต้อง'), res.status);

  res = await req('POST', '/unlock', { ...form([['passcode', '123456'], ['next', '/']]), useCookie: false });
  check('รหัส 123456 ปลดล็อกได้', res.status === 302 && !!cookie, `${res.status} cookie=${cookie}`);

  res = await req('GET', '/works/new');
  const createCsrf = csrfFrom(res.text);
  check('เข้าหน้าส่งผลงานได้หลังปลดล็อก', res.status === 200 && res.text.includes('ส่งผลงานวิจัย'), res.status);
  check('ฟอร์มมี CSRF token', createCsrf.length > 10);
  check('ฟอร์มมีช่องอินโฟกราฟิก', res.text.includes('อินโฟกราฟิก'));
  check('ฟอร์มมีช่องสื่อ YouTube/เกม/เว็บ', res.text.includes('เกม / สื่อโต้ตอบ'));

  console.log('\n▶ ตรวจสอบข้อมูลก่อนบันทึก');
  res = await req('POST', '/works', form([['_csrf', createCsrf], ['title', 'ไม่มีลิงก์'], ['author_name', 'ครูทดสอบ']]));
  check('ปฏิเสธเมื่อไม่มีลิงก์ Google Drive', res.status === 400 && res.text.includes('อย่างน้อย 1 ลิงก์'), res.status);

  res = await req(
    'POST',
    '/works',
    form([
      ['_csrf', createCsrf],
      ['title', 'ลิงก์ผิด'],
      ['author_name', 'ครูทดสอบ'],
      ['drive_url', 'https://www.dropbox.com/s/abc'],
      ['drive_label', ''],
    ])
  );
  check('ปฏิเสธลิงก์ที่ไม่ใช่ Google Drive', res.status === 400 && res.text.includes('Google Drive'), res.status);

  console.log('\n▶ ส่งผลงานจริง');
  res = await req(
    'POST',
    '/works',
    form([
      ['_csrf', createCsrf],
      ['work_type', 'innovation'],
      ['title', 'นวัตกรรมบัตรคำอ่านออกเสียง'],
      ['author_name', 'นางสาวสมศรี ใจดี'],
      ['author_position', 'ครูชำนาญการ'],
      ['subject_area', 'ภาษาไทย'],
      ['grade_level', 'ป.4'],
      ['term', '1'],
      ['academic_year', '2568'],
      ['abstract', 'สรุปย่อผลงาน'],
      ['drive_label', 'รายงานฉบับเต็ม'],
      ['drive_url', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing'],
      ['drive_label', 'ภาคผนวก'],
      ['drive_url', 'https://drive.google.com/drive/folders/1FolderAbCdEfGhIjKlMn'],
      ['info_label', 'อินโฟกราฟิกสรุป'],
      ['info_url', 'https://drive.google.com/file/d/1InfoGraphicIdAbCdEfGh/view'],
      ['media_type', 'video'],
      ['media_label', 'คลิปการใช้นวัตกรรม'],
      ['media_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      ['media_type', 'game'],
      ['media_label', 'เกมฝึกอ่าน'],
      ['media_url', 'https://scratch.mit.edu/projects/123456789/'],
      ['media_type', 'website'],
      ['media_label', 'เว็บไซต์ประกอบ'],
      ['media_url', 'https://sites.google.com/view/my-class'],
    ])
  );
  check('บันทึกผลงานสำเร็จ', res.status === 302 && /\/works\/1/.test(res.location), `${res.status} ${res.location}`);

  console.log('\n▶ หน้าผลงาน (ผู้ชมทั่วไป)');
  res = await req('GET', '/works/1', { useCookie: false });
  check('ผู้ชมทั่วไปเปิดหน้าผลงานได้', res.status === 200, res.status);
  check('แสดงลิงก์ Google Drive ให้กดเปิด', res.text.includes('เปิดใน Google Drive'));
  check('ฝังคลิป YouTube ให้ดูได้ทันที', res.text.includes('https://www.youtube.com/embed/dQw4w9WgXcQ'));
  check('ฝังเกม Scratch ให้เล่นได้ทันที', res.text.includes('https://scratch.mit.edu/projects/123456789/embed'));
  check('เว็บไซต์ที่ฝังไม่ได้ มีปุ่มเปิดแท็บใหม่', res.text.includes('เปิดในแท็บใหม่'));
  check('แสดงรูปอินโฟกราฟิก', res.text.includes('drive.google.com/thumbnail?id=1InfoGraphicIdAbCdEfGh'));
  check('แสดงว่ายังไม่ได้รับรอง', res.text.includes('ยังไม่ได้รับรอง'));
  check('ผู้ชมทั่วไปไม่เห็นฟอร์มรับรอง', !res.text.includes('ลงนามรับรองผลงานนี้'));

  res = await req('GET', '/', { useCookie: false });
  check('ผลงานขึ้นในหน้าแรก', res.text.includes('นวัตกรรมบัตรคำอ่านออกเสียง'));
  check('หน้าแรกใช้อินโฟกราฟิกเป็นภาพหน้าปก', res.text.includes('drive.google.com/thumbnail?id=1InfoGraphicIdAbCdEfGh'));

  res = await req('GET', '/works/1/certificate', { useCookie: false });
  check('ยังพิมพ์หน้ารับรองไม่ได้ก่อนได้รับการรับรอง', res.status === 302, res.status);

  console.log('\n▶ ผู้อำนวยการรับรองด้วยรูปลายเซ็น');
  res = await req('GET', '/works/1');
  const detailCsrf = csrfFrom(res.text);
  check('ผู้ถือรหัสเห็นฟอร์มรับรอง', res.text.includes('ลงนามรับรองผลงานนี้'));

  res = await req(
    'POST',
    '/works/1/certify',
    multipart(
      [
        ['_csrf', detailCsrf],
        ['certifier_name', 'นายสมชาย รักเรียน'],
        ['certifier_position', 'ผู้อำนวยการโรงเรียนเจ้าพ่อหลวงอุปถัมภ์ ๑'],
        ['certify_note', 'ผลงานมีคุณภาพ'],
        ['signature_source', 'upload'],
      ],
      { name: 'signature_file', filename: 'sig.png', type: 'image/png', data: PNG_1PX }
    )
  );
  check('รับรองผลงานด้วยรูปลายเซ็นสำเร็จ', res.status === 302, `${res.status} ${res.text.slice(0, 120)}`);

  res = await req('GET', '/works/1', { useCookie: false });
  check('หน้าผลงานแสดงว่ารับรองแล้ว', res.text.includes('ผู้อำนวยการรับรองแล้ว'));
  check('หน้าผลงานแสดงรูปลายเซ็นที่อัปโหลด', res.text.includes('data:image/png;base64,'));
  check('มีปุ่มพิมพ์หน้ารับรอง A4', res.text.includes('พิมพ์หน้ารับรอง (A4)'));

  console.log('\n▶ หน้ารับรอง A4');
  res = await req('GET', '/works/1/certificate', { useCookie: false });
  check('เปิดหน้ารับรองได้', res.status === 200, res.status);
  check('ตั้งค่ากระดาษ A4', res.text.includes('size: A4 portrait'));
  check('มีลายเซ็นฝังในหน้ารับรอง', res.text.includes('data:image/png;base64,'));
  check('มีชื่อและตำแหน่งผู้อำนวยการ', res.text.includes('นายสมชาย รักเรียน') && res.text.includes('ผู้อำนวยการโรงเรียนเจ้าพ่อหลวงอุปถัมภ์ ๑'));
  check('มีวันที่แบบไทย พ.ศ.', /ให้ไว้ ณ วันที่ \d+ [ก-๙]+ 25\d\d/.test(res.text));
  check('มีเลขที่เอกสารรับรอง', res.text.includes('0001/2568'));
  check('ระบุประเภทนวัตกรรม', res.text.includes('นวัตกรรมการเรียนการสอน'));

  console.log('\n▶ แก้ไข และประวัติเวอร์ชัน');
  res = await req('GET', '/works/1/edit');
  const editCsrf = csrfFrom(res.text);
  check('ฟอร์มแก้ไขเติมข้อมูลเดิมไว้ให้', res.text.includes('นวัตกรรมบัตรคำอ่านออกเสียง') && res.text.includes('1AbCdEfGhIjKlMnOpQrStUv'));

  res = await req(
    'POST',
    '/works/1',
    form([
      ['_csrf', editCsrf],
      ['work_type', 'innovation'],
      ['title', 'ชื่อใหม่หลังแก้ไข'],
      ['author_name', 'นางสาวสมศรี ใจดี'],
      ['academic_year', '2568'],
      ['drive_label', 'รายงานฉบับเต็ม'],
      ['drive_url', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view'],
    ])
  );
  check('บันทึกการแก้ไขได้', res.status === 302, res.status);

  res = await req('GET', '/works/1', { useCookie: false });
  check('หน้าผลงานแสดงชื่อใหม่', res.text.includes('ชื่อใหม่หลังแก้ไข'));

  res = await req('GET', '/works/1/history');
  const historyCsrf = csrfFrom(res.text);
  const revisionMatch = /name="revision_id" value="(\d+)"/.exec(res.text);
  check('ประวัติเก็บเวอร์ชันก่อนแก้ไขไว้', res.status === 200 && !!revisionMatch, res.status);

  res = await req(
    'POST',
    '/works/1/restore-revision',
    form([['_csrf', historyCsrf], ['revision_id', revisionMatch ? revisionMatch[1] : '0']])
  );
  check('ย้อนกลับเวอร์ชันได้', res.status === 302, res.status);

  res = await req('GET', '/works/1', { useCookie: false });
  check('ข้อมูลเดิมกลับมาครบหลังย้อนเวอร์ชัน', res.text.includes('นวัตกรรมบัตรคำอ่านออกเสียง') && res.text.includes('scratch.mit.edu'));

  console.log('\n▶ ลบแบบกู้คืนได้');
  res = await req('GET', '/works/1');
  const archiveCsrf = csrfFrom(res.text);
  res = await req('POST', '/works/1/archive', form([['_csrf', archiveCsrf]]));
  check('ย้ายผลงานไปถังขยะได้', res.status === 302, res.status);

  res = await req('GET', '/works/1', { useCookie: false });
  check('ผู้ชมทั่วไปไม่เห็นผลงานที่ถูกลบ', res.status === 404, res.status);

  res = await req('GET', '/', { useCookie: false });
  check('ผลงานที่ถูกลบหายจากหน้าแรก', !res.text.includes('นวัตกรรมบัตรคำอ่านออกเสียง'));

  res = await req('GET', '/manage');
  const manageCsrf = csrfFrom(res.text);
  check('หน้าจัดการระบบแสดงผลงานในถังขยะ', res.text.includes('นวัตกรรมบัตรคำอ่านออกเสียง'));
  check('หน้าจัดการระบบเตือนว่ายังใช้รหัสเริ่มต้น', res.text.includes('ยังใช้รหัสเริ่มต้น'));

  res = await req('POST', '/works/1/restore', form([['_csrf', manageCsrf]]));
  check('กู้คืนผลงานจากถังขยะได้', res.status === 302, res.status);
  res = await req('GET', '/works/1', { useCookie: false });
  check('ผู้ชมทั่วไปเห็นผลงานอีกครั้งหลังกู้คืน', res.status === 200, res.status);

  console.log('\n▶ ความปลอดภัย และการสำรองข้อมูล');
  res = await req('POST', '/works/1/archive', form([['_csrf', 'ปลอม']]));
  check('ปฏิเสธคำขอที่ CSRF ไม่ถูกต้อง', res.status === 403, res.status);

  const saved = cookie;
  cookie = '';
  res = await req('POST', '/works/1/archive', form([['_csrf', manageCsrf]]));
  check('ปฏิเสธการแก้ไขเมื่อยังไม่ปลดล็อก', res.status === 302 && res.location.startsWith('/unlock'), res.status);
  res = await req('GET', '/manage', { useCookie: false });
  check('หน้าจัดการระบบขณะล็อกอยู่ไม่แสดงข้อมูล', res.status === 200 && res.text.includes('ใส่รหัสเพื่อเข้าจัดการระบบ'), res.status);
  cookie = saved;

  res = await req('GET', '/manage/backup/download');
  check('ดาวน์โหลดไฟล์สำรองฐานข้อมูลได้', res.status === 200 && res.headers.get('content-type') === 'application/octet-stream', res.status);

  const backupDir = path.join(DATA_DIR, 'backups');
  check('มีไฟล์สำรองอยู่บนดิสก์', fs.existsSync(backupDir) && fs.readdirSync(backupDir).length > 0);

  res = await req('GET', '/works/999', { useCookie: false });
  check('ผลงานที่ไม่มีอยู่ ตอบ 404', res.status === 404, res.status);
}

(async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const serverLog = [];
  child.stdout.on('data', (d) => serverLog.push(d.toString()));
  child.stderr.on('data', (d) => serverLog.push(d.toString()));

  let exitCode = 0;
  try {
    if (!(await waitForServer())) throw new Error(`server did not start\n${serverLog.join('')}`);
    await run();
  } catch (err) {
    console.error('\nการทดสอบล้มเหลว:', err);
    exitCode = 1;
  } finally {
    child.kill();
  }

  console.log(`\n${'─'.repeat(52)}`);
  if (failures.length) {
    console.log(`ผ่าน ${passed} ข้อ · ไม่ผ่าน ${failures.length} ข้อ`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    exitCode = 1;
  } else {
    console.log(`ผ่านทั้งหมด ${passed} ข้อ ✓`);
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(exitCode);
})();
