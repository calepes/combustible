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
```bash
npx wrangler kv namespace create CAPACIDAD
# Copiar el ID al wrangler.toml (reemplazar REPLACE_WITH_KV_NAMESPACE_ID)
```

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

El POST compara cada valor con el máximo almacenado en KV. Solo actualiza si el nuevo valor es mayor. Esto permite que la capacidad se "aprenda" automáticamente con el tiempo.

## Whitelist de dominios

Solo permite requests a: `genex.com.bo`, `gasgroup.com.bo`, `compute.amazonaws.com`, `docs.google.com`, `router.project-osrm.org` (y subdominios).

## Gotchas

- **Cache:** proxy responde con `Cache-Control: public, max-age=60`, capacidad con `max-age=30`
- **User-Agent:** usa `CombustibleProxy/1.0`, no el del navegador
- **Agregar dominio:** editar `ALLOWED_DOMAINS` en `worker.js` y redesplegar
- **KV:** un solo key `capacidad_max` almacena todo el mapa como JSON. Free tier de KV alcanza de sobra
