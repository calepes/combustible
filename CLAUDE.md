# CLAUDE.md

## Project overview

Widget de Scriptable (iOS) que muestra disponibilidad de Gasolina Especial en estaciones de servicio de Santa Cruz, Bolivia. Todo el código es JavaScript ejecutado en el runtime de Scriptable.

## Key files

- `all-stations-widget.js` — Widget principal con todas las estaciones (Large widget)
- `cards-widget.js` — Widget alternativo con diseño de tarjetas en grid 2x2 **(solo en rama cardsv2)**
- `fuel-widget.js` — Widget original (solo Genex Banzer, tamaño pequeño)
- `loader-combustible.js` — Loader que descarga y ejecuta el widget desde GitHub
- `loader-test.js` — Loader de pruebas
- `Equipetrol/`, `Pirai/`, `Urubo/`, `Vangas/`, `Rivero/` — Widgets individuales por estación

## Tech stack

- **Runtime**: [Scriptable](https://scriptable.app/) for iOS
- **Language**: JavaScript (no build step, no dependencies)
- **APIs**: Scriptable built-in APIs (`ListWidget`, `Request`, `FileManager`, `Color`, `Font`, `Device`, etc.)
- **Data sources**: HTML scraping (Genex, Biopetrol EC2), JSON API (Gasgroup), Google Sheets chart parsing (Rivero)

## Architecture notes

- Widgets use Scriptable's `ListWidget` API with horizontal/vertical stacks for layout
- No npm, no bundler — each `.js` file is a standalone Scriptable script
- The loader pattern (`loader-combustible.js`) fetches the latest widget code from GitHub and caches it locally in iCloud
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

### Ramas activas
- **`claude/review-fuel-widget-sbRss`** (esta rama) — Widget de lista (`all-stations-widget.js`). Colores originales iOS (`#34C759` verde, `#FF3B30` rojo, `#0A84FF` azul). Sin `cards-widget.js`. Sin distancias GPS.
- **`claude/cardsv2-sbRss`** — Rama principal de desarrollo del cards widget. Contiene:
  - `cards-widget.js` con diseño de tarjetas grid 2x2 (Apple HIG)
  - Paleta Ocean Blue (`#3B82F6` acento, `#60A5FA` barra)
  - Color de distancia dinámico (verde→naranja→rojo según km, rango 0–15 km)
  - Distancias reales por ruta via OSRM API
  - Ordenamiento por cercanía con GPS del usuario
  - `loader-test.js` apunta a esta rama
- **`claude/cards-sbRss`** — Versión anterior del cards widget (sin distancias, sin OSRM, paleta original)
- **`main`** — Versión estable con `all-stations-widget.js` solamente

### Historial de esta sesión (2026-03-08)
- Se propusieron 6 paletas de colores para cards widget
- Se aplicó Purple/Indigo a esta rama pero se revirtió (usuario pidió dejarla como estaba)
- Se eligió **Ocean Blue** + distancia dinámica para cardsv2

## Testing

No automated tests. To test changes:
1. Copy the widget code into Scriptable on an iPhone
2. Run the script — it will call `presentLarge()` to show a preview
3. Verify layout, data fetching, and Waze navigation
