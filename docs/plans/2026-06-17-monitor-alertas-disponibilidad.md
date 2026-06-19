# Monitor de alertas de disponibilidad de gasolina — Implementation Plan

> ⛔ **APAGADO 2026-06-19.** Plan implementado y desplegado, pero el monitor se apagó: el cron `* * * * *` quemaba ~576 writes/día de KV (~57% del free tier) → alerta CF "50% daily KV limit". Off vía `crons = []` en `proxy/wrangler.toml` + `enabled:false` en KV `monitor_config`. Reactivar con cron `*/5` (no cada minuto) y `put monitor_state` condicional. Detalle: `CLAUDE.md` raíz.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monitorear cada 5 min las estaciones configuradas y, cuando llega gasolina, avisar a Cal vía Jano (que ofrece menú y permite ajustar config), con parámetros editables por Jano.

**Architecture:** Cron Trigger en el worker `combustible-proxy` (Cloudflare, siempre encendido) detecta el flanco "sin gasolina → con gasolina" usando `evaluateStation()` (función pura) y estado en KV. En vez de mandar Telegram directo, hace `POST /fuel/alert` al worker de Jano, que inyecta un `QueueMessage{kind:"fuel_alert"}` a la cola; el daemon de Jano re-verifica litros, compone el mensaje desde su bot y ofrece el menú. Config (las 27 estaciones, umbrales, frecuencia) vive en KV y se edita vía 3 tools nuevas en el MCP `combustible`.

**Tech Stack:** Cloudflare Workers (`worker.js` vanilla, Hono en `worker-v2`), KV, vitest, TypeScript (MCP + daemon Jano), `@anthropic-ai/claude-agent-sdk`.

**Spec:** `docs/specs/2026-06-17-monitor-alertas-disponibilidad-design.md`

**Repos involucrados (orden de implementación):**
1. `Personal/Apps/Combustible/repo` — worker (detección + config + endpoints)
2. `Personal/Agents/Jano` — shared-v2 + worker-v2 + daemon (recepción + menú)
3. `Personal/MCP Servers/mcp-servers/servers/combustible` — tools de config

---

## Fase 1 — Worker combustible: lógica de monitoreo

### Task 1: `evaluateStation()` — función pura de decisión (TDD)

**Files:**
- Modify: `proxy/worker.js` (agregar export nombrado `evaluateStation`)
- Test: `tests/proxy/monitor.test.js` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/proxy/monitor.test.js`:

```js
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "/Users/calepes/Claude Projects/Personal/Apps/Combustible/repo" && npm test -- monitor`
Expected: FAIL — `evaluateStation is not a function` / no export.

- [ ] **Step 3: Implementar `evaluateStation` en `proxy/worker.js`**

Agregar cerca de la sección de capacidad (antes de `/* ── Router ── */`):

```js
/* ── Monitor: decisión por estación (función pura) ── */

const EMPTY_STATE = { available: false, since: null, lastNotified: null, remindersSent: 0, lastLitros: 0 };

// prev: estado previo o undefined. litros: lectura actual. stationCfg: {name, minLitros?}.
// globalCfg: {defaultMinLitros, reminderHours, maxReminders}. now: epoch ms.
// → { action: 'alert'|'reminder'|null, nextState }
export function evaluateStation(prev, litros, stationCfg, globalCfg, now) {
  const base = prev ?? EMPTY_STATE;
  const minLitros = stationCfg.minLitros ?? globalCfg.defaultMinLitros;
  const available = litros >= minLitros;

  if (!base.available && available) {
    return {
      action: 'alert',
      nextState: { available: true, since: now, lastNotified: now, remindersSent: 0, lastLitros: litros },
    };
  }
  if (base.available && available) {
    const elapsed = base.lastNotified != null ? now - base.lastNotified : Infinity;
    const due = elapsed >= globalCfg.reminderHours * 3600e3;
    if (due && base.remindersSent < globalCfg.maxReminders) {
      return {
        action: 'reminder',
        nextState: { ...base, lastNotified: now, remindersSent: base.remindersSent + 1, lastLitros: litros },
      };
    }
    return { action: null, nextState: { ...base, lastLitros: litros } };
  }
  if (base.available && !available) {
    return { action: null, nextState: { ...EMPTY_STATE, lastLitros: litros } };
  }
  return { action: null, nextState: { ...EMPTY_STATE, lastLitros: litros } };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- monitor`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add proxy/worker.js tests/proxy/monitor.test.js
git commit -m "feat(monitor): evaluateStation función pura de decisión + tests"
```

---

### Task 2: Config en KV + endpoints `/monitor/config` y `/monitor/status`

**Files:**
- Modify: `proxy/worker.js` (seed config, handlers, router; agregar `waze` a `STATIONS`)
- Test: `tests/proxy/monitor.test.js` (agregar bloque de endpoints)

- [ ] **Step 1: Agregar campo `waze` a las 3 estaciones objetivo en `STATIONS` de `proxy/worker.js`**

En el array `STATIONS` del worker, agregar `waze` (copiado de `pwa/shared/stations.js`) a Vangas, Equipetrol y Urubó:

```js
{ name: 'Vangas', type: 'genex', company: 'Genex', lat: -17.7772, lon: -63.2158, url: 'https://genex.com.bo/estaciones/', key: 'VANGAS', fuel: 'G. ESPECIAL+', waze: 'https://waze.com/ul?q=Vangas%20Hernando%20Sanabria%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes' },
// ...
{ name: 'Equipetrol', type: 'ec2', company: 'Biopetrol', lat: -17.7545, lon: -63.1970, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'EQUIPETROL', waze: 'https://waze.com/ul?q=Biopetrol%20Equipetrol%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes' },
// ...
{ name: 'Urubó', type: 'gasgroup', company: 'Orsa', lat: -17.7535, lon: -63.2213, url: 'https://gasgroup.com.bo/estaciones/santacruz', codigo: 'CTqmwWgj', product: 'GASOLINA ESPECIAL', waze: 'https://waze.com/ul?q=Orsa%20Urubo%20Santa%20Cruz%20Bolivia&navigate=yes' },
```

(Las demás estaciones quedan sin `waze`; el mensaje cae a un link de Google Maps por coords si falta — ver Task 6.)

- [ ] **Step 2: Escribir tests de config que fallan**

Agregar al final de `tests/proxy/monitor.test.js`:

```js
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
```

- [ ] **Step 3: Correr y verificar fallo**

Run: `npm test -- monitor`
Expected: FAIL — rutas `/monitor/config` no existen (cae al proxy → 400 "Missing ?url=").

- [ ] **Step 4: Implementar seed + handlers + rutas en `proxy/worker.js`**

Agregar constantes y funciones (tras `evaluateStation`):

```js
const MONITOR_CONFIG_KEY = 'monitor_config';
const MONITOR_STATE_KEY = 'monitor_state';
const MONITOR_LASTRUN_KEY = 'monitor_lastrun';
const DEFAULT_ENABLED = ['Urubó', 'Equipetrol', 'Vangas'];

function seedConfig() {
  return {
    enabled: true,
    checkIntervalMin: 5,
    reminderHours: 3,
    maxReminders: 2,
    quietHours: { enabled: false, start: 22, end: 6 },
    chatId: 94137698,
    defaultMinLitros: 1500,
    stations: STATIONS.map((s) => ({
      name: s.name,
      enabled: DEFAULT_ENABLED.includes(s.name),
      minLitros: 1500,
    })),
  };
}

async function getConfig(env) {
  const raw = await env.CAPACIDAD.get(MONITOR_CONFIG_KEY);
  if (raw) return JSON.parse(raw);
  const seeded = seedConfig();
  await env.CAPACIDAD.put(MONITOR_CONFIG_KEY, JSON.stringify(seeded));
  return seeded;
}

async function handleMonitorConfigGet(env) {
  const cfg = await getConfig(env);
  return new Response(JSON.stringify(cfg), { headers: JSON_HEADERS });
}

async function handleMonitorConfigPost(request, env) {
  const token = request.headers.get('X-Monitor-Token');
  if (!env.MONITOR_TOKEN || token !== env.MONITOR_TOKEN) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: JSON_HEADERS });
  }
  let patch;
  try { patch = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: JSON_HEADERS });
  }
  const cfg = await getConfig(env);
  const validNames = new Set(STATIONS.map((s) => s.name));

  if (patch.stations) {
    for (const ps of patch.stations) {
      if (!validNames.has(ps.name)) {
        return new Response(JSON.stringify({ error: 'Unknown station', name: ps.name }), { status: 400, headers: JSON_HEADERS });
      }
      const cur = cfg.stations.find((s) => s.name === ps.name);
      if (ps.enabled !== undefined) cur.enabled = ps.enabled;
      if (ps.minLitros !== undefined) cur.minLitros = ps.minLitros;
    }
  }
  for (const k of ['enabled', 'checkIntervalMin', 'reminderHours', 'maxReminders', 'quietHours', 'chatId', 'defaultMinLitros']) {
    if (patch[k] !== undefined) cfg[k] = patch[k];
  }
  await env.CAPACIDAD.put(MONITOR_CONFIG_KEY, JSON.stringify(cfg));
  return new Response(JSON.stringify(cfg), { headers: JSON_HEADERS });
}

async function handleMonitorStatus(env) {
  const cfg = await getConfig(env);
  const data = await fetchAllStationsData(env); // [{name, company, litros, capacidad, ...}]
  const stateRaw = await env.CAPACIDAD.get(MONITOR_STATE_KEY);
  const state = stateRaw ? JSON.parse(stateRaw) : {};
  const byName = Object.fromEntries(data.map((d) => [d.name, d]));
  const stations = cfg.stations.map((s) => {
    const d = byName[s.name] || {};
    const minLitros = s.minLitros ?? cfg.defaultMinLitros;
    return {
      name: s.name,
      company: d.company || '',
      enabled: s.enabled,
      minLitros,
      litros: d.litros || 0,
      available: (d.litros || 0) >= minLitros,
      since: state[s.name]?.since ?? null,
    };
  });
  return new Response(JSON.stringify({ stations }), { headers: JSON_HEADERS });
}
```

En el router (`export default { async fetch }`), antes de `return handleProxy(url);`:

```js
    if (url.pathname === '/monitor/config') {
      if (request.method === 'GET') return handleMonitorConfigGet(env);
      if (request.method === 'POST') return handleMonitorConfigPost(request, env);
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
    }
    if (url.pathname === '/monitor/status') {
      if (request.method === 'GET') return handleMonitorStatus(env);
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
    }
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npm test -- monitor`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add proxy/worker.js tests/proxy/monitor.test.js
git commit -m "feat(monitor): config en KV + endpoints /monitor/config y /monitor/status"
```

---

### Task 3: Handler `scheduled()` + estado + gate + POST a Jano

**Files:**
- Modify: `proxy/worker.js` (handler `scheduled`, helper `runMonitor`, `buildAlertEvent`)
- Modify: `proxy/wrangler.toml` (`[triggers] crons`, var `JANO_ALERT_URL`)
- Test: `tests/proxy/monitor.test.js` (test de `runMonitor` con fetch mockeado)

- [ ] **Step 1: Escribir test de `runMonitor` que falla**

Agregar a `tests/proxy/monitor.test.js`:

```js
import { runMonitor } from '../../proxy/worker.js';

describe('runMonitor', () => {
  it('dispara POST a Jano solo para estaciones enabled con flanco de subida', async () => {
    const cfg = {
      enabled: true, checkIntervalMin: 5, reminderHours: 3, maxReminders: 2,
      quietHours: { enabled: false }, defaultMinLitros: 1500, chatId: 1,
      stations: [
        { name: 'Urubó', enabled: true, minLitros: 1500 },
        { name: 'Pirai', enabled: false, minLitros: 1500 },
      ],
    };
    const env = {
      CAPACIDAD: mkKV({ monitor_config: JSON.stringify(cfg) }),
      JANO_ALERT_URL: 'https://jano.test/fuel/alert',
      FUEL_ALERT_SECRET: 'fs',
    };
    const posted = [];
    const stationData = [
      { name: 'Urubó', company: 'Orsa', litros: 12000, capacidad: 20000 },
      { name: 'Pirai', company: 'Biopetrol', litros: 9000, capacidad: 20000 },
    ];
    const fakeFetch = async (u, opts) => { posted.push({ u, body: JSON.parse(opts.body) }); return { ok: true }; };

    await runMonitor(env, 100000, { fetchStations: async () => stationData, fetchImpl: fakeFetch });

    expect(posted.length).toBe(1);
    expect(posted[0].u).toBe('https://jano.test/fuel/alert');
    expect(posted[0].body.events).toHaveLength(1);
    expect(posted[0].body.events[0].name).toBe('Urubó');
    expect(posted[0].body.events[0].kind).toBe('alert');
  });

  it('respeta el gate de checkIntervalMin', async () => {
    const cfg = { enabled: true, checkIntervalMin: 5, reminderHours: 3, maxReminders: 2,
      quietHours: { enabled: false }, defaultMinLitros: 1500, stations: [] };
    const env = { CAPACIDAD: mkKV({ monitor_config: JSON.stringify(cfg), monitor_lastrun: '99000' }) };
    let called = false;
    await runMonitor(env, 100000, { fetchStations: async () => { called = true; return []; }, fetchImpl: async () => ({ ok: true }) });
    expect(called).toBe(false); // 100000-99000 = 1s < 5min
  });
});
```

- [ ] **Step 2: Correr y verificar fallo**

Run: `npm test -- monitor`
Expected: FAIL — `runMonitor is not a function`.

- [ ] **Step 3: Implementar `runMonitor`, `buildAlertEvent` y `scheduled` en `proxy/worker.js`**

```js
function buildAlertEvent(stationMeta, dataRow, action, nextState) {
  return {
    name: stationMeta.name,
    company: dataRow.company || '',
    litros: dataRow.litros || 0,
    lat: stationMeta.lat,
    lon: stationMeta.lon,
    waze: stationMeta.waze || null,
    kind: action, // 'alert' | 'reminder'
    since: nextState.since,
  };
}

// deps inyectables para test: { fetchStations, fetchImpl }
export async function runMonitor(env, now, deps = {}) {
  const fetchStations = deps.fetchStations || (() => fetchAllStationsData(env));
  const fetchImpl = deps.fetchImpl || fetch;

  const cfg = await getConfig(env);
  if (!cfg.enabled) return;

  // Gate checkIntervalMin
  const lastRunRaw = await env.CAPACIDAD.get(MONITOR_LASTRUN_KEY);
  const lastRun = lastRunRaw ? Number(lastRunRaw) : 0;
  if (now - lastRun < cfg.checkIntervalMin * 60_000) return;
  await env.CAPACIDAD.put(MONITOR_LASTRUN_KEY, String(now));

  const data = await fetchStations();
  const byName = Object.fromEntries(data.map((d) => [d.name, d]));
  const metaByName = Object.fromEntries(STATIONS.map((s) => [s.name, s]));

  const stateRaw = await env.CAPACIDAD.get(MONITOR_STATE_KEY);
  const state = stateRaw ? JSON.parse(stateRaw) : {};

  // Quiet hours (hora local SCZ = UTC-4)
  let quiet = false;
  if (cfg.quietHours?.enabled) {
    const h = (new Date(now).getUTCHours() + 24 - 4) % 24;
    const { start, end } = cfg.quietHours;
    quiet = start <= end ? (h >= start && h < end) : (h >= start || h < end);
  }

  const events = [];
  for (const sc of cfg.stations) {
    if (!sc.enabled) continue;
    const row = byName[sc.name];
    if (!row) continue;
    const { action, nextState } = evaluateStation(state[sc.name], row.litros || 0, sc, cfg, now);
    state[sc.name] = nextState;
    if (action && !quiet) events.push(buildAlertEvent(metaByName[sc.name] || sc, row, action, nextState));
  }

  let delivered = true;
  if (events.length && env.JANO_ALERT_URL) {
    try {
      const resp = await fetchImpl(env.JANO_ALERT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Fuel-Secret': env.FUEL_ALERT_SECRET || '' },
        body: JSON.stringify({ events }),
      });
      delivered = resp.ok;
    } catch { delivered = false; }
  }

  // Si la entrega falló, revertir lastNotified de los eventos para reintentar el próximo tick
  if (!delivered) {
    for (const ev of events) {
      const prev = state[ev.name];
      if (prev) { prev.lastNotified = null; if (ev.kind === 'alert') prev.available = false; }
    }
  }
  await env.CAPACIDAD.put(MONITOR_STATE_KEY, JSON.stringify(state));
}
```

Agregar `scheduled` al `export default`:

```js
export default {
  async fetch(request, env) { /* ...existente... */ },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env, Date.now()));
  },
};
```

> Nota: `export default { async fetch }` ya existe — convertir a objeto con ambos métodos manteniendo el `fetch` actual intacto.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- monitor`
Expected: PASS.

- [ ] **Step 5: Configurar cron + var en `proxy/wrangler.toml`**

```toml
name = "combustible-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["* * * * *"]

[vars]
JANO_ALERT_URL = "https://mcp-telegram.carlos-cb4.workers.dev/fuel/alert"

[[kv_namespaces]]
binding = "CAPACIDAD"
id = "67bd8d72166d4f46b046cf0fc3286b93"
```

> ⚠️ Confirmar la URL real del worker de Jano antes de deploy (ver Task 5; ajustar si el endpoint vive en otro host). `FUEL_ALERT_SECRET` y `MONITOR_TOKEN` se setean como secrets en Task 9, no en `vars`.

- [ ] **Step 6: Commit**

```bash
git add proxy/worker.js proxy/wrangler.toml tests/proxy/monitor.test.js
git commit -m "feat(monitor): scheduled() + runMonitor + gate + POST /fuel/alert a Jano"
```

---

## Fase 2 — Jano: recepción de alertas

> Repo: `/Users/calepes/Claude Projects/Personal/Agents/Jano`

### Task 4: Extender tipos compartidos (`shared-v2`)

**Files:**
- Modify: `shared-v2/src/types.ts`

- [ ] **Step 1: Agregar tipo `FuelEvent` y extender `QueueMessage`**

En `shared-v2/src/types.ts`, reemplazar la interfaz `QueueMessage` actual:

```ts
export interface FuelEvent {
  name: string;
  company: string;
  litros: number;
  lat?: number;
  lon?: number;
  waze?: string | null;
  kind: "alert" | "reminder";
  since: number | null;
}

export interface QueueMessage {
  kind: "telegram_update" | "fuel_alert";
  payload: TelegramUpdate | { events: FuelEvent[] };
  ts: number;
}
```

- [ ] **Step 2: Build de shared**

Run: `cd "/Users/calepes/Claude Projects/Personal/Agents/Jano" && npm -w @cos/shared run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add shared-v2/src/types.ts
git commit -m "feat(fuel): tipo FuelEvent + kind fuel_alert en QueueMessage"
```

---

### Task 5: Endpoint `/fuel/alert` en `worker-v2`

**Files:**
- Modify: `worker-v2/src/index.ts`

- [ ] **Step 1: Agregar `FUEL_ALERT_SECRET` a la interfaz `Env`**

En `worker-v2/src/index.ts`, dentro de `interface Env { ... }`:

```ts
  FUEL_ALERT_SECRET: string;
```

- [ ] **Step 2: Agregar la ruta `/fuel/alert` (antes de `export default app;`)**

```ts
// POST /fuel/alert — el worker combustible reporta llegada de gasolina.
// Auth: header X-Fuel-Secret == FUEL_ALERT_SECRET.
app.post("/fuel/alert", async (c) => {
  const secret = c.req.header("X-Fuel-Secret") ?? null;
  if (!secret || secret !== c.env.FUEL_ALERT_SECRET) {
    return c.text("unauthorized", 401);
  }
  let body: { events?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "bad_json" }, 400); }
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length === 0) {
    return c.json({ error: "bad_request" }, 400);
  }
  const msg: QueueMessage = { kind: "fuel_alert", payload: { events } as never, ts: Date.now() };
  await c.env.INBOX.send(msg);
  return c.json({ ok: true });
});
```

- [ ] **Step 3: Deploy del worker (se hace en Task 9; aquí solo verificar typecheck)**

Run: `cd "/Users/calepes/Claude Projects/Personal/Agents/Jano" && npx tsc -p worker-v2/tsconfig.json --noEmit 2>&1 | head` (si existe tsconfig; si no, `npm -w @cos/daemon run build` no cubre worker — verificar con wrangler en Task 9).
Expected: sin errores de tipo en la nueva ruta.

- [ ] **Step 4: Commit**

```bash
git add worker-v2/src/index.ts
git commit -m "feat(fuel): endpoint /fuel/alert inyecta fuel_alert al INBOX"
```

---

### Task 6: Dispatch `fuel_alert` + re-check de frescura en el daemon

**Files:**
- Create: `daemon-v2/src/proactive/fuel-alert.ts`
- Modify: `daemon-v2/src/index.ts` (branch en el loop)

- [ ] **Step 1: Crear `daemon-v2/src/proactive/fuel-alert.ts`**

```ts
import type { WarmQuery } from "@anthropic-ai/claude-agent-sdk";
import type { FuelEvent } from "@cos/shared";
import { runAgent } from "../agent.js";

const STATUS_URL = "https://combustible-proxy.carlos-cb4.workers.dev/monitor/status";

export interface FuelAlertDeps {
  takeWarm: () => Promise<WarmQuery>;
  setCurrentChatId: (id: number) => void;
  chatId: number;
}

// Re-verifica litros actuales; devuelve solo eventos cuya estación sigue disponible.
async function filterFresh(events: FuelEvent[]): Promise<FuelEvent[]> {
  try {
    const resp = await fetch(STATUS_URL);
    if (!resp.ok) return events; // si el status falla, no descartar (mejor avisar que perder)
    const { stations } = (await resp.json()) as { stations: { name: string; available: boolean; litros: number }[] };
    const avail = new Map(stations.map((s) => [s.name, s]));
    return events
      .filter((ev) => avail.get(ev.name)?.available)
      .map((ev) => ({ ...ev, litros: avail.get(ev.name)?.litros ?? ev.litros }));
  } catch {
    return events;
  }
}

function buildPrompt(events: FuelEvent[]): string {
  const lines = events.map((ev) => {
    const litros = ev.litros.toLocaleString("es-BO");
    const nav = ev.waze || `https://www.google.com/maps/search/?api=1&query=${ev.lat},${ev.lon}`;
    return `- ${ev.name} (${ev.company}) — ~${litros} L · tipo:${ev.kind} · navegar:${nav}`;
  });
  return `Eres Jano. Formato: Telegram HTML. Español neutro. Sin acks genéricos.

EVENTO PROACTIVO: llegó gasolina a estaciones que Cal monitorea. Avísale AHORA con un mensaje corto y visual.

Estaciones (ya verificadas como disponibles):
${lines.join("\n")}

Tu tarea en este turno:
1. Por cada estación, envía una línea: emoji ⛽🟢 (alert) o ⛽🔔 (reminder), nombre en <b>negrita</b>, litros, y un <a href="...">Cómo llegar</a> con el link de navegación.
2. Cierra ofreciendo: "¿Quieres ver/ajustar el menú de estaciones monitoreadas?" — si Cal dice que sí, usa getFuelMonitorStatus y arma el menú con toggles.
3. No inventes estaciones fuera de la lista. Una sola tanda de mensajes, sin párrafos largos.`;
}

export async function processFuelAlert(events: FuelEvent[], deps: FuelAlertDeps): Promise<void> {
  const fresh = await filterFresh(events);
  if (fresh.length === 0) {
    console.log(JSON.stringify({ ts: Date.now(), msg: "fuel_alert_all_stale", count: events.length }));
    return;
  }
  deps.setCurrentChatId(deps.chatId);
  let warm;
  try { warm = await deps.takeWarm(); } catch (err) {
    console.log(JSON.stringify({ ts: Date.now(), msg: "fuel_alert_startup_error", err: String(err) }));
    return;
  }
  try {
    await runAgent(buildPrompt(fresh), { warm, history: [] });
    console.log(JSON.stringify({ ts: Date.now(), msg: "fuel_alert_sent", names: fresh.map((e) => e.name) }));
  } catch (err) {
    console.log(JSON.stringify({ ts: Date.now(), msg: "fuel_alert_agent_error", err: String(err) }));
  }
}
```

> Verificar al implementar: firma real de `runAgent` y de `takeWarm`/`setCurrentChatId` en `index.ts` (mismo patrón que `proactive/foco-check.ts`). Ajustar imports si difieren.

- [ ] **Step 2: Conectar el dispatch en `daemon-v2/src/index.ts`**

En el loop (`for (const { leaseId, body } of messages)`), agregar branch tras el `if (msg.kind === "telegram_update")`:

```ts
        } else if (msg.kind === "fuel_alert") {
          try {
            const { events } = msg.payload as { events: FuelEvent[] };
            await processFuelAlert(events, {
              takeWarm,
              setCurrentChatId,
              chatId: CAL_CHAT_ID,
            });
            acks.push(leaseId);
          } catch (err) {
            log({ msg: "fuel_alert_error", err: String(err), leaseId });
            acks.push(leaseId);
          }
```

Agregar imports al tope de `index.ts`:

```ts
import { processFuelAlert } from "./proactive/fuel-alert.js";
import type { FuelEvent } from "@cos/shared";
```

> `takeWarm`, `setCurrentChatId` y la constante del chat de Cal (`CAL_CHAT_ID` o equivalente, ej. `ALERT_CHAT_ID`) ya existen en `index.ts` (usadas por foco-check / alertas). Reusar el identificador correcto del chat de Cal.

- [ ] **Step 3: Build del daemon**

Run: `cd "/Users/calepes/Claude Projects/Personal/Agents/Jano" && npm -w @cos/shared run build && npm -w @cos/daemon run build`
Expected: compila sin errores.

- [ ] **Step 4: Invocar `daemon-health-reviewer`**

Tras editar `index.ts`, invocar el subagent `daemon-health-reviewer` (regla del repo). Resolver findings BLOCKING antes de commit.

- [ ] **Step 5: Commit**

```bash
git add daemon-v2/src/proactive/fuel-alert.ts daemon-v2/src/index.ts
git commit -m "feat(fuel): daemon procesa fuel_alert con re-check de frescura"
```

---

## Fase 3 — Jano: tools de config + menú

### Task 7: Tools `getFuelMonitorConfig` / `getFuelMonitorStatus` / `setFuelMonitorConfig` en el MCP

**Files:**
- Modify: `Personal/MCP Servers/mcp-servers/servers/combustible/src/index.ts`
- Modify: `Personal/MCP Servers/mcp-servers/servers/combustible/src/worker.ts` (si expone las mismas tools)

- [ ] **Step 1: Leer `MONITOR_TOKEN` del env del MCP**

En `src/index.ts`, junto a la lectura de `GOOGLE_MAPS_API_KEY` desde `~/.combustible-mcp.env`, leer también `MONITOR_TOKEN`:

```ts
let MONITOR_TOKEN = process.env.MONITOR_TOKEN ?? "";
// (mismo bucle de parseo del .env: si la línea empieza con MONITOR_TOKEN= , asignar)
```

- [ ] **Step 2: Implementar las 3 tools**

Agregar al handler de `ListToolsRequestSchema` los esquemas y al `CallToolRequestSchema` la lógica. Helpers:

```ts
async function getFuelMonitorConfig() {
  const r = await fetch(`${PROXY_BASE}/monitor/config`);
  return await r.json();
}
async function getFuelMonitorStatus() {
  const r = await fetch(`${PROXY_BASE}/monitor/status`);
  return await r.json();
}
async function setFuelMonitorConfig(patch: Record<string, unknown>) {
  const r = await fetch(`${PROXY_BASE}/monitor/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Monitor-Token": MONITOR_TOKEN },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`config update failed: ${r.status} ${await r.text()}`);
  return await r.json();
}
```

Definiciones de tool (en la lista):

```ts
{ name: "getFuelMonitorConfig", description: "Lee la config del monitor de gasolina (estaciones, umbrales, frecuencia).", inputSchema: { type: "object", properties: {} } },
{ name: "getFuelMonitorStatus", description: "Estado en vivo por estación: enabled, litros, available, empresa. Insumo del menú.", inputSchema: { type: "object", properties: {} } },
{ name: "setFuelMonitorConfig", description: "Modifica la config del monitor (merge parcial). stations: [{name, enabled?, minLitros?}].",
  inputSchema: { type: "object", properties: {
    enabled: { type: "boolean" }, checkIntervalMin: { type: "number" }, reminderHours: { type: "number" },
    maxReminders: { type: "number" }, chatId: { type: "number" }, defaultMinLitros: { type: "number" },
    quietHours: { type: "object" },
    stations: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, enabled: { type: "boolean" }, minLitros: { type: "number" } }, required: ["name"] } },
  } } },
```

Y los `case` en el switch de `CallToolRequestSchema`, devolviendo `{ content: [{ type: "text", text: JSON.stringify(result) }] }`.

- [ ] **Step 3: Build del MCP**

Run: `cd "/Users/calepes/Claude Projects/Personal/MCP Servers/mcp-servers/servers/combustible" && npm run build` (o `npx tsc`)
Expected: compila; `dist/index.js` actualizado.

- [ ] **Step 4: Agregar `MONITOR_TOKEN` a `~/.combustible-mcp.env`**

(Se hace junto a los secrets en Task 9.)

- [ ] **Step 5: Commit (en el repo mcp-servers)**

```bash
cd "/Users/calepes/Claude Projects/Personal/MCP Servers/mcp-servers"
git add servers/combustible/src/index.ts servers/combustible/dist/
git commit -m "feat(combustible-mcp): tools getFuelMonitorConfig/Status/setFuelMonitorConfig"
```

---

### Task 8: Allowlist + system-prompt en Jano

**Files:**
- Modify: `daemon-v2/src/agent-options.ts` (allowlist)
- Modify: `daemon-v2/src/system-prompt.ts` (instrucciones de menú + fuel_alert)

- [ ] **Step 1: Agregar las tools al allowlist**

En `agent-options.ts`, donde se listan los tools permitidos del MCP `combustible` (junto a `getFuelStatus`), agregar:

```ts
  "mcp__claude_ai_combustible__getFuelMonitorConfig",
  "mcp__claude_ai_combustible__getFuelMonitorStatus",
  "mcp__claude_ai_combustible__setFuelMonitorConfig",
```

> Verificar el prefijo real del MCP combustible en `agent-options.ts`/`index.ts` (¿`mcp__claude_ai_combustible__` o `mcp__combustible__`?). Usar el mismo que ya tiene `getFuelStatus`.

- [ ] **Step 2: Agregar bloque al system-prompt**

En `system-prompt.ts`, agregar una sección:

```
### Monitor de gasolina
- Cuando Cal pida "menú de gasolina" / "qué estaciones monitoreo" / "ajustar alertas": llama getFuelMonitorStatus y arma un menú agrupado por empresa (Genex/Biopetrol/Orsa/Rivero), cada estación con toggle ✅/⬜ y sus litros actuales. Tocar una → setFuelMonitorConfig({stations:[{name, enabled:!previo}]}) → confirma y re-renderiza.
- Para cambiar umbral/frecuencia/recordatorios: setFuelMonitorConfig con el campo correspondiente.
- Las alertas de "llegó gasolina" entran como evento del sistema (fuel_alert), no las generas tú salvo cuando proceses ese turno.
```

- [ ] **Step 3: Build + daemon-health-reviewer**

Run: `npm -w @cos/shared run build && npm -w @cos/daemon run build`
Luego invocar `daemon-health-reviewer` (editaste `agent-options.ts` y `system-prompt.ts`). Resolver BLOCKING.

- [ ] **Step 4: Commit**

```bash
git add daemon-v2/src/agent-options.ts daemon-v2/src/system-prompt.ts
git commit -m "feat(fuel): allowlist tools + system-prompt menú de gasolina"
```

---

## Fase 4 — Secrets, deploy y verificación e2e

### Task 9: Secrets + deploy de ambos workers + reinicio del daemon

**Files:** ninguno (operativo)

- [ ] **Step 1: Generar el secreto compartido**

Run: `openssl rand -hex 24` → guardar el valor como `FUEL_ALERT_SECRET`. Generar otro para `MONITOR_TOKEN`.

- [ ] **Step 2: Secrets del worker combustible**

```bash
cd "/Users/calepes/Claude Projects/Personal/Apps/Combustible/repo/proxy"
echo "<FUEL_ALERT_SECRET>" | npx wrangler secret put FUEL_ALERT_SECRET
echo "<MONITOR_TOKEN>" | npx wrangler secret put MONITOR_TOKEN
```

- [ ] **Step 3: Secret del worker de Jano**

```bash
cd "/Users/calepes/Claude Projects/Personal/Agents/Jano/worker-v2"
echo "<FUEL_ALERT_SECRET>" | npx wrangler secret put FUEL_ALERT_SECRET
```

- [ ] **Step 4: `MONITOR_TOKEN` en el env del MCP**

Agregar la línea `MONITOR_TOKEN=<MONITOR_TOKEN>` a `~/.combustible-mcp.env` (chmod 600).

- [ ] **Step 5: Confirmar `JANO_ALERT_URL`**

Verificar el host real del worker-v2 de Jano (donde está montada la ruta `/fuel/alert`). Ajustar `JANO_ALERT_URL` en `proxy/wrangler.toml` si difiere de `https://mcp-telegram.carlos-cb4.workers.dev/fuel/alert`.

Run: `curl -s -o /dev/null -w "%{http_code}" -X POST "<JANO_ALERT_URL>" -H "X-Fuel-Secret: wrong" ` → Expected: `401` (ruta existe, secreto inválido). *(Tras deploy del worker de Jano.)*

- [ ] **Step 6: Deploy de ambos workers**

```bash
cd "/Users/calepes/Claude Projects/Personal/Agents/Jano/worker-v2" && npx wrangler deploy
cd "/Users/calepes/Claude Projects/Personal/Apps/Combustible/repo/proxy" && npx wrangler deploy
```
Expected: ambos deploy OK; el de combustible reporta el cron `* * * * *` registrado.

- [ ] **Step 7: Reiniciar el daemon de Jano**

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.cal.cos-agent-v2.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.cal.cos-agent-v2.plist
```

- [ ] **Step 8: Verificación e2e — config**

```bash
curl -s "https://combustible-proxy.carlos-cb4.workers.dev/monitor/config" | python3 -m json.tool | head -30
curl -s "https://combustible-proxy.carlos-cb4.workers.dev/monitor/status" | python3 -m json.tool | head -40
```
Expected: config con 27 estaciones (3 enabled); status con litros en vivo.

- [ ] **Step 9: Verificación e2e — alerta forzada**

Forzar un evento mandando un POST directo al endpoint de Jano (simula al worker):

```bash
curl -s -X POST "<JANO_ALERT_URL>" -H "Content-Type: application/json" -H "X-Fuel-Secret: <FUEL_ALERT_SECRET>" \
  -d '{"events":[{"name":"Urubó","company":"Orsa","litros":12000,"kind":"alert","since":0,"waze":"https://waze.com/ul?q=Orsa%20Urubo%20Santa%20Cruz%20Bolivia&navigate=yes"}]}'
```
Expected: `{"ok":true}`; en Telegram (bot de Jano) llega el mensaje ⛽🟢 de Urubó **si** sigue disponible al re-verificar (si no, se descarta — revisar log `fuel_alert_all_stale`).

- [ ] **Step 10: Verificar logs del daemon**

```bash
grep -E "fuel_alert" ~/Library/Logs/cos-agent-v2.out.log | tail -10
```
Expected: `fuel_alert_sent` o `fuel_alert_all_stale`.

- [ ] **Step 11: Probar el menú desde Telegram**

Escribirle a Jano "menú de gasolina" → debe listar las 27 agrupadas con toggles y litros. Togglear una → confirma cambio (`setFuelMonitorConfig`). Verificar con `curl .../monitor/config`.

- [ ] **Step 12: Documentar en CLAUDE.md**

Agregar a `repo/CLAUDE.md` una sección "Monitor de alertas" (endpoints `/monitor/*`, `/fuel/alert`, cron, KV keys `monitor_config`/`monitor_state`/`monitor_lastrun`, secrets). Commit.

```bash
cd "/Users/calepes/Claude Projects/Personal/Apps/Combustible/repo"
git add CLAUDE.md && git commit -m "docs: documentar monitor de alertas de gasolina"
```

---

## Notas de implementación

- **TDD aplica a la lógica pura** (`evaluateStation`, `runMonitor`, endpoints de config) — bien cubierta por vitest. Las piezas de integración (worker-v2, daemon, MCP, menú) se verifican e2e en Task 9 por su naturaleza (cola, SDK, Telegram).
- **Orden estricto:** Fase 1 → 2 → 3 → 4. El worker de Jano debe estar desplegado (Task 5 + Task 9 step 6) antes de probar el POST real del combustible.
- **Reversibilidad:** apagar todo el monitor = `setFuelMonitorConfig({enabled:false})` (sin redeploy). Quitar el cron = borrar `[triggers]` y redeploy.
- **Seguridad:** `FUEL_ALERT_SECRET` y `MONITOR_TOKEN` solo como Wrangler secrets / `~/.combustible-mcp.env` (chmod 600). Nunca en `vars` ni en git.
