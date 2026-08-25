// Dates are shown in Thai Buddhist era and Bangkok time regardless of the
// server's own timezone (hosts almost always run in UTC), because the printed
// certificate is an official school document and has to read correctly.
const TZ = process.env.TZ_DISPLAY || 'Asia/Bangkok';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function parts(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  // en-CA gives plain numeric parts, so the Thai text below never depends on
  // Thai locale data being present in the runtime's ICU build.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const found = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') found[part.type] = part.value;
  }
  return {
    day: Number(found.day),
    month: Number(found.month),
    year: Number(found.year) + 543,
    hour: found.hour,
    minute: found.minute,
  };
}

function thaiDate(value) {
  const p = parts(value);
  if (!p) return '-';
  return `${p.day} ${THAI_MONTHS[p.month - 1]} ${p.year}`;
}

function thaiDateTime(value) {
  const p = parts(value);
  if (!p) return '-';
  return `${p.day} ${THAI_MONTHS[p.month - 1]} ${p.year} เวลา ${p.hour}:${p.minute} น.`;
}

function thaiShortDate(value) {
  const p = parts(value);
  if (!p) return '-';
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
}

// Thai academic years start in May, so a submission made in, say, March 2569
// still belongs to academic year 2568.
function currentAcademicYear() {
  const p = parts();
  if (!p) return '';
  return String(p.month >= 5 ? p.year : p.year - 1);
}

module.exports = { thaiDate, thaiDateTime, thaiShortDate, currentAcademicYear, THAI_MONTHS };
