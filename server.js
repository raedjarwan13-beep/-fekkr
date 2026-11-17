/* ============================================================
   فَكَّر — خادم Node بسيط (بدون حزم خارجية)
   يدعم تخطيطين للمستودع:
   1) public/index.html + public/sw.js + public/books/txt/...  (الافتراضي)
   2) ملفات مسطّحة في جذر المستودع (index.html, sw.js, manifest.json, *.txt)
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.pdf':  'application/pdf',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}

/* يجرب أكثر من مسار — يتوافق مع رفع GitHub بالـfolder أو بالملفات المسطّحة */
function resolveFile(urlPath) {
  const rel = path.normalize(urlPath).replace(/^[/\\]+/, '');
  const candidates = [
    path.join(BASE, 'public', rel),
    path.join(BASE, rel)
  ];
  /* books/txt/<file> -> ملف مسطّح في الجذر أو داخل public/books/txt */
  if (rel === 'books/txt' || rel.startsWith('books/txt/') || rel.startsWith('books\\txt\\')) {
    const base = path.basename(rel);
    candidates.push(path.join(BASE, 'public', 'books', 'txt', base));
    candidates.push(path.join(BASE, base));
  }
  for (const c of candidates) {
    const full = path.resolve(c);
    if (!full.startsWith(BASE)) continue;       /* منع الخروج من المستودع */
    if (isFile(full)) return full;
  }
  return null;
}

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (e) { return send(res, 400, 'Bad Request'); }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  let file = resolveFile(urlPath);
  if (!file && !path.extname(urlPath)) file = resolveFile('/index.html');  /* SPA fallback */
  if (!file) return send(res, 404, 'Not found');

  fs.readFile(file, (e, data) => {
    if (e) return send(res, 404, 'Not found');
    send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('فَكَّر يعمل على http://0.0.0.0:' + PORT);
});
