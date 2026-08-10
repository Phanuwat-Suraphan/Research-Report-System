const REPORT_FIELDS = [
  { key: 'title', label: 'ชื่อเรื่อง', type: 'text', required: true, full: true },
  { key: 'subject_area', label: 'กลุ่มสาระการเรียนรู้', type: 'text', required: true },
  { key: 'grade_level', label: 'ระดับชั้น', type: 'text' },
  { key: 'term', label: 'ภาคเรียน', type: 'text' },
  { key: 'academic_year', label: 'ปีการศึกษา', type: 'text' },
  { key: 'problem', label: 'ที่มาและความสำคัญของปัญหา', type: 'textarea', full: true },
  { key: 'objectives', label: 'วัตถุประสงค์', type: 'textarea', full: true },
  { key: 'hypothesis', label: 'สมมติฐาน', type: 'textarea', full: true },
  { key: 'target_group', label: 'กลุ่มเป้าหมาย', type: 'textarea', full: true },
  { key: 'tools', label: 'เครื่องมือวิจัย', type: 'textarea', full: true },
  { key: 'methodology', label: 'วิธีดำเนินการ', type: 'textarea', full: true },
  { key: 'results', label: 'ผลการวิจัย', type: 'textarea', full: true },
  { key: 'summary', label: 'สรุปผล', type: 'textarea', full: true },
  { key: 'discussion', label: 'อภิปรายผล', type: 'textarea', full: true },
  { key: 'recommendation', label: 'ข้อเสนอแนะ', type: 'textarea', full: true },
  { key: 'reference_list', label: 'เอกสารอ้างอิง', type: 'textarea', full: true },
];

module.exports = { REPORT_FIELDS };
