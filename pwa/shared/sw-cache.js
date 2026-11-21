function installFuelCache(name, shell) {
  const prefix = name.replace(/\d+$/, '');
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(name).then((cache) => cache.addAll(shell)).then(() => self.skipWaiting()));
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== name).map((key) => caches.delete(key)));
      await self.clients.claim();
    })());
  });

  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    // El lector de stock conserva el valor y su hora juntos, y marca su respaldo como anterior.
    if (request.method !== 'GET' || url.pathname === '/api/stations') return;

    const networkFirst = url.origin !== self.location.origin || request.mode === 'navigate'
      || url.pathname.includes('/shared/') || url.pathname.endsWith('.png');
    event.respondWith((async () => {
      const cache = await caches.open(name);
      if (!networkFirst) {
        const cached = await cache.match(request);
        if (cached) return cached;
      }
      let response;
      try {
        response = await fetch(request);
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
      if (response.ok) {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
        return response;
      }
      return (await cache.match(request)) ?? response;
    })());
  });
}
