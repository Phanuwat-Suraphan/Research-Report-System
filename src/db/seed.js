const db = require('./index');

const DEFAULT_SUBJECTS = [
  'ภาษาไทย',
  'คณิตศาสตร์',
  'วิทยาศาสตร์และเทคโนโลยี',
  'สังคมศึกษา ศาสนา และวัฒนธรรม',
  'สุขศึกษาและพลศึกษา',
  'ศิลปะ',
  'การงานอาชีพ',
  'ภาษาต่างประเทศ',
  'ปฐมวัย',
  'กิจกรรมพัฒนาผู้เรียน',
  'บริหารการศึกษา',
];

function seedDefaultSubjects() {
  const insert = db.prepare('INSERT OR IGNORE INTO subjects (name, position) VALUES (?, ?)');
  let created = 0;
  DEFAULT_SUBJECTS.forEach((name, index) => {
    if (insert.run(name, index).changes > 0) created += 1;
  });
  console.log(`เพิ่มกลุ่มสาระเริ่มต้น ${created} รายการ`);
}

if (require.main === module) {
  seedDefaultSubjects();
}

module.exports = { seedDefaultSubjects, DEFAULT_SUBJECTS };
