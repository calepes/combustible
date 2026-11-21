/**
 * Fetch y parsing de datos de estaciones de combustible
 * Portado de widget/cards-widget.js para uso en PWAs (fetch API)
 */


/* ── Proxy ────────────────────────────── */

export const PROXY_URL = 'https://combustible-proxy.carlos-cb4.workers.dev';

/**
 * Fetch a traves del proxy CORS (Cloudflare Worker)
 * @param {string} url — URL destino
 * @returns {Promise<Response>}
 */
export async function proxyFetch(url) {
  return fetch(`${PROXY_URL}/?url=${encodeURIComponent(url)}`);
}

/* ── Helpers ──────────────────────────── */

/**
 * Retorna URL de navegacion segun plataforma:
 * movil → Waze (deep link), desktop → Google Maps directions
 */
export function getNavUrl(station) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && station.waze) return station.waze;
  return `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
}

/* ── Distancias ───────────────────────── */

/**
 * Distancias reales por ruta via Google Maps Distance Matrix Service (client-side).
 * Requiere que google.maps esté cargado. Máximo 25 destinos por request.
 * @param {number} originLat
 * @param {number} originLon
 * @param {{lat: number, lon: number}[]} stations
 * @returns {Promise<number[]|null>} array de distancias en km, o null si falla
 */
export async function googleDistances(originLat, originLon, stations) {
  if (typeof google === 'undefined' || !google.maps) return null;

  try {
    const service = new google.maps.DistanceMatrixService();
    const BATCH_SIZE = 25;
    const allDistances = [];

    for (let i = 0; i < stations.length; i += BATCH_SIZE) {
      const batch = stations.slice(i, i + BATCH_SIZE);
      const destinations = batch.map((s) => new google.maps.LatLng(s.lat, s.lon));

      const result = await new Promise((resolve, reject) => {
        service.getDistanceMatrix(
          {
            origins: [new google.maps.LatLng(originLat, originLon)],
            destinations,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (status === 'OK') resolve(response);
            else reject(new Error(`Distance Matrix: ${status}`));
          }
        );
      });

      for (const el of result.rows[0].elements) {
        if (el.status === 'OK') {
          allDistances.push(el.distance.value / 1000);
        } else {
          allDistances.push(null);
        }
      }
    }

    return allDistances;
  } catch (e) {
    console.log('Google Distance Matrix ERROR:', e.message);
    return null;
  }
}

/**
 * Distancia en linea recta (Haversine) en km.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distancia real por ruta (driving) via OSRM, a traves del proxy.
 * Retorna distancias en km, con null para cada ruta ausente o si falla toda la consulta.
 * @param {number} originLat
 * @param {number} originLon
 * @param {{lat: number, lon: number}[]} stations
 * @returns {Promise<Array<number|null>|null>}
 */
export async function osrmDistances(originLat, originLon, stations) {
  try {
    // Formato OSRM: lon,lat (invertido)
    const coords = [`${originLon},${originLat}`];
    for (const s of stations) {
      coords.push(`${s.lon},${s.lat}`);
    }
    const url = `https://router.project-osrm.org/table/v1/driving/${coords.join(';')}?sources=0&annotations=distance`;
    const resp = await proxyFetch(url);
    const json = await resp.json();
    if (json && json.code === 'Ok' && json.distances && json.distances[0]) {
      // distances[0] = distancias desde origen a cada destino (en metros)
      // El primer valor es origen->origen (0), los demas son las estaciones
      return json.distances[0].slice(1).map((m) => Number.isFinite(m) ? m / 1000 : null);
    }
    console.log('OSRM respuesta inesperada:', JSON.stringify(json).substring(0, 200));
    return null;
  } catch (e) {
    console.log('OSRM ERROR:', e.message);
    return null;
  }
}

/* ── Stock del Worker ────────────────── */

const STOCK_KEY = 'combustible:last-stocks-v2';
let sessionStock = {};
const stockTime = Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function hasReading(stock) {
  return Number.isSafeInteger(stock?.litros) && stock.litros >= 0
    && Number.isSafeInteger(stock.observedAt) && stock.observedAt > 0
    && stock.observedAt <= 8.64e15;
}

export function stockLabel(row) {
  if (row.observedAt == null) return 'Sin lectura';
  const time = stockTime.format(row.observedAt);
  if (row.status === 'stale') return `Dato anterior · ${time}`;
  if (row.litros > 0 && !row.available) return `Bajo umbral · ${time}`;
  return `Consultado · ${time}`;
}

export function stockSummary(rows) {
  const stale = rows.filter((row) => row.status === 'stale').length;
  const unknown = rows.filter((row) => row.status === 'unknown').length;
  return [stale && `${stale} con dato anterior`, unknown && `${unknown} sin lectura`].filter(Boolean).join(' · ');
}

export function coalesceRefresh(load) {
  let pending;
  return (options) => {
    pending ??= load(options).finally(() => { pending = undefined; });
    return pending;
  };
}

export async function fetchAllStations(stations, { refresh = false } = {}) {
  let rows = [];
  const url = new URL('/api/stations', PROXY_URL);
  if (refresh) url.searchParams.set('refresh', '1');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) rows = data;
    }
  } catch {
    // El respaldo usa la hora de la observación, no la hora de este intento.
  } finally {
    clearTimeout(timer);
  }

  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(STOCK_KEY));
  } catch {
    stored = null;
  }
  const byName = new Map(rows.filter((row) => typeof row?.name === 'string').map((row) => [row.name, row]));
  const next = Object.create(null);
  const results = stations.map((station) => {
    const row = byName.get(station.name);
    const saved = stored?.[station.name];
    const previous = sessionStock[station.name];
    const last = (saved?.stock?.observedAt ?? 0) >= (previous?.stock?.observedAt ?? 0)
      ? saved : previous;
    const current = hasReading(row?.stock) && ['fresh', 'stale'].includes(row.stock.status)
      && (!hasReading(last?.stock) || row.stock.observedAt >= last.stock.observedAt);
    const stock = current ? row.stock : (hasReading(last?.stock) ? last.stock : null);
    const capacidad = Math.max(
      Number.isFinite(row?.capacidad) ? row.capacidad : 0,
      Number.isFinite(last?.capacidad) ? last.capacidad : 0,
      0,
    );
    if (stock) next[station.name] = { stock, capacidad };
    return {
      ...station,
      litros: stock?.litros ?? null,
      observedAt: stock?.observedAt ?? null,
      status: current ? stock.status : (stock ? 'stale' : 'unknown'),
      available: current && stock.status === 'fresh' && row.litros > 0,
      capacidad,
    };
  });

  sessionStock = next;
  try {
    localStorage.setItem(STOCK_KEY, JSON.stringify(next));
  } catch {
    // El respaldo en memoria sigue disponible en la sesión.
  }
  return results;
}

/**
 * Obtiene distancias para cada resultado.
 * Orden de prioridad: Google Distance Matrix → OSRM → Haversine.
 * @param {number} userLat
 * @param {number} userLon
 * @param {Array<{lat, lon}>} results — resultados de fetchAllStations
 * @returns {Promise<Array>}
 */
export async function getDistances(userLat, userLon, results) {
  // Intentar Google Distance Matrix primero
  let routeDistances = await googleDistances(userLat, userLon, results);

  // Fallback a OSRM si Google falla
  if (!routeDistances) {
    console.log('Fallback a OSRM para distancias');
    routeDistances = await osrmDistances(userLat, userLon, results);
  }

  return results.map((r, i) => {
    const routeDistance = routeDistances?.[i];
    return {
      ...r,
      distKm: routeDistance ?? haversineKm(userLat, userLon, r.lat, r.lon),
      distanceEstimated: routeDistance == null,
    };
  });
}
