# CLAUDE.md

## Project overview

Widget de Scriptable (iOS) que muestra disponibilidad de Gasolina Especial en estaciones de servicio de Santa Cruz, Bolivia. Todo el código es JavaScript ejecutado en el runtime de Scriptable.

## Key files

### Widgets
- `all-stations-widget.js` — Widget principal con todas las estaciones (Large widget, diseño lista)
- `cards-widget.js` — Widget alternativo con diseño de tarjetas en grid 2x2
- `fuel-widget.js` — Widget original (solo Genex Banzer, tamaño pequeño)
- `Equipetrol/`, `Pirai/`, `Urubo/`, `Vangas/`, `Rivero/` — Widgets individuales por estación

### Loaders
Cada loader descarga y ejecuta un widget desde una rama específica de GitHub. Usan cachés independientes para no pisarse entre sí.

| Loader | Rama | Archivo | Caché | Icono | Uso |
|--------|------|---------|-------|-------|-----|
| `loader-combustible.js` | `main` | `all-stations-widget.js` | `combustible-cache/` | naranja | Producción |
| `loader-test.js` | `test` | `all-stations-widget.js` | `combustible-cache-test/` | naranja | Pruebas list widget |
| `loader-cards.js` | `cards-v2` | `cards-widget.js` | `combustible-cache-cards/` | verde | Pruebas cards widget |

## Tech stack

- **Runtime**: [Scriptable](https://scriptable.app/) for iOS
- **Language**: JavaScript (no build step, no dependencies)
- **APIs**: Scriptable built-in APIs (`ListWidget`, `Request`, `FileManager`, `Color`, `Font`, `Device`, etc.)
- **Data sources**: HTML scraping (Genex, Biopetrol EC2), JSON API (Gasgroup), Google Sheets chart parsing (Rivero)

## Architecture notes

- Widgets use Scriptable's `ListWidget` API with horizontal/vertical stacks for layout
- No npm, no bundler — each `.js` file is a standalone Scriptable script
- El patrón loader descarga el widget desde GitHub y lo cachea en iCloud. Hay tres loaders (ver tabla en Key files): producción (`main`), test (`test`), y cards (`cards-v2`), cada uno con su propio directorio de caché
- Widget sizes are Large; layout must work across iPhone screen sizes
- Support for both light and dark mode via `Color.dynamic()`
- Navigation to stations via Waze deep links

## Code conventions

- Spanish comments and UI text (español neutro)
- Station data defined as constants at the top of widget files
- Numbers formatted with `toLocaleString("es-BO")`
- No external dependencies — pure Scriptable APIs only

## Design reference — Apple HIG Widgets

Toda decisión de diseño debe seguir las [Apple Human Interface Guidelines para Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets/). Resumen de las reglas clave:

### Tipografía
- Usar fuente del sistema (SF Pro) con jerarquía clara: texto grande/bold para datos principales, secundario más pequeño
- Tamaño mínimo de fuente: 11pt
- Alto contraste entre texto y fondo

### Padding y márgenes
- Margen mínimo de **16pt** desde los bordes del widget para texto y gráficos
- **11pt** para layouts con gráficos ajustados
- **8pt** para botones o elementos con fondo propio
- Padding suficiente e igual entre elementos de un grid

### Layout
- Máximo **4 elementos por fila** en grids
- El widget debe ser adaptable a distintos tamaños de pantalla
- Widget small = un solo tap target; medium/large soportan múltiples
- Alinear contenido con el centro del ícono de la app

### Contenido
- Enfocarse en **una sola cosa** por widget
- Máximo **4 piezas de información** en widget small
- El widget debe ser: informativo, personal y contextual
- No incluir botón "Abrir App" — el contenido mismo debe ser tappeable
- Incluir placeholder/skeleton cuando no hay datos

### Visual
- No personalizar el fondo del widget con fotos
- Diseñar para **Light y Dark Mode**
- Las esquinas (corner radius) deben coincidir con el radio del widget
- Vista previa realista para el gallery del widget

### Naming
- El nombre del widget debe coincidir con el nombre de la app
- Si hay múltiples widgets, usar nombres claros y concisos (ej: "Maps Nearby")

### Principios HIG generales
- **Clarity**: interfaz legible, jerarquía visual clara
- **Deference**: el contenido del usuario es protagonista
- **Depth**: capas visuales para navegación intuitiva

## Branch context

### Ramas
- **`main`** — Producción. Widget de lista HIG (`all-stations-widget.js`). Título: "Combustible"
- **`test`** — Pruebas pre-producción. Mismo widget de lista, título: "Combustible (test)"
- **`cards-v2`** — Experimento de layout cards grid (`cards-widget.js`)

### Paleta de colores actual (cardsv2)
- Acento/badge: `#3B82F6` (ocean blue)
- Barra de nivel: `#60A5FA` (sky blue)
- Badge fondo: `#3B82F6` con 12% opacidad
- Dot disponible: `#30D158`, no disponible: `#FF453A`
- Distancia: interpolación `#34D399` (verde, cerca) → `#FB923C` (naranja) → `#EF4444` (rojo, lejos) en rango 0–15 km
- Fondo widget: blanco/negro (light/dark)
- Fondo tarjetas: `#F2F2F7` / `#1C1C1E` (light/dark)

### Decisiones de diseño pendientes
- Se descartó paleta Purple/Indigo (`#BF5AF2` / `#7D7AFF`)

## Testing

No automated tests. Para probar cambios en desarrollo:

1. Hacer push a la rama correspondiente
2. En Scriptable, ejecutar el loader asociado a esa rama:
   - List widget (test) → ejecutar `loader-test.js` (descarga de `test`)
   - Cards widget → ejecutar `loader-cards.js` (descarga de `cards-v2`)
3. El loader descarga automáticamente la última versión y la ejecuta
4. Verificar layout, datos, modo claro/oscuro y navegación Waze

Para producción: `loader-combustible.js` descarga de `main`.
