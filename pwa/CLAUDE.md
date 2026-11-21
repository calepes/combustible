# PWA — Combustible

Contexto general del repo en `../CLAUDE.md`.

## Vistas

| Dir | Descripción |
|-----|-------------|
| `cards/` | Timeline vertical (journey view), icono 3D por estación |
| `map/` | Google Maps con markers (divIcon) mostrando litros |
| `list/` | Tabla simple de estaciones |

## Shared

- `shared/stations.js` — Config de 27 estaciones (coords, URLs, keys, tipo)
- `shared/fetchers.js` — Stock agregado, último dato válido con hora y distancias (Google → OSRM → Haversine)
- `shared/sw-cache.js` — Caché del app shell. El lector de stock mantiene su respaldo por separado con la hora de observación.
- `shared/icons/` — PNG icons bomba 3D (192, 512, apple-touch-icon)

## Desarrollo local

```bash
python3 -m http.server 8000
# http://localhost:8000/cards/ o /map/ o /list/
```

## Capacidad estimada

Las vistas calculan el porcentaje sobre el máximo histórico observado de cada estación. El Worker devuelve ese máximo junto con el stock. Las estaciones sin máximo conocido muestran el volumen sin porcentaje.

## Gotchas

- **SW cache bump:** al cambiar el app shell, incrementar la versión en el `sw.js` de las vistas afectadas.
- **Google Maps API Key:** hardcoded en `map/index.html` y `cards/index.html`. Restringida a `apps.lepesqueur.net` y `localhost`
- **Distance Matrix:** client-side via `google.maps.DistanceMatrixService`, batch de 25 destinos por request
- **Rivero parser:** Google Sheets chartJson es frágil — múltiples fallbacks de deserialización
- **Gasgroup/Orsa:** API v2 por departamento, cada estación se identifica por `codigo`. Umbral mínimo 1,500 Lts para filtrar lecturas erráticas
