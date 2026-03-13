# Combustible

Monorepo para monitorear disponibilidad de Gasolina Especial en Santa Cruz de la Sierra, Bolivia.

## Subproyectos

| Dir | Qué es | Stack |
|-----|--------|-------|
| `widget/` | Widgets Scriptable (iOS) | JS standalone, Scriptable API |
| `pwa/` | Progressive Web Apps (cards, list) | HTML/CSS/JS, ES modules |
| `proxy/` | CORS proxy para APIs externas | Cloudflare Worker |

## Setup

```bash
git clone git@github.com:calepes/combustible.git
```

No hay dependencias npm. Todo es vanilla JS.

## Deploy

### PWA (GitHub Pages)
Push a `main` → deploya automáticamente en `apps.lepesqueur.net/combustible/pwa/cards/`
- Pages está configurado en el repo `calepes/combustible` (no en `calepes.github.io`)
- **Importante:** también hay copia desactualizada en `calepes.github.io/combustible/pwa/` — ignorar

### Proxy (Cloudflare Workers)
```bash
cd proxy && npx wrangler deploy
```
URL: `https://combustible-proxy.carlos-cb4.workers.dev`

### Widgets (Scriptable)
Push a la rama correspondiente → el loader en Scriptable descarga automáticamente:

| Loader | Rama | Widget |
|--------|------|--------|
| `loader-combustible.js` | `main` | `widget/all-stations-widget.js` |
| `loader-test.js` | `test` | `widget/all-stations-widget.js` |
| `loader-cards.js` | `cards-v2` | `widget/cards-widget.js` |

## Arquitectura PWA

```
pwa/
├── cards/index.html    ← Vista journey (timeline vertical, icono 3D)
├── list/index.html     ← Vista lista
└── shared/
    ├── stations.js     ← Config de 29 estaciones (coords, URLs, keys)
    ├── fetchers.js     ← Fetch via proxy, parsers por tipo, distancias OSRM
    └── icons/          ← SVG icons
```

### Flujo de datos (PWA)
1. `getUserLocation()` + `fetchAllStations()` en paralelo
2. Cada estación se parsea según su `type`: genex (HTML), ec2 (HTML), gasgroup (JSON), gsheets (chartJson)
3. Todas las requests van via el CORS proxy (`combustible-proxy.carlos-cb4.workers.dev`)
4. Distancias calculadas con OSRM table API (fallback: haversine)
5. Ordenar por distancia, renderizar journey timeline

### Tipos de estación y parsers

| type | company | parser | fuente |
|------|---------|--------|--------|
| `genex` | Genex | `parseGenex(html, key, fuel)` | HTML scraping genex.com.bo |
| `ec2` | Biopetrol | `parseEC2(html, key)` | HTML scraping EC2 instance |
| `gasgroup` | Orsa | `parseGasGroup(json, product)` | JSON API gasgroup.com.bo |
| `gsheets` | Rivero | `parseChartJson(html, product)` | Google Sheets chart iframe |

### Proxy CORS
- Whitelist de dominios: genex.com.bo, gasgroup.com.bo, compute.amazonaws.com, docs.google.com, router.project-osrm.org
- Cache: 60s (`Cache-Control: public, max-age=60`)
- Uso: `proxy/?url=<encoded_url>`

## Convenciones

- UI y comentarios en español
- Números: `toLocaleString("es-BO")`
- Dark mode obligatorio (CSS `prefers-color-scheme` en PWA, `Color.dynamic()` en widget)
- Navegación a estaciones vía Waze deep links

## Gotchas

- **SW cache:** cada cambio en PWA requiere bump de `CACHE_NAME` en `pwa/cards/sw.js` (actual: v8). Si los cambios no se reflejan, el SW está sirviendo cache viejo
- **Gasgroup/Orsa:** umbral mínimo de 1,500 Lts para filtrar lecturas erráticas
- **Rivero:** parsing de Google Sheets chartJson — frágil, múltiples fallbacks de deserialización
- **Distancias:** OSRM demo server no es para producción y las distancias no coinciden con Waze real. Ver `docs/PENDIENTES.md` para opciones de migración
- **Coordenadas:** 19 estaciones nuevas (2026-03-13) tienen coordenadas estimadas, no verificadas
- **Loaders Scriptable:** son copias locales, no se actualizan desde GitHub automáticamente
- **Deploy duplicado:** `calepes.github.io` tiene copia vieja en `/combustible/pwa/` — la fuente real es el repo `combustible`

## Pendientes

Ver `docs/PENDIENTES.md` para bugs, mejoras y decisiones pendientes.
