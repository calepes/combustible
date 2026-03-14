# Combustible

Monitoreo en tiempo real de disponibilidad de **Gasolina Especial** en estaciones de servicio de Santa Cruz de la Sierra, Bolivia.

## Apps

| App | URL | Descripción |
|-----|-----|-------------|
| Cards | [apps.lepesqueur.net/combustible/pwa/cards/](https://apps.lepesqueur.net/combustible/pwa/cards/) | Timeline vertical ordenado por distancia |
| Mapa | [apps.lepesqueur.net/combustible/pwa/map/](https://apps.lepesqueur.net/combustible/pwa/map/) | Google Maps con markers de litros disponibles |
| Lista | [apps.lepesqueur.net/combustible/pwa/list/](https://apps.lepesqueur.net/combustible/pwa/list/) | Lista simple de estaciones |
| Widget iOS | Scriptable | Widget nativo para Home Screen |

## 27 estaciones monitoreadas

| Empresa | Estaciones | Fuente |
|---------|------------|--------|
| Genex (11) | Banzer, Vangas, Guaracachi, Trompillo, III, Mutualista, V, IV, II, Jarajorechi, Aracataca | HTML scraping genex.com.bo |
| Biopetrol (13) | Equipetrol, Pirai, Alemana, López, Viru Viru, Gasco, Beni, Berea, Cabezas, La Teca, Monteverde, Paraguá, Sur Central | HTML scraping EC2 |
| Orsa (2) | Urubó, Alemana | API JSON gasgroup.com.bo |
| Rivero (1) | Rivero | Google Sheets chartJson |

## Stack

- **PWA:** HTML/CSS/JS vanilla, ES modules, Service Workers
- **Widget:** Scriptable (iOS), JS standalone
- **Proxy:** Cloudflare Worker (CORS proxy para scraping)
- **Mapa:** Google Maps JavaScript API
- **Distancias:** Google Distance Matrix → OSRM → Haversine (fallback chain)
- **Deploy:** GitHub Pages (push a `main`)

## Estructura

```
widget/          ← Widgets Scriptable (iOS)
pwa/
├── cards/       ← Vista journey (timeline vertical, icono 3D)
├── list/        ← Vista lista (tabla de estaciones)
├── map/         ← Vista mapa (Google Maps, markers con litros)
└── shared/      ← stations.js, fetchers.js, icons/
proxy/           ← Cloudflare Worker (CORS proxy)
docs/            ← Backlog, specs, planes
tests/           ← Tests (Vitest)
```

## Setup

```bash
git clone git@github.com:calepes/combustible.git
```

No hay dependencias npm para producción. Todo es vanilla JS.

### Tests

```bash
npm install
npm test
```

## Deploy

- **PWA:** push a `main` → GitHub Pages automático
- **Proxy:** `cd proxy && npx wrangler deploy`
- **Widget:** push a rama → loader en Scriptable descarga automáticamente
