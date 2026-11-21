import { GASGROUP_MIN_LITROS, STATIONS } from '../pwa/shared/stations.js';
import { readSource } from './readings.js';

const ALLOWED_DOMAINS = [
  'genex.com.bo',
  'gasgroup.com.bo',
  'compute.amazonaws.com',
  'docs.google.com',
  'router.project-osrm.org',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const JSON_HEADERS = { 'Content-Type': 'application/json', ...CORS_HEADERS };

function isDomainAllowed(hostname) {
  return ALLOWED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith('.' + domain)
  );
}

/* ── Capacidad (KV) ──────────────────── */

const KV_KEY = 'capacidad_max';
const STATIONS_CACHE_KEY = 'stations_cache_v2';
const STATIONS_CACHE_TTL = 60_000;

const stationsBySource = new Map();
for (const station of STATIONS) {
  if (!stationsBySource.has(station.url)) stationsBySource.set(station.url, []);
  stationsBySource.get(station.url).push(station);
}

async function handleCapacidadGet(env) {
  const raw = await env.CAPACIDAD.get(KV_KEY);
  const map = raw ? JSON.parse(raw) : {};
  return new Response(JSON.stringify(map), {
    headers: { 'Cache-Control': 'public, max-age=30', ...JSON_HEADERS },
  });
}

async function handleCapacidadPost(request, env) {
  let entries;
  try {
    entries = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  if (!Array.isArray(entries)) {
    return new Response(JSON.stringify({ error: 'Expected array' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const raw = await env.CAPACIDAD.get(KV_KEY);
  const map = raw ? JSON.parse(raw) : {};
  let changed = false;

  for (const { name, litros } of entries) {
    if (!name || typeof litros !== 'number' || litros <= 0) continue;
    const rounded = Math.round(litros);
    if (!map[name] || rounded > map[name]) {
      map[name] = rounded;
      changed = true;
    }
  }

  if (changed) {
    await env.CAPACIDAD.put(KV_KEY, JSON.stringify(map));
  }

  return new Response(JSON.stringify(map), { headers: JSON_HEADERS });
}

/* ── /api/stations — fetch + parse directo (sin proxy hop) ── */

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
  'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
};

async function fetchAllStationsData(env, previousRows = []) {
  const sources = await Promise.all([...stationsBySource].map(async ([url, stations]) => {
    try {
      const headers = { ...BROWSER_HEADERS };
      const isGasgroup = stations[0].type === 'gasgroup';
      if (isGasgroup) {
        headers.Accept = 'application/json';
        headers['X-Requested-With'] = 'XMLHttpRequest';
      }
      const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(8_000) });
      if (!response.ok) return [];
      const data = isGasgroup ? await response.json() : await response.text();
      const observedAt = Date.now();
      return readSource(stations, data)
        .filter(([, litros]) => Number.isSafeInteger(litros) && litros >= 0)
        .map(([name, litros]) => [name, { litros, observedAt, status: 'fresh' }]);
    } catch {
      return [];
    }
  }));
  const readings = new Map(sources.flat());
  const previous = new Map(previousRows.map((row) => [row.name, row]));
  const results = STATIONS.map((station) => {
    const { name, company, lat, lon } = station;
    const last = previous.get(name)?.stock;
    const stock = readings.get(name) ?? (last?.observedAt != null
      ? { ...last, status: 'stale' }
      : { litros: null, observedAt: null, status: 'unknown' });
    // El MCP sigue recibiendo litros numéricos y conserva su umbral de Gasgroup.
    const available = stock.status === 'fresh' && stock.litros >= (
      station.type === 'gasgroup' ? GASGROUP_MIN_LITROS : 1
    );
    return { name, company, lat, lon, litros: available ? stock.litros : 0, stock };
  });

  const capMap = Object.fromEntries(previousRows.map(({ name, capacidad }) => [name, capacidad]));
  try {
    const raw = await env.CAPACIDAD.get(KV_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    for (const { name } of STATIONS) {
      if (Number.isFinite(stored[name]) && stored[name] > 0) {
        capMap[name] = Math.max(capMap[name] ?? 0, stored[name]);
      }
    }
    let changed = false;
    for (const { name, litros } of results) {
      if (litros > 0 && litros > (capMap[name] ?? 0)) {
        capMap[name] = litros;
        changed = true;
      }
    }
    if (changed) await env.CAPACIDAD.put(KV_KEY, JSON.stringify({ ...stored, ...capMap }));
  } catch {
    // Una falla de KV no descarta observaciones válidas de stock.
  }

  return results.map((row) => ({ ...row, capacidad: capMap[row.name] ?? 0 }));
}

async function handleApiStations(env, refresh) {
  let cached;
  try {
    const raw = await env.CAPACIDAD.get(STATIONS_CACHE_KEY);
    cached = raw && JSON.parse(raw);
  } catch {
    cached = null;
  }
  const cachedRows = Array.isArray(cached?.rows) ? cached.rows : [];
  const age = Date.now() - cached?.checkedAt;
  // El refresco manual relee las fuentes. Reutilizar un resultado recién guardado evita escrituras pegadas.
  if (cachedRows.length && age >= 0 && age < (refresh ? 1_000 : STATIONS_CACHE_TTL)) {
    return Response.json(cachedRows, { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
  }
  const rows = await fetchAllStationsData(env, cachedRows);
  try {
    await env.CAPACIDAD.put(STATIONS_CACHE_KEY, JSON.stringify({ checkedAt: Date.now(), rows }));
  } catch {
    // Responder con el resultado de la consulta aunque no se pueda guardar en KV.
  }
  return Response.json(rows, { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
}

/* ── Proxy CORS ───────────────────────── */

async function handleProxy(url) {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  if (!isDomainAllowed(parsed.hostname)) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403, headers: JSON_HEADERS,
    });
  }

  try {
    const headers = { ...BROWSER_HEADERS };
    if (parsed.hostname === 'gasgroup.com.bo' && parsed.pathname.startsWith('/estaciones/')) {
      headers['Accept'] = 'application/json';
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    const response = await fetch(targetUrl, { headers });
    const body = await response.arrayBuffer();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=60',
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed', detail: err.message }), {
      status: 502, headers: JSON_HEADERS,
    });
  }
}

/* ── Monitor: config en KV ───────────────────────── */

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
      if (!cur) continue; // config en KV obsoleta sin esta estación
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

/* ── Monitor: motor principal ─────────────────────── */

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
  // Service Binding env.JANO → cos-agent-worker. El fetch worker→worker por *.workers.dev
  // se pierde en el edge de CF; el service binding rutea internamente. Fallback a fetch global.
  const fetchImpl = deps.fetchImpl || (env.JANO ? (u, o) => env.JANO.fetch(u, o) : fetch);

  const cfg = await getConfig(env);
  if (!cfg.enabled) return;

  // Gate checkIntervalMin (solo aplica si hay un lastRun previo)
  const lastRunRaw = await env.CAPACIDAD.get(MONITOR_LASTRUN_KEY);
  if (lastRunRaw) {
    const lastRun = Number(lastRunRaw);
    if (now - lastRun < cfg.checkIntervalMin * 60_000) return;
  }
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
    if (!row || (row.stock && row.stock.status !== 'fresh')) continue;
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

/* ── Router ───────────────────────────── */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/capacidad') {
      if (request.method === 'GET') return handleCapacidadGet(env);
      if (request.method === 'POST') return handleCapacidadPost(request, env);
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: JSON_HEADERS,
      });
    }

    if (url.pathname === '/api/stations') {
      if (request.method === 'GET') return handleApiStations(env, url.searchParams.get('refresh') === '1');
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: JSON_HEADERS,
      });
    }

    if (url.pathname === '/monitor/config') {
      if (request.method === 'GET') return handleMonitorConfigGet(env);
      if (request.method === 'POST') return handleMonitorConfigPost(request, env);
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
    }
    if (url.pathname === '/monitor/status') {
      if (request.method === 'GET') return handleMonitorStatus(env);
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
    }

    return handleProxy(url);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env, Date.now()));
  },
};
