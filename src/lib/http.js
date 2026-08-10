function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

function serializeCookie(name, value, opts = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  str += '; Path=/';
  str += '; HttpOnly';
  str += '; SameSite=Lax';
  if (opts.maxAge !== undefined) str += `; Max-Age=${opts.maxAge}`;
  if (opts.expires) str += `; Expires=${opts.expires.toUTCString()}`;
  return str;
}

function readBody(req, limitBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseUrlEncoded(str) {
  const result = {};
  new URLSearchParams(str).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function splitBuffer(buffer, delimiter) {
  const result = [];
  let start = 0;
  while (true) {
    const idx = buffer.indexOf(delimiter, start);
    if (idx === -1) {
      result.push(buffer.subarray(start));
      break;
    }
    result.push(buffer.subarray(start, idx));
    start = idx + delimiter.length;
  }
  return result;
}

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  const boundary = match ? (match[1] || match[2]).trim() : null;
  const fields = {};
  const files = [];
  if (!boundary) return { fields, files };

  const delimiter = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(buffer, delimiter);

  for (const rawPart of parts) {
    if (rawPart.length === 0) continue;
    // strip leading CRLF and trailing CRLF (or trailing "--" epilogue marker)
    let part = rawPart;
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.subarray(-2).toString() === '\r\n') part = part.subarray(0, -2);
    if (part.length === 0 || part.toString('utf8', 0, 2) === '--') continue;

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerText = part.subarray(0, headerEnd).toString('utf8');
    const body = part.subarray(headerEnd + 4);

    const nameMatch = /name="([^"]*)"/i.exec(headerText);
    const fileNameMatch = /filename="([^"]*)"/i.exec(headerText);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText);
    const fieldName = nameMatch ? nameMatch[1] : null;
    if (!fieldName) continue;

    if (fileNameMatch && fileNameMatch[1] !== '') {
      files.push({
        fieldName,
        fileName: fileNameMatch[1],
        contentType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
        data: body,
      });
    } else {
      fields[fieldName] = body.toString('utf8');
    }
  }

  return { fields, files };
}

async function parseRequestBody(req) {
  const contentType = req.headers['content-type'] || '';
  const raw = await readBody(req);
  if (contentType.includes('multipart/form-data')) {
    return { ...parseMultipart(raw, contentType), raw };
  }
  if (contentType.includes('application/json')) {
    let json = {};
    try {
      json = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
      json = {};
    }
    return { fields: json, files: [], raw };
  }
  return { fields: parseUrlEncoded(raw.toString('utf8')), files: [], raw };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function sendHtml(res, status, html, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders });
  res.end(html);
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { Location: location, ...extraHeaders });
  res.end();
}

module.exports = {
  parseCookies,
  serializeCookie,
  readBody,
  parseUrlEncoded,
  parseMultipart,
  parseRequestBody,
  sendJson,
  sendHtml,
  redirect,
};
