const db = require('../db');
const { parseDriveLink, MAX_LINKS } = require('./driveLink');
const { parseMediaLink } = require('./mediaLink');

// Reads the three repeatable link sections off a submitted form. Each section
// posts parallel arrays that are paired by index, so an untouched label still
// submits an empty string and the arrays stay aligned.
//
// Rows that fail validation are kept in the result with `error` set, so the
// form can be re-rendered with what the teacher actually typed still in the
// boxes rather than making them paste everything again.

const CATEGORY_FIELDS = {
  drive: { url: 'drive_url', label: 'drive_label' },
  infographic: { url: 'info_url', label: 'info_label' },
  media: { url: 'media_url', label: 'media_label', type: 'media_type' },
};

const CATEGORY_LABELS = {
  drive: 'ลิงก์ผลงานบน Google Drive',
  infographic: 'อินโฟกราฟิก',
  media: 'สื่อ/ผลงานออนไลน์',
};

function collectCategory(multi, category) {
  const fields = CATEGORY_FIELDS[category];
  const urls = multi[fields.url] || [];
  const labels = multi[fields.label] || [];
  const types = (fields.type && multi[fields.type]) || [];

  const rows = [];
  const errors = [];
  const seen = new Set();

  for (let i = 0; i < urls.length; i++) {
    const rawUrl = String(urls[i] || '').trim();
    const label = String(labels[i] || '').trim();
    if (!rawUrl) continue; // an empty row is simply not a link

    if (rows.length >= MAX_LINKS) {
      errors.push(`${CATEGORY_LABELS[category]}: ใส่ได้สูงสุด ${MAX_LINKS} รายการ`);
      break;
    }

    const parsed =
      category === 'media'
        ? parseMediaLink(rawUrl, String(types[i] || '').trim())
        : parseDriveLink(rawUrl);

    if (!parsed.ok) {
      rows.push({ category, url: rawUrl, label, media_type: String(types[i] || ''), error: parsed.error });
      errors.push(`${CATEGORY_LABELS[category]} รายการที่ ${i + 1}: ${parsed.error}`);
      continue;
    }

    const key = parsed.key || parsed.url;
    if (seen.has(key)) {
      rows.push({ category, url: rawUrl, label, media_type: String(types[i] || ''), error: 'ลิงก์นี้ซ้ำกับรายการก่อนหน้า' });
      errors.push(`${CATEGORY_LABELS[category]} รายการที่ ${i + 1}: ซ้ำกับรายการก่อนหน้า`);
      continue;
    }
    seen.add(key);

    rows.push({
      category,
      url: parsed.url,
      label: label || parsed.kindLabel || '',
      media_type: parsed.mediaType || null,
      provider: parsed.provider || (category === 'media' ? 'web' : 'google'),
      file_id: parsed.fileId || null,
      embed_url: parsed.embedUrl || parsed.previewUrl || null,
    });
  }

  return { rows, errors };
}

function collectLinks(multi = {}) {
  const drive = collectCategory(multi, 'drive');
  const infographic = collectCategory(multi, 'infographic');
  const media = collectCategory(multi, 'media');
  return {
    drive: drive.rows,
    infographic: infographic.rows,
    media: media.rows,
    errors: [...drive.errors, ...infographic.errors, ...media.errors],
    hasInvalid: [...drive.rows, ...infographic.rows, ...media.rows].some((r) => r.error),
  };
}

function loadLinks(workId) {
  const rows = db.prepare('SELECT * FROM work_links WHERE work_id = ? ORDER BY category, position, id').all(workId);
  return {
    drive: rows.filter((r) => r.category === 'drive'),
    infographic: rows.filter((r) => r.category === 'infographic'),
    media: rows.filter((r) => r.category === 'media'),
    all: rows,
  };
}

// Replaces the whole link set for a work; the submitted rows are the complete
// intended list, so clearing a row in the form removes that link. The previous
// state is always recoverable from work_revisions (see src/lib/revisions.js).
function saveLinks(workId, collected) {
  db.prepare('DELETE FROM work_links WHERE work_id = ?').run(workId);
  const insert = db.prepare(
    `INSERT INTO work_links (work_id, category, media_type, label, url, provider, file_id, embed_url, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const category of ['drive', 'infographic', 'media']) {
    collected[category]
      .filter((row) => !row.error)
      .forEach((row, index) => {
        insert.run(
          workId,
          category,
          row.media_type || null,
          row.label || null,
          row.url,
          row.provider || null,
          row.file_id || null,
          row.embed_url || null,
          index
        );
      });
  }
}

module.exports = { collectLinks, loadLinks, saveLinks, CATEGORY_LABELS };
