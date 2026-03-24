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

/**
 * GET /capacidad — devuelve el mapa completo {nombre: litros}
 */
async function handleCapacidadGet(env) {
  const raw = await env.CAPACIDAD.get(KV_KEY);
  const map = raw ? JSON.parse(raw) : {};
  return new Response(JSON.stringify(map), {
    headers: { 'Cache-Control': 'public, max-age=30', ...JSON_HEADERS },
  });
}

/**
 * POST /capacidad — recibe [{name, litros}, ...], actualiza si es mayor.
 * Devuelve el mapa completo actualizado.
 */
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

/* ── Proxy ────────────────────────────── */

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
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      },
    });

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

    return handleProxy(url);
  },
};
