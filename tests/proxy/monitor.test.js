import { describe, it, expect } from 'vitest';
import { evaluateStation } from '../../proxy/worker.js';
import worker from '../../proxy/worker.js';

function mkKV(initial = {}) {
  const store = { ...initial };
  return {
    async get(k, opts) { const v = store[k] ?? null; return opts?.type === 'json' && v ? JSON.parse(v) : v; },
    async put(k, v) { store[k] = v; },
    _store: store,
  };
}
function req(method, path, body, headers = {}) {
  const opts = { method, headers: { ...headers } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return new Request(`https://x.test${path}`, opts);
}

const cfg = { defaultMinLitros: 1500, reminderHours: 3, maxReminders: 2 };
const st = { name: 'Urubó', minLitros: 1500 };
const H = 3600e3;

describe('evaluateStation', () => {
  it('flanco de subida: vacío → disponible dispara alert', () => {
    const prev = { available: false, since: null, lastNotified: null, remindersSent: 0, lastLitros: 0 };
    const r = evaluateStation(prev, 12300, st, cfg, 1000);
    expect(r.action).toBe('alert');
    expect(r.nextState.available).toBe(true);
    expect(r.nextState.since).toBe(1000);
    expect(r.nextState.remindersSent).toBe(0);
  });

  it('bajo umbral no dispara nada', () => {
    const prev = { available: false, since: null, lastNotified: null, remindersSent: 0, lastLitros: 0 };
    const r = evaluateStation(prev, 800, st, cfg, 1000);
    expect(r.action).toBe(null);
    expect(r.nextState.available).toBe(false);
  });

  it('sin prev (undefined) trata como vacío', () => {
    const r = evaluateStation(undefined, 5000, st, cfg, 1000);
    expect(r.action).toBe('alert');
  });

  it('sigue disponible antes de reminderHours: sin acción', () => {
    const prev = { available: true, since: 0, lastNotified: 0, remindersSent: 0, lastLitros: 9000 };
    const r = evaluateStation(prev, 9000, st, cfg, 2 * H);
    expect(r.action).toBe(null);
    expect(r.nextState.lastLitros).toBe(9000);
  });

  it('sigue disponible tras reminderHours: reminder + incrementa', () => {
    const prev = { available: true, since: 0, lastNotified: 0, remindersSent: 0, lastLitros: 9000 };
    const r = evaluateStation(prev, 8000, st, cfg, 3 * H);
    expect(r.action).toBe('reminder');
    expect(r.nextState.remindersSent).toBe(1);
    expect(r.nextState.lastNotified).toBe(3 * H);
  });

  it('respeta maxReminders', () => {
    const prev = { available: true, since: 0, lastNotified: 0, remindersSent: 2, lastLitros: 9000 };
    const r = evaluateStation(prev, 8000, st, cfg, 10 * H);
    expect(r.action).toBe(null);
  });

  it('flanco de bajada resetea en silencio', () => {
    const prev = { available: true, since: 0, lastNotified: 0, remindersSent: 1, lastLitros: 9000 };
    const r = evaluateStation(prev, 0, st, cfg, 5 * H);
    expect(r.action).toBe(null);
    expect(r.nextState.available).toBe(false);
    expect(r.nextState.since).toBe(null);
    expect(r.nextState.remindersSent).toBe(0);
  });

  it('minLitros por estación pisa al default', () => {
    const r = evaluateStation(undefined, 2000, { name: 'X', minLitros: 5000 }, cfg, 1000);
    expect(r.action).toBe(null);
  });
});

describe('/monitor/config', () => {
  it('GET siembra defaults: 27 estaciones, 3 enabled', async () => {
    const env = { CAPACIDAD: mkKV(), MONITOR_TOKEN: 'sek' };
    const resp = await worker.fetch(req('GET', '/monitor/config'), env);
    const cfg = await resp.json();
    expect(resp.status).toBe(200);
    expect(cfg.stations.length).toBe(27);
    expect(cfg.stations.filter(s => s.enabled).map(s => s.name).sort())
      .toEqual(['Equipetrol', 'Urubó', 'Vangas']);
    expect(cfg.checkIntervalMin).toBe(5);
  });

  it('POST sin token → 403', async () => {
    const env = { CAPACIDAD: mkKV(), MONITOR_TOKEN: 'sek' };
    const resp = await worker.fetch(req('POST', '/monitor/config', { reminderHours: 4 }), env);
    expect(resp.status).toBe(403);
  });

  it('POST con token hace merge parcial top-level', async () => {
    const env = { CAPACIDAD: mkKV(), MONITOR_TOKEN: 'sek' };
    await worker.fetch(req('GET', '/monitor/config'), env); // siembra
    const resp = await worker.fetch(req('POST', '/monitor/config', { reminderHours: 4 }, { 'X-Monitor-Token': 'sek' }), env);
    const cfg = await resp.json();
    expect(resp.status).toBe(200);
    expect(cfg.reminderHours).toBe(4);
    expect(cfg.stations.length).toBe(27);
  });

  it('POST merge por estación (enabled/minLitros)', async () => {
    const env = { CAPACIDAD: mkKV(), MONITOR_TOKEN: 'sek' };
    await worker.fetch(req('GET', '/monitor/config'), env);
    const resp = await worker.fetch(req('POST', '/monitor/config',
      { stations: [{ name: 'Pirai', enabled: true }] }, { 'X-Monitor-Token': 'sek' }), env);
    const cfg = await resp.json();
    expect(cfg.stations.find(s => s.name === 'Pirai').enabled).toBe(true);
    expect(cfg.stations.find(s => s.name === 'Urubó').enabled).toBe(true); // intacto
  });

  it('POST estación desconocida → 400', async () => {
    const env = { CAPACIDAD: mkKV(), MONITOR_TOKEN: 'sek' };
    await worker.fetch(req('GET', '/monitor/config'), env);
    const resp = await worker.fetch(req('POST', '/monitor/config',
      { stations: [{ name: 'NoExiste', enabled: true }] }, { 'X-Monitor-Token': 'sek' }), env);
    expect(resp.status).toBe(400);
  });
});
