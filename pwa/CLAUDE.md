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
- `shared/fetchers.js` — Fetch via proxy, parsers por tipo, capacidad (KV), distancias (Google → OSRM → Haversine)
- `shared/icons/` — PNG icons bomba 3D (192, 512, apple-touch-icon)

## Desarrollo local

```bash
python3 -m http.server 8000
# http://localhost:8000/cards/ o /map/ o /list/
```

## Capacidad estimada

Las vistas muestran el **% real** de cada estación (`litros / capacidad`). La capacidad se estima automáticamente:
- `fetchAllStations()` reporta litros observados a `POST /capacidad` del proxy
- Cloudflare KV guarda el máximo histórico por estación (universal, server-side)
- Si no hay capacidad aún, fallback a `maxLitros` (máximo entre estaciones visibles)

## Gotchas

- **SW cache bump:** cada cambio requiere incrementar `CACHE_NAME` en el `sw.js` de cada vista (cards: v15, map: v8, list: v5)
- **Google Maps API Key:** hardcoded en `map/index.html` y `cards/index.html`. Restringida a `apps.lepesqueur.net` y `localhost`
- **Distance Matrix:** client-side via `google.maps.DistanceMatrixService`, batch de 25 destinos por request
- **Rivero parser:** Google Sheets chartJson es frágil — múltiples fallbacks de deserialización
- **Gasgroup/Orsa:** umbral mínimo 1,500 Lts en `stations.js` para filtrar lecturas erráticas
