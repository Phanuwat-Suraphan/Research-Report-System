const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

// Serves a file from `rootDir` given a URL-decoded relative path, rejecting
// any attempt to escape the root via ../ traversal.
function serveFromDir(res, rootDir, relPath, { download } = {}) {
  const safeRel = path.normalize(relPath).replace(/^([.][.][/\\])+/, '');
  const fullPath = path.join(rootDir, safeRel);
  if (!fullPath.startsWith(path.resolve(rootDir))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size };
    if (download) headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(download)}"`;
    res.writeHead(200, headers);
    fs.createReadStream(fullPath).pipe(res);
  });
}

module.exports = { serveFromDir, MIME };
