# PWA Cards — Journey View Redesign

**Fecha:** 2026-03-13
**Estado:** Aprobado

## Resumen

Rediseñar `pwa/cards/index.html` reemplazando la vista grid (2 columnas) por una vista vertical tipo "journey" donde las estaciones se muestran en orden de cercanía, conectadas por una línea de timeline.

## Diseño visual

### Layout general
- **Header:** titulo "Combustible", subtitulo "Gasolina Especial", pill con conteo disponibles, botón refresh
- **Nodo origen:** dot azul con label "Tu ubicación"
- **Línea vertical:** gradiente azul que conecta todos los nodos, posición izquierda
- **Badges de distancia:** entre cada estación, sobre la línea (ej: "0.8 km")
- **Cards de estación:** ancho completo, border-radius 20px, sombra multicapa
- **Footer:** "Actualizado HH:MM"

### Card de estación
Cada card contiene:
1. **Icono surtidor 3D isométrico** (CSS puro) — a la izquierda
2. **Nombre** (16px, bold) + **dot de estado** (color según stock)
3. **Empresa** (13px, texto secundario)
4. **Litros** (26px, bold, tabular-nums) + unidad "litros"
5. **Barra de progreso** con gradiente + porcentaje
6. **CTA "Navegar"** — pill azul que abre Waze

### Icono surtidor 3D
Construido con divs CSS simulando clay render isométrico:
- `perspective(200px) rotateY(-8deg) rotateX(2deg)`
- Cuerpo con gradiente multicapa + highlight de brillo
- Pantalla/display, manguera, pico
- Base tipo plataforma
- `drop-shadow` suave
- **Colores por estado:**
  - Verde: stock >= 50%
  - Naranja: stock 20-49%
  - Rojo: stock 1-19%
  - Gris: sin dato (litros = 0)

### Estados de card
- **Disponible:** card normal, icono con color
- **Sin dato:** card con `opacity: 0.55`, icono gris, litros muestran "—"

### Dark mode
Variables CSS con `prefers-color-scheme: dark`:
- bg: #000, card-bg: #1C1C1E, blue: #0A84FF, green: #30D158, etc.

## Arquitectura

### Archivos a modificar
- `pwa/cards/index.html` — rewrite completo del HTML, CSS y JS de renderizado

### Archivos sin cambios
- `pwa/shared/stations.js` — configuración de estaciones (sin cambios)
- `pwa/shared/fetchers.js` — fetch y parsing (sin cambios)
- `pwa/cards/manifest.json` — manifest PWA (sin cambios)
- `pwa/cards/sw.js` — service worker (sin cambios)

### Lógica (se mantiene igual)
1. Fetch ubicación + datos de estaciones en paralelo
2. Calcular distancias (OSRM con fallback Haversine)
3. Ordenar por distancia ascendente
4. Top 10 estaciones
5. maxLitros = max de todas para calcular porcentaje
6. Renderizar journey timeline
7. Tap card → abrir Waze
8. Reload en visibilitychange / pageshow / focus

### Cálculo de color del surtidor
```javascript
function getPumpColor(litros, maxLitros) {
  if (litros === 0) return 'gray';
  const pct = litros / maxLitros;
  if (pct >= 0.5) return 'green';
  if (pct >= 0.2) return 'orange';
  return 'red';
}
```

### Formato de distancia
```javascript
function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
```

## Referencia visual
Mockup validado en: `.superpowers/brainstorm/12846-1773436695/journey-v2.html`
