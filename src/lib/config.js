// Identity and site-wide constants. Everything here can be overridden with an
// environment variable so the same code can be handed to another school
// without editing templates.
const SCHOOL_NAME = process.env.SCHOOL_NAME || 'โรงเรียนเจ้าพ่อหลวงอุปถัมภ์ ๑';
const SITE_TITLE = process.env.SITE_TITLE || 'ระบบเผยแพร่ผลงานวิจัยและนวัตกรรมครู';
const SITE_TAGLINE =
  process.env.SITE_TAGLINE || 'ผลงานวิจัยในชั้นเรียนและนวัตกรรมของคณะครูและผู้อำนวยการ';

// The single shared passcode that guards adding, editing, deleting and
// certifying. Viewing needs nothing at all. The school can change it from the
// manage page (stored in the database) or with EDIT_PASSCODE.
const DEFAULT_PASSCODE = process.env.EDIT_PASSCODE || '123456';

// How long one unlock lasts before the passcode is asked for again.
const UNLOCK_HOURS = Number(process.env.UNLOCK_HOURS || 8);

const WORK_TYPES = {
  research: 'งานวิจัยในชั้นเรียน',
  innovation: 'นวัตกรรมการเรียนการสอน',
};

module.exports = { SCHOOL_NAME, SITE_TITLE, SITE_TAGLINE, DEFAULT_PASSCODE, UNLOCK_HOURS, WORK_TYPES };
