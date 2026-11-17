/* ============================================================
   فَكَّر — Service Worker
   نخليش الـSW خفيف: shell cache-first، الكتب Network-only
   ============================================================ */
const CACHE_SHELL = 'fikr-shell-v4';
const CACHE_BOOKS = 'fikr-books-v4';

self.addEventListener('install', e => {
  /* نزرع صفحة الرئيسية للكاش — لا نلقط الكتب (بحجمها 438MB) */
  e.waitUntil(
    caches.open(CACHE_SHELL).then(c => Promise.all([
      c.add('/index.html').catch(() => null),
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k =>
        (k === CACHE_SHELL || k === CACHE_BOOKS) ? null : caches.delete(k)
      ))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* 1) HTML — شبكة، وأي response غير 2xx (502 أثناء down، خطأ شبكة) يسقط للكاش */
  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '' ||
    url.pathname.endsWith('/index.html')
  ) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_SHELL).then(c => c.put('/index.html', clone)).catch(() => {});
          return res;
        }
        return caches.match('/index.html').then(c => c || res);
      }).catch(() => caches.match('/index.html').then(c => c || new Response('', { status: 504 })))
    );
    return;
  }

  /* 2) /sw.js — دائماً من الشبكة */
  if (url.pathname === '/sw.js') {
    e.respondWith(fetch(req).catch(() => caches.match('/sw.js')));
    return;
  }

  /* 3) ملفات الكتب (incl. manifest.json الصغير) — من الكاش، شبكة بصمت، ولو ok خزّنه */
  if (url.pathname.startsWith('/books/')) {
    const isSmall = url.pathname.endsWith('/manifest.json') || url.pathname.includes('/txt/');
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && res.ok) {
          if (isSmall) {
            const clone = res.clone();
            caches.open(CACHE_BOOKS).then(c => c.put(req, clone)).catch(() => {});
          }
          return res;
        }
        return cached || res;
      }).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  /* 4) باقي — شبكة، وأي response غير 2xx يسقط للكاش لو موجود */
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE_SHELL).then(c => c.put(req, clone)).catch(() => {});
        return res;
      }
      return caches.match(req).then(c => c || res);
    }).catch(() => caches.match(req).then(c => c || new Response('', { status: 504 })))
  );
});
