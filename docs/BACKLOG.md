# Backlog — Combustible

Registro de ideas, bugs y mejoras. Cada ítem tiene estado y prioridad para mapear ejecución.

**Estados:** `pendiente` · `en progreso` · `hecho` · `descartado`
**Prioridad:** `alta` · `media` · `baja`

---

## Bugs

| # | Descripción | Prioridad | Estado | Notas |
|---|-------------|-----------|--------|-------|
| B1 | ~~Distancia no coincide con Waze real~~ | alta | hecho | Resuelto con Google Distance Matrix API (2026-03-14) |
| B2 | ~~Timeline desalineado con dots (cards)~~ | baja | hecho | Resuelto (2026-03-14) |
| B3 | Coordenadas estimadas en estaciones | media | en progreso | 17 estaciones corregidas (2026-03-14). Pendientes: Lucyfer, Montecristo, Monteverde, Parapetí, Gasco, Cabezas |

## Mejoras

| # | Descripción | Prioridad | Estado | Notas |
|---|-------------|-----------|--------|-------|
| M1 | ~~Migrar API de distancias~~ | alta | hecho | Google Distance Matrix implementado (2026-03-14). Fallback: OSRM → Haversine |
| M2 | Validar colores de icono 3D en móvil | media | pendiente | hue-rotate verde/naranja/rojo/gris — verificar que se ven bien en cel |
| M3 | Limpiar deploy duplicado | baja | pendiente | Eliminar copia vieja en `calepes.github.io/combustible/pwa/` |
| M4 | SW: network-first para index.html | baja | pendiente | Actualmente cache-first requiere bump manual de `CACHE_NAME` |

## Ideas

| # | Descripción | Prioridad | Estado | Notas |
|---|-------------|-----------|--------|-------|
| I1 | Navegar: Waze en móvil, Google Maps en desktop | media | pendiente | Detectar si es mobile/desktop y abrir Waze o Google Maps respectivamente |

## Hecho

| # | Descripción | Fecha |
|---|-------------|-------|
| ~~I1~~ | PWA: icono app con bomba 3D | 2026-03-14 |
| ~~I2~~ | Vista mapa con Google Maps | 2026-03-14 |

## Historial

| Fecha | Ítem | Cambio |
|-------|------|--------|
| 2026-03-13 | — | Backlog creado. Migrado desde PENDIENTES.md |
| 2026-03-13 | — | Journey view, 29 estaciones, icono 3D, deploy en Pages |
| 2026-03-14 | I1 | Icono PWA bomba 3D implementado (favicon, manifest, apple-touch-icon) |
| 2026-03-14 | — | Ajuste hue-rotate de iconos para coincidir con barra de stock |
| 2026-03-14 | — | Vista mapa PWA: Leaflet → Google Maps JS API |
| 2026-03-14 | B3 | Coordenadas Pirai y López corregidas |
| 2026-03-14 | M1 | Google Distance Matrix API implementado (client-side). Fallback: OSRM → Haversine |
| 2026-03-14 | B3 | 17 estaciones corregidas con coords de Google Maps/Waze. Pendientes: Lucyfer, Montecristo, Monteverde, Parapetí, Gasco, Cabezas |
| 2026-03-14 | I1 | Agregada idea: Waze en móvil, Google Maps en desktop |
| 2026-03-14 | — | CLAUDE.md actualizado con arquitectura completa (map view, Distance Matrix, SW versions) |
| 2026-03-14 | — | PENDIENTES.md eliminado — supersedido por BACKLOG.md |
