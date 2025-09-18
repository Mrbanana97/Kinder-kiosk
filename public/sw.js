// Versioned cache names to bust old HTML/asset caches after deployments
const VERSION = 'v2';
const STATIC_CACHE = `kiosk-static-${VERSION}`;
const RUNTIME_CACHE = `kiosk-runtime-${VERSION}`;

// Only pre-cache immutable or rarely changing assets (avoid dynamic route HTML during dev)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Backward compatibility: some old builds may reference PRENCACHE_URLS (misspelled)
// Expose that name to avoid ReferenceError until clients refresh.
// @ts-ignore
self.PRENCACHE_URLS = PRECACHE_URLS;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRENCACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Bypass non-GET
  if (request.method !== 'GET') return;

  // Network-first for navigations (HTML) to always get latest build
  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch (err) {
          const cacheMatch = await caches.match(request);
          if (cacheMatch) return cacheMatch;
          // Offline fallback: basic skeleton HTML (lightweight)
          return new Response('<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{font-family:sans-serif;padding:2rem;text-align:center;}h1{font-size:1.25rem;color:#555}</style></head><body><h1>Offline - content not cached yet.</h1></body></html>', { headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, images)
  const url = new URL(request.url);
  if (url.origin === self.location.origin && /\.(png|jpg|jpeg|svg|ico|webp|gif)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for everything else (e.g., JSON API, chunks) but skip Next internal dev websocket
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then(networkResponse => {
          cache.put(request, networkResponse.clone());
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })()
    );
  }
});
