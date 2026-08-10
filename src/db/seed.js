const db = require('./index');
const { hashPassword } = require('../lib/auth');

const DEMO_USERS = [
  { name: 'ครูสมศรี ใจดี', email: 'teacher@school.ac.th', role: 'teacher', subject_group: 'คณิตศาสตร์', password: 'teacher123' },
  { name: 'หัวหน้ากลุ่มสาระคณิตศาสตร์', email: 'head@school.ac.th', role: 'head', subject_group: 'คณิตศาสตร์', password: 'head1234' },
  { name: 'ฝ่ายวิชาการ', email: 'academic@school.ac.th', role: 'academic', subject_group: null, password: 'academic123' },
  { name: 'ผู้อำนวยการโรงเรียน', email: 'director@school.ac.th', role: 'director', subject_group: null, password: 'director123' },
  { name: 'ผู้ดูแลระบบ', email: 'admin@school.ac.th', role: 'admin', subject_group: null, password: 'admin1234' },
];

function seed() {
  const insert = db.prepare(
    'INSERT INTO users (name, email, password_hash, password_salt, role, subject_group) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const existsStmt = db.prepare('SELECT id FROM users WHERE email = ?');

  let created = 0;
  for (const u of DEMO_USERS) {
    if (existsStmt.get(u.email)) continue;
    const { hash, salt } = hashPassword(u.password);
    insert.run(u.name, u.email, hash, salt, u.role, u.subject_group);
    created += 1;
  }

  console.log(`Seed complete. ${created} demo user(s) created.`);
  console.log('Demo accounts (email / password):');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(10)} ${u.email} / ${u.password}`);
  }
}

seed();
