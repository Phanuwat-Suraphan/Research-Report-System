// Validation and normalisation of the Google Drive / Google Docs links that
// teachers and the director submit their research work with.
//
// Work is submitted as a shared Drive link rather than a server-side upload:
// the file stays in the school's own Drive — where it is already backed up,
// already versioned and already where staff do their writing — and this app
// only has to store an address. That also sidesteps the ephemeral-disk
// problem that free PaaS hosting has with uploaded files (see README).
//
// Because the stored value ends up in an href, only https URLs on a known
// Google host are ever accepted; anything else (including javascript: or
// data: URLs) is rejected before it can reach the database.

const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
  'forms.gle',
]);

const KIND_LABELS = {
  folder: 'โฟลเดอร์ Google Drive',
  file: 'ไฟล์ใน Google Drive',
  document: 'Google Docs (เอกสาร)',
  spreadsheets: 'Google Sheets (สเปรดชีต)',
  presentation: 'Google Slides (สไลด์)',
  forms: 'Google Forms (ฟอร์ม)',
};

const DOCS_TYPES = new Set(['document', 'spreadsheets', 'presentation', 'forms']);

// Google resource ids are URL-safe base64-ish strings; the length floor keeps
// obvious junk (e.g. /file/d/x/view) out.
const ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/;

const MAX_LINKS = 10;

const SHARING_HINT =
  'อย่าลืมตั้งค่าการแชร์ของไฟล์/โฟลเดอร์เป็น "ผู้ที่มีลิงก์" (อย่างน้อยสิทธิ์ผู้อ่าน) มิฉะนั้นผู้ตรวจและผู้อำนวยการจะเปิดดูงานของท่านไม่ได้';

function fail(error) {
  return { ok: false, error };
}

function buildPreviewUrl(kind, fileId, resourceKey) {
  const suffix = resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : '';
  if (kind === 'file') return `https://drive.google.com/file/d/${fileId}/preview${suffix}`;
  if (kind === 'folder') return `https://drive.google.com/embeddedfolderview?id=${fileId}#list`;
  if (kind === 'document' || kind === 'spreadsheets' || kind === 'presentation') {
    return `https://docs.google.com/${kind}/d/${fileId}/preview${suffix}`;
  }
  return null; // Google Forms has no read-only preview worth embedding
}

// Returns { ok: true, url, kind, kindLabel, fileId, key, previewUrl } for a
// usable link, or { ok: false, error } with a message written for a teacher
// rather than a developer.
function parseDriveLink(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return fail('ยังไม่ได้วางลิงก์');

  let url;
  try {
    url = new URL(value);
  } catch {
    return fail('รูปแบบลิงก์ไม่ถูกต้อง กรุณากดปุ่ม "แชร์ → คัดลอกลิงก์" ใน Google Drive แล้ววางทั้งลิงก์');
  }

  if (url.protocol !== 'https:') return fail('ลิงก์ต้องขึ้นต้นด้วย https://');

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!ALLOWED_HOSTS.has(host)) {
    return fail(`รับเฉพาะลิงก์ Google Drive / Google Docs เท่านั้น (ลิงก์ที่วางมาเป็นของ ${host})`);
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const resourceKey = url.searchParams.get('resourcekey');
  let kind = null;
  let fileId = null;

  if (host === 'forms.gle') {
    // Short link — the code is not a Drive file id, so it is kept as-is and
    // used only for dedupe and for opening in a new tab.
    if (!segments[0]) return fail('ลิงก์ Google Forms ไม่สมบูรณ์');
    return {
      ok: true,
      url: url.href,
      kind: 'forms',
      kindLabel: KIND_LABELS.forms,
      fileId: null,
      key: `forms:${segments[0]}`,
      previewUrl: null,
    };
  }

  if (host === 'docs.google.com') {
    const type = segments[0];
    if (!DOCS_TYPES.has(type)) {
      return fail('ไม่รู้จักประเภทเอกสารในลิงก์นี้ รองรับ Google Docs / Sheets / Slides / Forms');
    }
    const dIndex = segments.indexOf('d');
    if (dIndex === -1) return fail('ลิงก์นี้ไม่ได้ชี้ไปยังเอกสารใดโดยเฉพาะ กรุณาเปิดเอกสารแล้วคัดลอกลิงก์จากปุ่ม "แชร์"');
    // Published forms use the longer /forms/d/e/{id}/viewform shape.
    fileId = segments[dIndex + 1] === 'e' ? segments[dIndex + 2] : segments[dIndex + 1];
    kind = type;
  } else {
    // drive.google.com / drive.usercontent.google.com
    const folderIndex = segments.indexOf('folders');
    if (folderIndex !== -1) {
      fileId = segments[folderIndex + 1];
      kind = 'folder';
    } else if (segments[0] === 'file' && segments[1] === 'd') {
      fileId = segments[2];
      kind = 'file';
    } else if (['open', 'uc', 'download'].includes(segments[0])) {
      fileId = url.searchParams.get('id');
      kind = 'file';
    } else if (segments.some((s) => ['my-drive', 'home', 'shared-with-me', 'recent', 'starred'].includes(s))) {
      return fail('ลิงก์นี้เป็นหน้าไดรฟ์ส่วนตัวของท่าน ผู้อื่นเปิดไม่ได้ กรุณาคลิกขวาที่ไฟล์หรือโฟลเดอร์ที่ต้องการส่ง แล้วเลือก "แชร์ → คัดลอกลิงก์"');
    } else {
      return fail('ไม่พบรหัสไฟล์หรือโฟลเดอร์ในลิงก์นี้ กรุณาใช้ลิงก์จากปุ่ม "แชร์ → คัดลอกลิงก์"');
    }
  }

  if (!fileId || !ID_PATTERN.test(fileId)) {
    return fail('ลิงก์ไม่สมบูรณ์ (ไม่พบรหัสไฟล์ที่ถูกต้อง) กรุณาคัดลอกลิงก์ใหม่ทั้งลิงก์');
  }

  return {
    ok: true,
    url: url.href,
    kind,
    kindLabel: KIND_LABELS[kind],
    fileId,
    key: `${kind}:${fileId}`,
    previewUrl: buildPreviewUrl(kind, fileId, resourceKey),
  };
}

// Drive renders a public image (or the first page of a PDF) at this URL,
// which is what makes an infographic show up inline instead of as a link.
function thumbnailUrl(fileId, width = 1600) {
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}

function kindLabel(kind) {
  return KIND_LABELS[kind] || 'ลิงก์ Google Drive';
}

// Rebuilds the preview URL for a link already stored in the database.
function previewUrlFor(link) {
  if (!link || !link.file_id) return null;
  return buildPreviewUrl(link.kind, link.file_id, null);
}

module.exports = { parseDriveLink, kindLabel, previewUrlFor, thumbnailUrl, KIND_LABELS, MAX_LINKS, SHARING_HINT };
