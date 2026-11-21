import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  haversineKm,
  getDistances,
  osrmDistances,
  fetchAllStations,
  getNavUrl,
  coalesceRefresh,
} from '../../pwa/shared/fetchers.js';

afterEach(() => vi.unstubAllGlobals());

describe('stock agregado', () => {
  const station = {
    name: 'Vangas', type: 'genex', company: 'Genex', lat: -17.77, lon: -63.21,
    waze: 'https://waze.com/ul?q=Vangas&navigate=yes',
  };

  function setupStorage() {
    const data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => data.get(key) ?? '{}',
      setItem: (key, value) => data.set(key, value),
    });
  }

  function response(litros, observedAt, status = 'fresh') {
    return Response.json([{
      name: station.name, litros: status === 'fresh' ? litros : 0, capacidad: 9000,
      stock: { litros, observedAt, status },
    }]);
  }

  it('actualiza stock y hora con una llamada y conserva navegación y coordenadas', async () => {
    setupStorage();
    vi.stubGlobal('navigator', { userAgent: 'iPhone' });
    const fetch = vi.fn()
      .mockImplementationOnce(() => response(3000, 1000))
      .mockImplementationOnce(() => response(9000, 2000));
    vi.stubGlobal('fetch', fetch);
    const [first] = await fetchAllStations([station]);
    const [second] = await fetchAllStations([station], { refresh: true });
    expect(first).toMatchObject({ litros: 3000, observedAt: 1000 });
    expect(second).toMatchObject({
      litros: 9000, observedAt: 2000, lat: station.lat, lon: station.lon, waze: station.waze,
    });
    expect(getNavUrl(second)).toBe(station.waze);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(fetch.mock.calls[1][0]).pathname).toBe('/api/stations');
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('refresh')).toBe('1');
  });

  it('conserva el dato más nuevo tras un error de red, HTTP o respuesta anterior, y acepta cero real', async () => {
    setupStorage();
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => response(9000, 2000))
      .mockRejectedValueOnce(new TypeError('Sin red'))
      .mockImplementationOnce(() => new Response('', { status: 503 }))
      .mockImplementationOnce(() => response(3000, 1000))
      .mockImplementationOnce(() => Response.json([{ name: station.name, litros: 9500 }]))
      .mockImplementationOnce(() => response(0, 3000)));
    await fetchAllStations([station]);
    for (let attempt = 0; attempt < 4; attempt++) {
      const [fallback] = await fetchAllStations([station], { refresh: true });
      expect(fallback).toMatchObject({ litros: 9000, observedAt: 2000, status: 'stale', available: false });
    }
    const [zero] = await fetchAllStations([station], { refresh: true });
    expect(zero).toMatchObject({ litros: 0, observedAt: 3000, status: 'fresh', available: false });
  });

  it('muestra ausencia de lectura si falla sin respaldo', async () => {
    setupStorage();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Sin red')));
    const [row] = await fetchAllStations([{ ...station, name: 'Sin historial' }]);
    expect(row).toMatchObject({ litros: null, observedAt: null, status: 'unknown', available: false });
  });

  it('agrupa refrescos solapados hasta terminar de pintar y vuelve a aceptar otro tras un error', async () => {
    let reject;
    const first = new Promise((_, fail) => { reject = fail; });
    const paint = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce('nuevo');
    const refresh = coalesceRefresh(paint);
    const initial = refresh();
    expect(refresh({ refresh: true })).toBe(initial);
    expect(paint).toHaveBeenCalledTimes(1);
    reject(new Error('No se pudo pintar'));
    await expect(initial).rejects.toThrow('No se pudo pintar');
    await expect(refresh({ refresh: true })).resolves.toBe('nuevo');
    expect(paint).toHaveBeenCalledTimes(2);
  });
});

/* ── haversineKm ─────────────────────── */

describe('haversineKm', () => {
  it('retorna 0 para el mismo punto', () => {
    expect(haversineKm(-17.78, -63.18, -17.78, -63.18)).toBe(0);
  });

  it('calcula distancia conocida (SCZ centro a Pirai ~5km)', () => {
    const dist = haversineKm(-17.7833, -63.1821, -17.7642, -63.1350);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(7);
  });

  it('calcula distancia larga (SCZ a La Paz ~550km)', () => {
    const dist = haversineKm(-17.78, -63.18, -16.50, -68.15);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(600);
  });

  it('es simetrica', () => {
    const d1 = haversineKm(-17.78, -63.18, -16.50, -68.15);
    const d2 = haversineKm(-16.50, -68.15, -17.78, -63.18);
    expect(d1).toBeCloseTo(d2, 6);
  });
});

/* ── stations.js ─────────────────────── */

describe('stations config', () => {
  it('exporta STATIONS como array no vacio', async () => {
    const { STATIONS } = await import('../../pwa/shared/stations.js');
    expect(Array.isArray(STATIONS)).toBe(true);
    expect(STATIONS.length).toBeGreaterThan(0);
  });

  it('cada estacion tiene campos requeridos', async () => {
    const { STATIONS } = await import('../../pwa/shared/stations.js');
    for (const s of STATIONS) {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('company');
      expect(s).toHaveProperty('lat');
      expect(s).toHaveProperty('lon');
      expect(s).toHaveProperty('url');
      expect(s).toHaveProperty('waze');
      expect(['genex', 'ec2', 'gasgroup', 'gsheets']).toContain(s.type);
    }
  });

  it('coordenadas estan en rango de Santa Cruz', async () => {
    const { STATIONS } = await import('../../pwa/shared/stations.js');
    for (const s of STATIONS) {
      expect(s.lat).toBeGreaterThan(-19);
      expect(s.lat).toBeLessThan(-16);
      expect(s.lon).toBeGreaterThan(-64);
      expect(s.lon).toBeLessThan(-62);
    }
  });

  it('GASGROUP_MIN_LITROS es 1500', async () => {
    const { GASGROUP_MIN_LITROS } = await import('../../pwa/shared/stations.js');
    expect(GASGROUP_MIN_LITROS).toBe(1500);
  });
});


describe('distancias con OSRM', () => {
  it('estima una ruta ausente y conserva una ruta de cero metros', async () => {
    vi.stubGlobal('google', undefined);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ code: 'Ok', distances: [[0, null, 0, 2000]] }),
    })));
    const stations = [{ lat: 0, lon: 0.01 }, { lat: 0, lon: 0 }, { lat: 0, lon: 0.02 }];
    try {
      expect(await osrmDistances(0, 0, stations)).toEqual([null, 0, 2]);
      const distances = await getDistances(0, 0, stations);
      expect(distances[0].distKm).toBeCloseTo(1.112, 3);
      expect(distances[0].distanceEstimated).toBe(true);
      expect(distances.slice(1).map(({ distKm, distanceEstimated }) => (
        [distKm, distanceEstimated]
      ))).toEqual([[0, false], [2, false]]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
