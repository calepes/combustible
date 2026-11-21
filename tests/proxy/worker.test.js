import { afterEach, describe, it, expect, vi } from 'vitest';
import { STATIONS } from '../../pwa/shared/stations.js';

/**
 * Tests para la logica de capacidad del worker (Cloudflare KV).
 * Se importa el worker como modulo y se mockean Request, env.CAPACIDAD (KV).
 */

/* ── Mock de KV ──────────────────────── */

function createMockKV(initial = {}) {
  const store = { ...initial };
  return {
    async get(key) {
      return store[key] ?? null;
    },
    async put(key, value) {
      store[key] = value;
    },
    _store: store,
  };
}

function makeEnv(kvData = {}) {
  const raw = Object.keys(kvData).length > 0
    ? { capacidad_max: JSON.stringify(kvData) }
    : {};
  return { CAPACIDAD: createMockKV(raw) };
}

/* ── Import worker ───────────────────── */

import worker from '../../proxy/worker.js';

function makeRequest(method, path, body) {
  const url = `https://combustible-proxy.test${path}`;
  const opts = { method };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  return new Request(url, opts);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GET /api/stations', () => {
  const stationRow = (name, liters) =>
    `<span class="station_name">${name}</span><span class="product_name">G. ESPECIAL+</span>${liters == null ? '' : `<span class="product_volume">${liters} litros</span>`}`;

  it('reutiliza una lectura dentro de la vigencia y vuelve a consultar al actualizar', async () => {
    const env = makeEnv();
    let liters = 3000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const fetchSource = vi.fn(async (address) => {
      const url = new URL(address);
      if (url.hostname !== 'genex.com.bo') return new Response('', { status: 503 });
      return new Response(url.search ? stationRow('GENEX I', 7000) : stationRow('VANGAS', liters));
    });
    vi.stubGlobal('fetch', fetchSource);

    const find = async (path, name) => (await (await worker.fetch(makeRequest('GET', path), env)).json())
      .find((row) => row.name === name);
    expect(await find('/api/stations', 'Vangas')).toMatchObject({
      litros: 3000, capacidad: 3000, stock: { litros: 3000, observedAt: 100_000, status: 'fresh' },
    });
    expect(fetchSource).toHaveBeenCalledTimes(new Set(STATIONS.map((s) => s.url)).size);
    const banzer = await find('/api/stations', 'Genex Banzer');
    expect(banzer).toMatchObject({ litros: 7000, lat: expect.any(Number), lon: expect.any(Number) });

    now.mockReturnValue(112_000);
    liters = 9000;
    expect((await find('/api/stations', 'Vangas')).stock.observedAt).toBe(100_000);
    expect(fetchSource).toHaveBeenCalledTimes(5);
    expect(await find('/api/stations?refresh=1', 'Vangas')).toMatchObject({
      litros: 9000, capacidad: 9000, stock: { litros: 9000, observedAt: 112_000, status: 'fresh' },
    });
    expect(fetchSource).toHaveBeenCalledTimes(10);
  });

  it('conserva la última lectura válida ante un fallo y luego acepta cero como lectura nueva', async () => {
    const env = makeEnv();
    let failure = false;
    let liters = 3000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    vi.stubGlobal('fetch', vi.fn(async (address) => new URL(address).hostname === 'genex.com.bo' && !failure
      ? new Response(stationRow('VANGAS', liters))
      : new Response('', { status: 503 })));
    const refresh = async () => (await (await worker.fetch(makeRequest('GET', '/api/stations?refresh=1'), env)).json())
      .find((row) => row.name === 'Vangas');
    await refresh();
    now.mockReturnValue(102_000);
    failure = true;
    expect(await refresh()).toMatchObject({
      litros: 0, capacidad: 3000, stock: { litros: 3000, observedAt: 100_000, status: 'stale' },
    });
    now.mockReturnValue(104_000);
    failure = false;
    liters = 0;
    expect(await refresh()).toMatchObject({
      litros: 0, capacidad: 3000, stock: { litros: 0, observedAt: 104_000, status: 'fresh' },
    });
  });

  it('no asigna a una estación el volumen de la siguiente ni registra ese valor como capacidad', async () => {
    const env = makeEnv();
    const html = stationRow('VANGAS', null) + stationRow('GENEX GUARACACHI', '9,000');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(html)));
    const rows = await (await worker.fetch(makeRequest('GET', '/api/stations'), env)).json();
    expect(rows).toHaveLength(27);
    expect(rows.find((row) => row.name === 'Vangas')).toMatchObject({
      litros: 0, capacidad: 0, stock: { litros: null, observedAt: null, status: 'unknown' },
    });
    expect(rows.find((row) => row.name === 'Genex Guaracachi').litros).toBe(9000);
    expect(JSON.parse(env.CAPACIDAD._store.capacidad_max)).not.toHaveProperty('Vangas');
  });
});

/* ── Tests ────────────────────────────── */

describe('GET /capacidad', () => {
  it('devuelve mapa vacio si KV esta vacio', async () => {
    const env = makeEnv();
    const resp = await worker.fetch(makeRequest('GET', '/capacidad'), env);
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({});
  });

  it('devuelve mapa existente desde KV', async () => {
    const data = { 'Genex Banzer': 15000, 'Vangas': 12000 };
    const env = makeEnv(data);
    const resp = await worker.fetch(makeRequest('GET', '/capacidad'), env);
    expect(await resp.json()).toEqual(data);
  });

  it('incluye headers CORS', async () => {
    const env = makeEnv();
    const resp = await worker.fetch(makeRequest('GET', '/capacidad'), env);
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('POST /capacidad', () => {
  it('guarda nuevo maximo en KV vacio', async () => {
    const env = makeEnv();
    const entries = [{ name: 'Genex Banzer', litros: 8000 }];
    const resp = await worker.fetch(makeRequest('POST', '/capacidad', entries), env);
    const result = await resp.json();
    expect(result).toEqual({ 'Genex Banzer': 8000 });
  });

  it('actualiza si el valor es mayor', async () => {
    const env = makeEnv({ 'Genex Banzer': 8000 });
    const entries = [{ name: 'Genex Banzer', litros: 10000 }];
    const resp = await worker.fetch(makeRequest('POST', '/capacidad', entries), env);
    const result = await resp.json();
    expect(result['Genex Banzer']).toBe(10000);
  });

  it('no actualiza si el valor es menor', async () => {
    const env = makeEnv({ 'Genex Banzer': 10000 });
    const entries = [{ name: 'Genex Banzer', litros: 5000 }];
    const resp = await worker.fetch(makeRequest('POST', '/capacidad', entries), env);
    const result = await resp.json();
    expect(result['Genex Banzer']).toBe(10000);
  });

  it('ignora entries con litros <= 0', async () => {
    const env = makeEnv();
    const entries = [
      { name: 'Genex Banzer', litros: 0 },
      { name: 'Vangas', litros: -100 },
    ];
    const resp = await worker.fetch(makeRequest('POST', '/capacidad', entries), env);
    const result = await resp.json();
    expect(result).toEqual({});
  });

  it('ignora entries sin nombre', async () => {
    const env = makeEnv();
    const entries = [{ litros: 5000 }];
    const resp = await worker.fetch(makeRequest('POST', '/capacidad', entries), env);
    expect(await resp.json()).toEqual({});
  });

  it('maneja multiples estaciones en un request', async () => {
    const env = makeEnv({ 'Genex Banzer': 8000 });
    const entries = [
      { name: 'Genex Banzer', litros: 12000 },
      { name: 'Vangas', litros: 6000 },
      { name: 'Equipetrol', litros: 9500 },
    ];
    const resp = await worker.fetch(makeRequest('POST', '/capacidad', entries), env);
    const result = await resp.json();
    expect(result).toEqual({
      'Genex Banzer': 12000,
      'Vangas': 6000,
      'Equipetrol': 9500,
    });
  });

  it('redondea litros decimales', async () => {
    const env = makeEnv();
    const entries = [{ name: 'Urubó', litros: 3456.78 }];
    const resp = await worker.fetch(makeRequest('POST', '/capacidad', entries), env);
    const result = await resp.json();
    expect(result['Urubó']).toBe(3457);
  });

  it('retorna 400 para JSON invalido', async () => {
    const env = makeEnv();
    const req = new Request('https://combustible-proxy.test/capacidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(400);
  });

  it('retorna 400 si body no es array', async () => {
    const env = makeEnv();
    const resp = await worker.fetch(
      makeRequest('POST', '/capacidad', { name: 'test', litros: 100 }),
      env
    );
    expect(resp.status).toBe(400);
  });
});

describe('DELETE /capacidad', () => {
  it('retorna 405 para metodos no permitidos', async () => {
    const env = makeEnv();
    const req = new Request('https://combustible-proxy.test/capacidad', {
      method: 'DELETE',
    });
    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(405);
  });
});

describe('OPTIONS (CORS preflight)', () => {
  it('responde 204 con headers CORS', async () => {
    const env = makeEnv();
    const resp = await worker.fetch(makeRequest('OPTIONS', '/capacidad'), env);
    expect(resp.status).toBe(204);
    expect(resp.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('proxy route (sin /capacidad)', () => {
  it('retorna 400 si falta ?url=', async () => {
    const env = makeEnv();
    const resp = await worker.fetch(makeRequest('GET', '/'), env);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('Missing ?url= parameter');
  });

  it('retorna 403 para dominio no permitido', async () => {
    const env = makeEnv();
    const resp = await worker.fetch(
      makeRequest('GET', '/?url=' + encodeURIComponent('https://evil.com/data')),
      env
    );
    expect(resp.status).toBe(403);
  });

  it('retorna 400 para URL invalida', async () => {
    const env = makeEnv();
    const resp = await worker.fetch(
      makeRequest('GET', '/?url=not-a-url'),
      env
    );
    expect(resp.status).toBe(400);
  });
});
