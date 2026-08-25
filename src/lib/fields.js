// The catalogue entry for a piece of work. The full paper lives in Google
// Drive, so these fields are a searchable summary — enough for a visitor to
// understand the work and for the school to compile a yearly list — not a
// re-typing of the document.
const WORK_FIELDS = [
  { key: 'title', label: 'ชื่อเรื่องผลงาน', type: 'text', required: true, full: true, group: 'basic' },
  { key: 'author_name', label: 'ชื่อ-สกุล ผู้จัดทำ', type: 'text', required: true, group: 'basic' },
  { key: 'author_position', label: 'ตำแหน่ง', type: 'text', group: 'basic', placeholder: 'เช่น ครูชำนาญการ / ผู้อำนวยการโรงเรียน' },
  { key: 'subject_area', label: 'กลุ่มสาระการเรียนรู้', type: 'select', group: 'basic' },
  { key: 'grade_level', label: 'ระดับชั้น', type: 'text', group: 'basic', placeholder: 'เช่น ป.4' },
  { key: 'term', label: 'ภาคเรียน', type: 'text', group: 'basic', placeholder: 'เช่น 1' },
  { key: 'academic_year', label: 'ปีการศึกษา', type: 'text', group: 'basic', placeholder: 'เช่น 2568' },
  { key: 'abstract', label: 'บทคัดย่อ / สรุปย่อผลงาน', type: 'textarea', full: true, group: 'detail' },
  { key: 'objectives', label: 'วัตถุประสงค์', type: 'textarea', full: true, group: 'detail' },
  { key: 'methodology', label: 'วิธีดำเนินการ', type: 'textarea', full: true, group: 'detail' },
  { key: 'results', label: 'ผลที่เกิดขึ้น', type: 'textarea', full: true, group: 'detail' },
  { key: 'benefits', label: 'ประโยชน์ที่ได้รับ / การนำไปใช้', type: 'textarea', full: true, group: 'detail' },
];

const BASIC_FIELDS = WORK_FIELDS.filter((f) => f.group === 'basic');
const DETAIL_FIELDS = WORK_FIELDS.filter((f) => f.group === 'detail');
const COLUMNS = WORK_FIELDS.map((f) => f.key);

module.exports = { WORK_FIELDS, BASIC_FIELDS, DETAIL_FIELDS, COLUMNS };
