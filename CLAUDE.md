# Combustible

Monorepo para monitorear disponibilidad de Gasolina Especial en Santa Cruz de la Sierra, Bolivia.

## Subproyectos

| Dir | Qué es | Stack |
|-----|--------|-------|
| `widget/` | Widgets Scriptable (iOS) | JS standalone, Scriptable API |
| `pwa/` | Progressive Web Apps (cards, map) | HTML/CSS/JS, ES modules |
| `proxy/` | CORS proxy para APIs externas | Cloudflare Worker |

## Setup

```bash
git clone git@github.com:calepes/combustible.git
```

No hay dependencias npm. Todo es vanilla JS.

### Desarrollo local
```bash
cd pwa && python3 -m http.server 8000
# Abrir http://localhost:8000/cards/ o /map/ o /list/
```

## Deploy

### PWA (GitHub Pages)
Push a `main` → deploya automáticamente en `apps.lepesqueur.net/combustible/`
- Cards: `apps.lepesqueur.net/combustible/pwa/cards/`
- Mapa: `apps.lepesqueur.net/combustible/pwa/map/`
- Pages está configurado en el repo `calepes/combustible` (no en `calepes.github.io`)

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
├── list/index.html     ← Vista lista simple (tabla de estaciones)
├── cards/index.html    ← Vista journey (timeline vertical, icono 3D)
├── map/index.html      ← Vista mapa (Google Maps, markers con litros)
└── shared/
    ├── stations.js     ← Config de 29 estaciones (coords, URLs, keys)
    ├── fetchers.js     ← Fetch via proxy, parsers por tipo, distancias Google/OSRM
    └── icons/          ← PNG icons (bomba 3D de thiings.co)
```

### Flujo de datos (PWA)
1. `getUserLocation()` + `fetchAllStations()` en paralelo
2. Cada estación se parsea según su `type`: genex (HTML), ec2 (HTML), gasgroup (JSON), gsheets (chartJson)
3. Todas las requests van via el CORS proxy (`combustible-proxy.carlos-cb4.workers.dev`)
4. Distancias: Google Distance Matrix API → OSRM fallback → Haversine fallback
5. Ordenar por distancia, renderizar (journey timeline o mapa)

### Tipos de estación y parsers

| type | company | parser | fuente |
|------|---------|--------|--------|
| `genex` | Genex | `parseGenex(html, key, fuel)` | HTML scraping genex.com.bo |
| `ec2` | Biopetrol | `parseEC2(html, key)` | HTML scraping EC2 instance |
| `gasgroup` | Orsa | `parseGasGroup(json, product)` | JSON API gasgroup.com.bo |
| `gsheets` | Rivero | `parseChartJson(html, product)` | Google Sheets chart iframe |

### APIs externas

| API | Uso | Key |
|-----|-----|-----|
| Google Maps JS API | Mapa en `pwa/map/` | Sí (restringida por dominio) |
| Google Distance Matrix | Distancias reales de manejo | Sí (misma key) |
| OSRM Demo | Fallback distancias | No |
| CORS Proxy (Cloudflare) | Proxy para scraping | No |

### Proxy CORS
- Whitelist: genex.com.bo, gasgroup.com.bo, compute.amazonaws.com, docs.google.com, router.project-osrm.org
- Cache: 60s (`Cache-Control: public, max-age=60`)
- Uso: `proxy/?url=<encoded_url>`

## Convenciones

- UI y comentarios en español
- Números: `toLocaleString("es-BO")`
- Dark mode obligatorio (CSS `prefers-color-scheme` en PWA, `Color.dynamic()` en widget)
- Navegación a estaciones vía Waze deep links

## Gotchas

- **SW cache:** cada cambio en PWA requiere bump de `CACHE_NAME` en el `sw.js` correspondiente (cards: v10, map: v3)
- **Gasgroup/Orsa:** umbral mínimo de 1,500 Lts para filtrar lecturas erráticas
- **Rivero:** parsing de Google Sheets chartJson — frágil, múltiples fallbacks de deserialización
- **Coordenadas:** 6 estaciones (Lucyfer, Montecristo, Monteverde, Parapetí, Gasco, Cabezas) pendientes de verificación exacta
- **Loaders Scriptable:** son copias locales, no se actualizan desde GitHub automáticamente
- **Deploy duplicado:** `calepes.github.io` tiene copia vieja en `/combustible/pwa/` — la fuente real es el repo `combustible`
- **API Key Google Maps:** guardada en `pwa/map/Api Maps` (gitignored). Restringida a `apps.lepesqueur.net` y `localhost`

## Pendientes

Ver `docs/BACKLOG.md` para bugs, mejoras e ideas.
