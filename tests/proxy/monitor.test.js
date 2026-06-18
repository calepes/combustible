import { describe, it, expect } from 'vitest';
import { evaluateStation } from '../../proxy/worker.js';

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
