// Behind a reverse proxy (Render, or any PaaS) req.socket.remoteAddress is
// the proxy's own address for every request, which would collapse the login
// rate limiter and the approval audit trail onto one shared IP for all
// users. Trusting X-Forwarded-For fixes that — but only holds because this
// app is meant to run behind such a proxy. If it is ever exposed directly
// to the internet, this header becomes client-controlled and must not be
// trusted; set TRUST_PROXY=false in that case to fall back to the socket
// address.
function getClientIp(req) {
  if (process.env.TRUST_PROXY !== 'false') {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const first = xff.split(',')[0].trim();
      if (first) return first;
    }
  }
  return req.socket.remoteAddress || '';
}

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

// Form bodies are exposed two ways: `fields` keeps the last value for each
// name (what every single-value form wants) and `multi` keeps every value in
// submission order, which the repeatable Google Drive link rows rely on to
// pair each URL with its label by index.
function collectPairs(pairs) {
  const fields = {};
  const multi = {};
  for (const [key, value] of pairs) {
    fields[key] = value;
    if (!multi[key]) multi[key] = [];
    multi[key].push(value);
  }
  return { fields, multi };
}

function parseUrlEncoded(str) {
  const pairs = [];
  new URLSearchParams(str).forEach((value, key) => {
    pairs.push([key, value]);
  });
  return collectPairs(pairs);
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
  const pairs = [];
  const files = [];
  if (!boundary) return { ...collectPairs(pairs), files };

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
      pairs.push([fieldName, body.toString('utf8')]);
    }
  }

  return { ...collectPairs(pairs), files };
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
    return { fields: json, multi: {}, files: [], raw };
  }
  return { ...parseUrlEncoded(raw.toString('utf8')), files: [], raw };
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
  getClientIp,
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
