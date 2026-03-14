# Diseño: Vista Mapa PWA

**Fecha:** 2026-03-13

## Objetivo

Nueva vista PWA en `pwa/map/` que muestra las estaciones de combustible en un mapa interactivo full-screen usando Leaflet + OpenStreetMap. Vista independiente de cards para comparar cuál funciona mejor.

Deploy: `apps.lepesqueur.net/combustible/pwa/map/`

## Stack

- **Leaflet 1.9.4** (CDN unpkg, ~40KB) + **OpenStreetMap** tiles
- Sin API key, sin costo, sin dependencias locales
- Vanilla JS + CSS inline en un solo `index.html` (mismo patrón que cards)

## Estructura de archivos

```
pwa/map/
├── index.html    ← CSS + JS inline, carga Leaflet desde CDN
├── sw.js         ← Cache-first assets, network-first data
└── manifest.json ← PWA manifest con icono bomba 3D
```

Reutiliza `shared/stations.js` y `shared/fetchers.js`.

## UI

### Mapa
- Full-screen (100vh), Leaflet con tiles OSM
- Inicio: `fitBounds` de todas las estaciones para dar contexto general
- Botón "ubicarme" (abajo-izquierda) para centrar en tu ubicación

### Header overlay
- Flotante sobre el mapa (z-index alto), fondo semi-transparente con blur
- "Combustible" + subtítulo "Gasolina Especial"
- Pill con conteo de estaciones disponibles (ej: "8/29")
- Botón refresh

### Markers
- Markers custom (Leaflet `divIcon`) con litros abreviados adentro
- Formato: `12K` (>= 1000), `800` (< 1000), `0` (sin stock)
- Color por stock: usa misma lógica que cards — `getColorClass(litros, maxLitros)` donde `maxLitros = max(todos los litros)`. Verde (>= 50%), naranja (20-50%), rojo (< 20%), gris (0 litros)
- Pin con triángulo inferior apuntando a la coordenada

### Ubicación del usuario
- Dot azul con pulso CSS (mismo estilo que origin-dot de cards)
- `navigator.geolocation` — definido inline (mismo patrón que cards, no en shared)

### Popup
- Popup nativo de Leaflet con CSS custom (bordes redondeados, sombra suave)
- Contenido:
  - Nombre de estación + status dot de color
  - Empresa (Genex, Biopetrol, etc.)
  - Litros con formato `es-BO`
  - Barra de stock con porcentaje
  - Botón "Navegar" (deep link Waze, consistente con cards) + distancia desde usuario

### Dark mode
- Tiles: usar **CartoDB Dark Matter** (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`) — gratis, sin key, diseñado para dark mode
- Light mode: tiles OSM estándar
- Header overlay y popups usan variables CSS con `prefers-color-scheme`

### Estados

- **Cargando:** spinner centrado "Cargando estaciones..." (igual que cards)
- **Error:** mensaje con botón retry
- **Sin ubicación:** mapa centrado en SCZ (-17.7833, -63.1821), funciona igual sin geolocation

## Flujo de datos

1. Inicializar mapa Leaflet + mostrar spinner overlay
2. `getUserLocation()` + `fetchAllStations()` en paralelo
3. Calcular `maxLitros` y crear markers con `divIcon` para cada estación
4. `getDistances(lat, lon, results)` — una sola llamada OSRM table API para todas las estaciones
5. `fitBounds` con todas las estaciones
6. Al tocar marker: popup con detalle (distancia ya precalculada) + Navegar
7. Refresh: repite pasos 2-6

## Service Worker

- Cache name: `combustible-map-v1`
- App shell: `./`, `./index.html`, `./manifest.json`, `../shared/stations.js`, `../shared/fetchers.js`, `../shared/icons/icon-192.png`, `../shared/icons/icon-512.png`
- Leaflet CSS/JS se cachea en runtime (no en app shell) — URLs de CDN se cachean en el fetch handler al primer uso
- Cache-first para assets locales, network-first para data (proxy, OSRM, CDN)

## Decisiones

- **Leaflet desde CDN** — se cachea en runtime vía SW, no en app shell (CDN URLs pueden cambiar)
- **Un solo HTML** — consistente con cards, sin build step
- **Vista independiente** — no toggle dentro de cards, permite comparar ambas
- **Sin clustering** — solo 29 estaciones, no es necesario agrupar markers
- **getUserLocation inline** — duplicada de cards, no vale la pena extraer a shared por una función de 10 líneas
- **Waze only** — consistente con cards, el usuario ya tiene Waze instalado
- **CartoDB dark tiles** — mejor que invert filter, labels legibles en dark mode
- **fitBounds inicial** — muestra todas las estaciones al abrir, botón para centrar en usuario
