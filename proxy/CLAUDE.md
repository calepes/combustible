# Proxy — Cloudflare Worker

Contexto general del repo en `../CLAUDE.md`.

## Archivos

- `worker.js` — CORS proxy + endpoints de capacidad (ES module format)
- `wrangler.toml` — Config de Cloudflare Workers + KV namespace

## Deploy

```bash
npx wrangler deploy
```

URL: `https://combustible-proxy.carlos-cb4.workers.dev`

Requiere KV namespace `CAPACIDAD`:
- **ID real (creado 2026-05-02):** `67bd8d72166d4f46b046cf0fc3286b93` — ya en `wrangler.toml`

> ⚠️ Sin el ID real, el endpoint `/capacidad` retorna 400. Las PWAs manejan esto con fallback a `{}`.

## Endpoints

### Proxy CORS
```
GET /?url=<encoded_url>
```

### Capacidad (KV)
```
GET  /capacidad          → {nombre: litros_max, ...}
POST /capacidad          → [{name, litros}, ...] → actualiza max, retorna mapa completo
```

### Stations API (agregado 2026-05-02)
```
GET  /api/stations       → [{name, company, lat, lon, litros, capacidad}]
```
Fetcha 4 fuentes directamente (sin CORS proxy), parsea 27 estaciones, cachea 60s en KV `stations_cache_v1`. Para uso desde MCPs/agentes — no requiere navegador. Output incluye `mapsUrl` por estación para navegación directa.

El POST compara cada valor con el máximo almacenado en KV. Solo actualiza si el nuevo valor es mayor. Esto permite que la capacidad se "aprenda" automáticamente con el tiempo.

## Whitelist de dominios

Solo permite requests a: `genex.com.bo`, `gasgroup.com.bo`, `compute.amazonaws.com`, `docs.google.com`, `router.project-osrm.org` (y subdominios).

## Gotchas

- **Gasgroup headers:** el proxy inyecta `Accept: application/json` y `X-Requested-With: XMLHttpRequest` para requests a `gasgroup.com.bo/estaciones/*` — sin ellos la API devuelve HTML en vez de JSON
- **Cache:** proxy responde con `Cache-Control: public, max-age=60`, capacidad con `max-age=30`
- **User-Agent:** usa Chrome UA hardcoded, no el del navegador del cliente
- **Agregar dominio:** editar `ALLOWED_DOMAINS` en `worker.js` y redesplegar
- **KV:** un solo key `capacidad_max` almacena todo el mapa como JSON. Free tier de KV alcanza de sobra
