/* Fahrschul Assistent – Service Worker, offline inkl. Bilder & Videos (v13)
   - App-Dateien: Netzwerk-zuerst (frische Updates), Cache als Fallback
   - Medien (kalaiwa-CDN): Cache zuerst, sonst laden + speichern
   - Precache per Nachricht: {type:'precache-media', urls:[...], kind:'img'|'video'}
   - Status: media-progress mit aktuellem Download + Zähler */
const CACHE = 'fsa-v25';
const MEDIA_CACHE = 'fsa-media';
const VERSION = '25';
const MEDIA_HOSTS = ['video2.kalaiwa.de', 'video4.kalaiwa.de', 'storage.googleapis.com'];
const ASSETS = [
  './', './index.html',
  './manifest.webmanifest',
  './css/style.css?v=25',
  './js/core.js?v=25',
  './js/app.js?v=25',
  './data/questions.js?v=25',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png',
];

const isMedia = (url) => MEDIA_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));

self.addEventListener('install', (e) => {
  console.log('[Fahrschul SW] Installiere v' + VERSION);
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  console.log('[Fahrschul SW] Aktiv v' + VERSION);
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // App-Dokument: Netzwerk zuerst
  if (url.origin === self.location.origin && (e.request.mode === 'navigate' || e.request.destination === 'document')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Medien (CDN) oder eigene Assets: Cache zuerst, sonst laden + speichern
  if (isMedia(url) || url.origin === self.location.origin) {
    const cacheName = isMedia(url) ? MEDIA_CACHE : CACHE;
    e.respondWith(
      caches.open(cacheName).then((c) => c.match(url)).then((hit) =>
        hit || fetch(isMedia(url) ? new Request(url, { mode: 'no-cors' }) : e.request).then((res) => {
          const copy = res.clone();
          caches.open(cacheName).then((c) => c.put(url, copy)).catch(() => {});
          return res;
        }).catch(() => hit)
      )
    );
  }
});

/* ---------- Precache-Warteschlange mit Live-Status ---------- */
let queue = [];
let running = false;
let totalQueued = 0;
let doneCount = 0;

async function processQueue() {
  if (running) return;
  running = true;
  while (queue.length) {
    const batch = queue.splice(0, 3); // 3 gleichzeitig
    await Promise.all(batch.map(async (item) => {
      try {
        // no-cors, weil der CDN-Server keine CORS-Header für Videos sendet
        const res = await fetch(item.url, { mode: 'no-cors' });
        if (res.type === 'opaque' || res.ok) {
          await (await caches.open(MEDIA_CACHE)).put(item.url, res);
        }
      } catch (e) { /* einzeln ignorieren */ }
      doneCount++;
      broadcast({
        type: 'media-progress',
        kind: item.kind,
        current: item.url,
        done: doneCount,
        total: totalQueued,
        pending: queue.length,
      });
    }));
  }
  running = false;
  broadcast({ type: 'media-progress', finished: true, done: doneCount, total: totalQueued });
}

function broadcast(msg) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) => c.postMessage(msg));
  });
}

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'precache-media' && Array.isArray(d.urls)) {
    const kind = d.kind === 'video' ? 'video' : 'img';
    queue = queue.concat(d.urls.filter(Boolean).map((url) => ({ url, kind })));
    totalQueued += d.urls.filter(Boolean).length;
    processQueue();
  }
  if (d.type === 'media-status') {
    caches.open(MEDIA_CACHE).then((c) => c.keys()).then((keys) => {
      let imgs = 0, vids = 0;
      keys.forEach((k) => { if (/\.mp4|\.m4v|\.webm/i.test(k.url)) vids++; else imgs++; });
      e.source.postMessage({ type: 'media-status', imgs, vids });
    }).catch(() => {
      e.source.postMessage({ type: 'media-status', imgs: 0, vids: 0 });
    });
  }
});
