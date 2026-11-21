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
GET  /api/stations       → [{name, company, lat, lon, litros, capacidad, stock}]
GET  /api/stations?refresh=1
```
El Worker consulta las cinco URLs del catálogo compartido y guarda un snapshot en KV `stations_cache_v2`. Reutiliza el snapshot durante 60 segundos en lecturas normales. El refresco manual vuelve a consultar, con una ventana de un segundo para evitar escrituras seguidas.

`stock` contiene `litros`, `observedAt` en milisegundos UTC y `status` (`fresh`, `stale` o `unknown`). Un fallo conserva la hora de la última lectura válida. Los campos numéricos originales y el umbral de Gasgroup se mantienen para el MCP. La PWA usa `stock` para mostrar el detalle y las distancias y enlaces del catálogo para navegar.

Biopetrol publica la hora de medición de toda la guía de gasolina en hora boliviana. A partir de una hora de antigüedad, el saldo se muestra como dato anterior y queda fuera de disponibilidad y capacidad. Una tarjeta ausente carece de una lectura nueva.

## Whitelist de dominios

Solo permite requests a: `genex.com.bo`, `gasgroup.com.bo`, `compute.amazonaws.com`, `docs.google.com`, `router.project-osrm.org` (y subdominios).

## Gotchas

- **Gasgroup headers:** el proxy inyecta `Accept: application/json` y `X-Requested-With: XMLHttpRequest` para requests a `gasgroup.com.bo/estaciones/*` — sin ellos la API devuelve HTML en vez de JSON
- **Cache:** proxy responde con `Cache-Control: public, max-age=60`, capacidad con `max-age=30`
- **User-Agent:** usa Chrome UA hardcoded, no el del navegador del cliente
- **Agregar dominio:** editar `ALLOWED_DOMAINS` en `worker.js` y redesplegar
- **KV:** un solo key `capacidad_max` almacena todo el mapa como JSON. Free tier de KV alcanza de sobra
