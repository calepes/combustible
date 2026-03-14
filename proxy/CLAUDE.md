# Proxy — Cloudflare Worker

Contexto general del repo en `../CLAUDE.md`.

## Archivos

- `worker.js` — CORS proxy (ES module format)
- `wrangler.toml` — Config de Cloudflare Workers

## Deploy

```bash
npx wrangler deploy
```

URL: `https://combustible-proxy.carlos-cb4.workers.dev`

## Uso

```
GET /?url=<encoded_url>
```

## Whitelist de dominios

Solo permite requests a: `genex.com.bo`, `gasgroup.com.bo`, `compute.amazonaws.com`, `docs.google.com`, `router.project-osrm.org` (y subdominios).

## Gotchas

- **Cache:** respuestas con `Cache-Control: public, max-age=60` — los datos tienen ~1 min de delay
- **User-Agent:** usa `CombustibleProxy/1.0`, no el del navegador
- **Agregar dominio:** editar `ALLOWED_DOMAINS` en `worker.js` y redesplegar
