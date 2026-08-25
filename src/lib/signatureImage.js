// The director's certifying signature is uploaded as an image and stored in
// the database as a data URI rather than as a file on disk.
//
// Two reasons: the signature then travels with the one file that gets backed
// up (nothing to lose separately if the host's disk is wiped), and the printed
// A4 certificate stays self-contained — it renders correctly even when saved
// or emailed away from this server.

const MAX_BYTES = 1024 * 1024; // 1 MB is generous for a signature

const SIGNATURES = [
  { mime: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/webp',
    test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

// Validates by magic bytes, not by the filename or the browser-supplied
// content type, so a renamed executable cannot be stored as an "image".
function toDataUri(buffer) {
  if (!buffer || buffer.length === 0) return { ok: false, error: 'ไม่พบไฟล์รูปลายเซ็น' };
  if (buffer.length > MAX_BYTES) {
    return { ok: false, error: `ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(MAX_BYTES / 1024)} KB) กรุณาย่อรูปก่อนอัปโหลด` };
  }
  const match = SIGNATURES.find((s) => s.test(buffer));
  if (!match) {
    return { ok: false, error: 'รองรับเฉพาะไฟล์รูปภาพ PNG, JPG หรือ WebP เท่านั้น' };
  }
  return { ok: true, dataUri: `data:${match.mime};base64,${buffer.toString('base64')}`, mime: match.mime };
}

// Guards anything read back out of the database before it reaches an <img src>.
function isSignatureDataUri(value) {
  return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

module.exports = { toDataUri, isSignatureDataUri, MAX_BYTES };
