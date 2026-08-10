const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB per file

function saveUploadedFiles(files) {
  const saved = [];
  for (const file of files) {
    if (!file.fileName) continue;
    const ext = path.extname(file.fileName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue;
    if (file.data.length === 0 || file.data.length > MAX_FILE_SIZE) continue;
    const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), file.data);
    saved.push({
      file_name: file.fileName,
      stored_name: storedName,
      file_type: file.contentType,
      file_size: file.data.length,
    });
  }
  return saved;
}

module.exports = { saveUploadedFiles, UPLOAD_DIR };
