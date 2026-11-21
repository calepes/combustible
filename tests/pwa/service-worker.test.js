import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

function loadWorker() {
  const handlers = new Map();
  const cache = { addAll: vi.fn(), match: vi.fn(), put: vi.fn().mockResolvedValue() };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(['combustible-cards-v18', 'combustible-cards-v17', 'combustible-map-v12', 'otra-app-v1']),
    delete: vi.fn().mockResolvedValue(true),
  };
  const self = {
    addEventListener: (event, handler) => handlers.set(event, handler),
    location: { origin: 'https://app.test' },
    clients: { claim: vi.fn().mockResolvedValue() },
    skipWaiting: vi.fn().mockResolvedValue(),
  };
  const fetch = vi.fn();
  const script = readFileSync('pwa/shared/sw-cache.js', 'utf8');
  runInNewContext(script + "\ninstallFuelCache('combustible-cards-v18', []);", { self, caches, fetch, URL });
  return { handlers, cache, caches, fetch, self };
}

it('deja el stock y los POST fuera de la caché del service worker', () => {
  const { handlers, cache } = loadWorker();
  const respondWith = vi.fn();
  for (const request of [
    new Request('https://proxy.test/api/stations?refresh=1'),
    new Request('https://proxy.test/capacidad', { method: 'POST' }),
  ]) {
    handlers.get('fetch')({ request, respondWith });
  }
  expect(respondWith).not.toHaveBeenCalled();
  expect(cache.put).not.toHaveBeenCalled();
});

it('conserva el recurso estático válido cuando la red devuelve un error', async () => {
  const { handlers, cache, fetch } = loadWorker();
  const valid = new Response('module');
  cache.match.mockResolvedValue(valid);
  fetch.mockResolvedValue(new Response('', { status: 503 }));
  const respondWith = vi.fn();
  handlers.get('fetch')({
    request: new Request('https://app.test/pwa/shared/fetchers.js'),
    respondWith,
  });
  await expect(respondWith.mock.calls[0][0]).resolves.toBe(valid);
  expect(cache.put).not.toHaveBeenCalled();
});

it('elimina solo versiones antiguas de la propia caché', async () => {
  const { handlers, caches, self } = loadWorker();
  const waitUntil = vi.fn();
  handlers.get('activate')({ waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(caches.delete.mock.calls).toEqual([['combustible-cards-v17']]);
  expect(self.clients.claim).toHaveBeenCalledOnce();
});
