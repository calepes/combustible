# Widget — Scriptable (iOS)

Contexto general del repo en `../CLAUDE.md`.

## Stack

- **Runtime**: [Scriptable](https://scriptable.app/) para iOS
- **Lenguaje**: JS standalone (sin build, sin dependencias)
- **APIs**: `ListWidget`, `Request`, `FileManager`, `Color`, `Font`, `Device`

## Archivos

- `all-stations-widget.js` — Widget principal, diseño lista (Large)
- `cards-widget.js` — Widget alternativo, grid 2x2
- `fuel-widget.js` — Widget original (solo Genex Banzer, Small)
- `Equipetrol/`, `Pirai/`, `Urubo/`, `Vangas/`, `Rivero/` — Widgets individuales
- `loader-*.js` — Loaders que descargan widgets desde GitHub (ver tabla en `../CLAUDE.md`)

## Arquitectura

- Layout con `ListWidget` API + stacks horizontales/verticales
- Loader descarga widget desde GitHub y lo cachea en iCloud (cada loader tiene su propio directorio de caché)
- Tamaño Large; adaptable a distintos tamaños de iPhone
- Light/dark mode con `Color.dynamic()`

## Design reference

[Apple HIG Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets/):
- Fuente sistema (SF Pro), mínimo 11pt
- Márgenes: 16pt bordes, 8-10pt padding tarjetas
- Máximo 4 elementos por fila en grids
- Sin fotos de fondo, sin botón "Abrir App"

## Testing

1. Push a la rama correspondiente (`main`, `test`, `cards-v2`)
2. Ejecutar el loader asociado en Scriptable
3. Verificar layout, datos, modo claro/oscuro y navegación Waze
