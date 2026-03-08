# CLAUDE.md

## Project overview

Widget de Scriptable (iOS) que muestra disponibilidad de Gasolina Especial en estaciones de servicio de Santa Cruz, Bolivia. Todo el código es JavaScript ejecutado en el runtime de Scriptable.

## Key files

- `all-stations-widget.js` — Widget principal con todas las estaciones (Large widget)
- `cards-widget.js` — Widget alternativo con diseño de tarjetas en grid 2x2
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

## Testing

No automated tests. To test changes:
1. Copy the widget code into Scriptable on an iPhone
2. Run the script — it will call `presentLarge()` to show a preview
3. Verify layout, data fetching, and Waze navigation
