const STATUS_LABELS = {
  draft: 'ฉบับร่าง',
  submitted: 'ส่งแล้ว รอหัวหน้าสาระตรวจ',
  head_approved: 'ผ่านหัวหน้าสาระ รอฝ่ายวิชาการ',
  academic_approved: 'ผ่านฝ่ายวิชาการ รอผู้อำนวยการ',
  approved: 'อนุมัติแล้ว',
  returned: 'ส่งกลับให้แก้ไข',
};

// Which role must act while the report is in a given status.
const STAGE_ROLE = {
  submitted: 'head',
  head_approved: 'academic',
  academic_approved: 'director',
};

const NEXT_STATUS = {
  head: 'head_approved',
  academic: 'academic_approved',
  director: 'approved',
};

module.exports = { STATUS_LABELS, STAGE_ROLE, NEXT_STATUS };
