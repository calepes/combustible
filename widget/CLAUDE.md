# CLAUDE.md

## Resumen

Repo monorepo `calepes/combustible` con tres subproyectos:
- `widget/` — Widget de Scriptable (iOS) que muestra disponibilidad de Gasolina Especial en Santa Cruz, Bolivia
- `pwa/` — Progressive Web Apps (cards y list views)
- `proxy/` — Cloudflare Worker CORS proxy para APIs de estaciones

### PWA Cards (`pwa/cards/`)
- **Vista journey:** timeline vertical ordenado por cercanía
- **Icono 3D:** imagen de thiings.co coloreada por stock (hue-rotate)
- **29 estaciones:** 11 Genex, 16 Biopetrol, 1 Gasgroup (Orsa), 1 Rivero
- **Módulos compartidos:** `pwa/shared/stations.js` (config), `pwa/shared/fetchers.js` (fetch/parse)
- **Deploy:** GitHub Pages via rama main del repo combustible → `apps.lepesqueur.net/combustible/pwa/cards/`
- **SW cache:** bump `CACHE_NAME` en `sw.js` con cada cambio (actual: v8)
- **Pendientes:** ver `docs/PENDIENTES.md`

Todo el código del widget es JavaScript ejecutado en el runtime de Scriptable.

## Setup

```bash
git clone git@github.com:calepes/combustible.git
```

No hay dependencias. Cada `.js` es un script standalone de Scriptable.

## Archivos clave

### Widgets
- `all-stations-widget.js` — Widget principal con todas las estaciones (Large widget, diseño lista)
- `cards-widget.js` — Widget alternativo con diseño de tarjetas en grid 2x2
- `fuel-widget.js` — Widget original (solo Genex Banzer, tamaño pequeño)
- `Equipetrol/`, `Pirai/`, `Urubo/`, `Vangas/`, `Rivero/` — Widgets individuales por estación

### Loaders
Cada loader descarga y ejecuta un widget desde una rama específica de GitHub. Usan cachés independientes para no pisarse entre sí.

| Loader | Rama | Archivo | Caché | Icono | Uso |
|--------|------|---------|-------|-------|-----|
| `loader-combustible.js` | `main` | `widget/all-stations-widget.js` | `combustible-cache/` | naranja | Producción |
| `loader-test.js` | `test` | `widget/all-stations-widget.js` | `combustible-cache-test/` | naranja | Pruebas list widget |
| `loader-cards.js` | `cards-v2` | `widget/cards-widget.js` | `combustible-cache-cards/` | verde | Pruebas cards widget |

## Stack

- **Runtime**: [Scriptable](https://scriptable.app/) para iOS
- **Lenguaje**: JavaScript (sin build, sin dependencias)
- **APIs**: Scriptable built-in (`ListWidget`, `Request`, `FileManager`, `Color`, `Font`, `Device`, etc.)
- **Fuentes de datos**: HTML scraping (Genex, Biopetrol EC2), JSON API (Gasgroup), Google Sheets chart parsing (Rivero)

## Arquitectura

- Layout con `ListWidget` API + stacks horizontales/verticales
- No npm, no bundler — cada `.js` es un script standalone
- El patrón loader descarga el widget desde GitHub y lo cachea en iCloud. Hay tres loaders (ver tabla en Archivos clave): producción (`main`), test (`test`), y cards (`cards-v2`), cada uno con su propio directorio de caché
- Tamaño Large; layout adaptable a distintos tamaños de iPhone
- Soporte light/dark mode con `Color.dynamic()`
- Navegación a estaciones vía Waze deep links

## Convenciones

- Comentarios y UI en español neutro
- Datos de estaciones como constantes al inicio de cada widget
- Números formateados con `toLocaleString("es-BO")`
- Sin dependencias externas — solo APIs de Scriptable

## Design reference

Seguir [Apple HIG Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets/). Referencia completa en [`/Personal/AppleHIG.md`](../../../AppleHIG.md).

Reglas clave aplicadas en este proyecto:
- Fuente sistema (SF Pro), mínimo 11pt, jerarquía bold/semibold/regular
- Márgenes: 16pt bordes widget, 8-10pt padding interno tarjetas
- Máximo 4 elementos por fila en grids
- Light y Dark Mode obligatorio (`Color.dynamic()`)
- Sin fotos de fondo, sin botón "Abrir App"

## Ramas
- **`main`** — Producción. Widget de lista HIG (`all-stations-widget.js`). Título: "Combustible"
- **`test`** — Pruebas pre-producción. Mismo widget de lista, título: "Combustible (test)"
  - Incluye distancia OSRM/Haversine y ordenamiento por cercanía
  - Colores de distancia: verde (≤7 km), naranja (≤12 km), rojo (>12 km)
- **`cards-v2`** — Experimento de layout cards grid (`cards-widget.js`)

### Paleta de colores (cards-v2)
- Acento/badge: `#3B82F6` (ocean blue)
- Barra de nivel: `#60A5FA` (sky blue)
- Badge fondo: `#3B82F6` con 12% opacidad
- Dot disponible: `#30D158`, no disponible: `#FF453A`
- Distancia cards: interpolación `#34D399` → `#FB923C` → `#EF4444` en rango 0–15 km

### Paleta de distancia (list widget, rama test)
- Verde `#34C759` (≤7 km), naranja `#FF9500` (≤12 km), rojo `#FF3B30` (>12 km)
- Fondo widget: blanco/negro (light/dark)
- Fondo tarjetas: `#F2F2F7` / `#1C1C1E` (light/dark)

### Decisiones de diseño
- Se descartó paleta Purple/Indigo (`#BF5AF2` / `#7D7AFF`)

## Testing

No hay tests automatizados. Para probar cambios:

1. Hacer push a la rama correspondiente
2. En Scriptable, ejecutar el loader asociado a esa rama:
   - List widget (test) → ejecutar `loader-test.js` (descarga de `test`)
   - Cards widget → ejecutar `loader-cards.js` (descarga de `cards-v2`)
3. El loader descarga automáticamente la última versión y la ejecuta
4. Verificar layout, datos, modo claro/oscuro y navegación Waze

Para producción: `loader-combustible.js` descarga de `main`.

## Gotchas

- Al mover archivos de carpeta, actualizar la constante `FILE` en cada loader de Scriptable con la ruta completa (ej: `widget/cards-widget.js`)
- Los loaders en Scriptable son copias locales — no se actualizan automáticamente desde GitHub
- Gasgroup/Orsa: umbral mínimo de 1,500 Lts para filtrar lecturas poco confiables
- Rivero usa parsing de Google Sheets chartJson (frágil, múltiples fallbacks)
