const CACHE_NAME = 'combustible-map-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  '../shared/stations.js',
  '../shared/fetchers.js',
  '../shared/icons/icon-192.png',
  '../shared/icons/icon-512.png',
  '../shared/icons/apple-touch-icon.png',
];

/* ── Install: cache app shell ──────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: network-first for data/CDN, cache-first for local assets ── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Data requests + CDN (Leaflet, proxy, OSRM, tile servers) — network first
  if (url.hostname !== location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell / local assets — cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
