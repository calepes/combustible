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
const STATIONS_CACHE_KEY = 'stations_cache_v1';
const STATIONS_CACHE_TTL = 60; // segundos

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

const STATIONS = [
  // Genex (comparten HTML, una sola fetch)
  { name: 'Genex Banzer', type: 'genex', company: 'Genex', lat: -17.7577, lon: -63.1779, url: 'https://genex.com.bo/estaciones/', key: 'GENEX I', fuel: 'G. ESPECIAL+' },
  { name: 'Vangas', type: 'genex', company: 'Genex', lat: -17.7772, lon: -63.2158, url: 'https://genex.com.bo/estaciones/', key: 'VANGAS', fuel: 'G. ESPECIAL+', waze: 'https://waze.com/ul?q=Vangas%20Hernando%20Sanabria%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes' },
  { name: 'Genex Guaracachi', type: 'genex', company: 'Genex', lat: -17.7772, lon: -63.1399, url: 'https://genex.com.bo/estaciones/', key: 'GENEX GUARACACHI', fuel: 'G. ESPECIAL+' },
  { name: 'Genex Trompillo', type: 'genex', company: 'Genex', lat: -17.8072, lon: -63.1708, url: 'https://genex.com.bo/estaciones/', key: 'GENEX TROMPILLO', fuel: 'G. ESPECIAL+' },
  { name: 'Genex III', type: 'genex', company: 'Genex', lat: -17.7752, lon: -63.1653, url: 'https://genex.com.bo/estaciones/', key: 'GENEX III', fuel: 'G. ESPECIAL+' },
  { name: 'Genex Mutualista', type: 'genex', company: 'Genex', lat: -17.7605, lon: -63.1578, url: 'https://genex.com.bo/estaciones/', key: 'GENEX MUTUALISTA', fuel: 'G. ESPECIAL+' },
  { name: 'Genex V', type: 'genex', company: 'Genex', lat: -17.8013, lon: -63.1895, url: 'https://genex.com.bo/estaciones/', key: 'GENEX V', fuel: 'G. ESPECIAL+' },
  { name: 'Genex IV', type: 'genex', company: 'Genex', lat: -17.7902, lon: -63.1649, url: 'https://genex.com.bo/estaciones/', key: 'GENEX IV', fuel: 'G. ESPECIAL+' },
  { name: 'Genex II', type: 'genex', company: 'Genex', lat: -17.7928, lon: -63.1940, url: 'https://genex.com.bo/estaciones/', key: 'GENEX II', fuel: 'G. ESPECIAL+' },
  { name: 'Jarajorechi', type: 'genex', company: 'Genex', lat: -17.3194, lon: -63.2691, url: 'https://genex.com.bo/estaciones/', key: 'JARAJORECHI', fuel: 'G. ESPECIAL+' },
  { name: 'Aracataca', type: 'genex', company: 'Genex', lat: -17.3286, lon: -63.2632, url: 'https://genex.com.bo/estaciones/', key: 'ARACATACA', fuel: 'G. ESPECIAL+' },
  // Biopetrol EC2 (comparten HTML, una sola fetch)
  { name: 'Equipetrol', type: 'ec2', company: 'Biopetrol', lat: -17.7545, lon: -63.1970, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'EQUIPETROL', waze: 'https://waze.com/ul?q=Biopetrol%20Equipetrol%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes' },
  { name: 'Pirai', type: 'ec2', company: 'Biopetrol', lat: -17.7860, lon: -63.2045, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'PIRAI' },
  { name: 'Alemana', type: 'ec2', company: 'Biopetrol', lat: -17.7691, lon: -63.1710, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'Alemana' },
  { name: 'López', type: 'ec2', company: 'Biopetrol', lat: -17.7257, lon: -63.1654, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'Lopez' },
  { name: 'Viru Viru', type: 'ec2', company: 'Biopetrol', lat: -17.6759, lon: -63.1590, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'Viru Viru' },
  { name: 'Gasco', type: 'ec2', company: 'Biopetrol', lat: -17.7594, lon: -63.1796, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'Gasco' },
  { name: 'Beni', type: 'ec2', company: 'Biopetrol', lat: -17.7694, lon: -63.1788, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'BENI' },
  { name: 'Berea', type: 'ec2', company: 'Biopetrol', lat: -17.8377, lon: -63.2382, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'BEREA' },
  { name: 'Cabezas', type: 'ec2', company: 'Biopetrol', lat: -18.7875, lon: -63.3142, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'CABEZAS' },
  { name: 'La Teca', type: 'ec2', company: 'Biopetrol', lat: -17.7641, lon: -63.0714, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'LA TECA' },
  { name: 'Monteverde', type: 'ec2', company: 'Biopetrol', lat: -17.3267, lon: -63.2751, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'MONTEVERDE' },
  { name: 'Paraguá', type: 'ec2', company: 'Biopetrol', lat: -17.7651, lon: -63.1495, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'PARAGUA' },
  { name: 'Sur Central', type: 'ec2', company: 'Biopetrol', lat: -17.7999, lon: -63.1805, url: 'http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134', key: 'SUR CENTRAL' },
  // Gasgroup (una fetch para ambas)
  { name: 'Urubó', type: 'gasgroup', company: 'Orsa', lat: -17.7535, lon: -63.2213, url: 'https://gasgroup.com.bo/estaciones/santacruz', codigo: 'CTqmwWgj', product: 'GASOLINA ESPECIAL', waze: 'https://waze.com/ul?q=Orsa%20Urubo%20Santa%20Cruz%20Bolivia&navigate=yes' },
  { name: 'Orsa Alemana', type: 'gasgroup', company: 'Orsa', lat: -17.7524, lon: -63.1634, url: 'https://gasgroup.com.bo/estaciones/santacruz', codigo: '39gbIJkJ', product: 'GASOLINA ESPECIAL' },
  // Rivero (Google Sheets)
  { name: 'Rivero', type: 'gsheets', company: 'Rivero', lat: -17.7625, lon: -63.1805, url: 'https://docs.google.com/spreadsheets/u/0/d/e/2CAIWO3els60V5S1vVAh0cccQxdcZ1MYZhD9A1pQ-ojCNPoNh-vJjHhJaUalVsDLQivYf_Z23Un8mEaePxSg/gviz/chartiframe?oid=1546358769&resourcekey', product: 'ESPECIAL' },
];

const GASGROUP_MIN_LITROS = 1500;
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
  'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
};

function normalizeLiters(raw) {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function parseGenex(html, key, fuel) {
  if (!html) return 0;
  const clean = html.replace(/<[^>]*>/g, ' ').replace(/ /g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');
  const escapedFuel = fuel.replace(/\./g, '\\.').replace(/\+/g, '\\+');
  const re = new RegExp(`${key}[\\s\\S]*?${escapedFuel}[\\s\\S]*?(\\d{1,3}(?:[\\.,]\\d{3})*|\\d+)\\s*litros`, 'i');
  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : 0;
}

function parseEC2(html, key) {
  if (!html) return 0;
  const clean = html.replace(/\s+/g, ' ');
  const re = new RegExp(`${key}[\\s\\S]*?Volumen disponible[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)\\s*Lts`, 'i');
  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : 0;
}

function parseGasGroup(json, product, codigo) {
  if (!json?.estaciones) return 0;
  const estacion = json.estaciones.find((e) => e.codigo === codigo);
  if (!estacion?.tanques) return 0;
  let total = 0;
  for (const t of estacion.tanques) {
    if (t.producto?.toUpperCase().includes(product)) total += t.litros || 0;
  }
  const rounded = Math.round(total);
  return rounded >= GASGROUP_MIN_LITROS ? rounded : 0;
}

function parseChartJson(html, product) {
  if (!html) return 0;
  const upper = product.toUpperCase();
  const m = html.match(/'chartJson'\s*:\s*'((?:[^'\\]|\\.)*)'/);
  if (!m) return 0;
  try {
    const unescaped = m[1].replace(/\\(x([0-9a-fA-F]{2})|.)/g, (match, esc, hex) => {
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      if (esc === '\\') return '\\';
      if (esc === "'") return "'";
      if (esc === 'n') return '\n';
      return esc;
    });
    const chart = JSON.parse(unescaped);
    const rows = chart?.dataTable?.rows;
    if (rows) {
      for (const row of rows) {
        const cells = row.c || [];
        const hasProduct = cells.some((c) => typeof c?.v === 'string' && c.v.toUpperCase().includes(upper));
        if (!hasProduct) continue;
        for (const c of cells) {
          if (typeof c?.v === 'number' && c.v > 0) return Math.round(c.v);
        }
      }
    }
  } catch (_) {}
  return 0;
}

async function fetchAllStationsData(env) {
  // Dedup URLs: una fetch por fuente
  const uniqueUrls = [...new Set(STATIONS.map((s) => s.url))];

  const fetchMap = {};
  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const parsed = new URL(url);
        const headers = { ...BROWSER_HEADERS };
        const isGasgroup = parsed.hostname === 'gasgroup.com.bo';
        if (isGasgroup) {
          headers['Accept'] = 'application/json';
          headers['X-Requested-With'] = 'XMLHttpRequest';
        }
        const resp = await fetch(url, { headers });
        if (!resp.ok) { fetchMap[url] = null; return; }
        fetchMap[url] = isGasgroup ? await resp.json() : await resp.text();
      } catch {
        fetchMap[url] = null;
      }
    })
  );

  const results = STATIONS.map((s) => {
    const raw = fetchMap[s.url];
    let litros = 0;
    try {
      if (s.type === 'genex') litros = parseGenex(raw, s.key, s.fuel);
      else if (s.type === 'ec2') litros = parseEC2(raw, s.key);
      else if (s.type === 'gasgroup') litros = parseGasGroup(raw, s.product, s.codigo);
      else if (s.type === 'gsheets') litros = parseChartJson(raw, s.product);
    } catch (_) {}
    return { name: s.name, company: s.company, lat: s.lat, lon: s.lon, litros };
  });

  // Actualizar capacidad máxima y obtener mapa
  const entries = results.filter((r) => r.litros > 0).map((r) => ({ name: r.name, litros: r.litros }));
  let capMap = {};
  try {
    const raw = await env.CAPACIDAD.get(KV_KEY);
    capMap = raw ? JSON.parse(raw) : {};
    let changed = false;
    for (const { name, litros } of entries) {
      const rounded = Math.round(litros);
      if (!capMap[name] || rounded > capMap[name]) { capMap[name] = rounded; changed = true; }
    }
    if (changed) await env.CAPACIDAD.put(KV_KEY, JSON.stringify(capMap));
  } catch (_) {}

  return results.map((r) => ({ ...r, capacidad: capMap[r.name] || 0 }));
}

async function handleApiStations(env) {
  // Cache en KV
  try {
    const cached = await env.CAPACIDAD.get(STATIONS_CACHE_KEY, { type: 'json' });
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Cache-Control': `public, max-age=${STATIONS_CACHE_TTL}`, ...JSON_HEADERS },
      });
    }
  } catch (_) {}

  const data = await fetchAllStationsData(env);

  try {
    await env.CAPACIDAD.put(STATIONS_CACHE_KEY, JSON.stringify(data), { expirationTtl: STATIONS_CACHE_TTL });
  } catch (_) {}

  return new Response(JSON.stringify(data), {
    headers: { 'Cache-Control': `public, max-age=${STATIONS_CACHE_TTL}`, ...JSON_HEADERS },
  });
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
      if (request.method === 'GET') return handleApiStations(env);
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
