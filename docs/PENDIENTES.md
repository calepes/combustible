# Pendientes — PWA Cards Journey View

**Fecha:** 2026-03-13

## Bugs por resolver

### 1. Waze no abre con navegación directa
- Los links de Waze (`waze.com/ul?q=...&navigate=yes`) no funcionan correctamente al hacer tap en las cards
- **Posible causa:** el `window.open(r.waze, '_blank')` puede estar bloqueado por el browser/PWA standalone mode
- **Investigar:** usar `window.location.href = r.waze` en vez de `window.open`, o usar el schema `waze://` en iOS

### 2. Línea del timeline desalineada con dots
- El dot azul de "Tu ubicación" y los dots de estaciones no están perfectamente centrados con la línea vertical
- Ver screenshot en sesión del 2026-03-13
- La línea está en `left: 9px`, el origin-dot es 20px (centro=10px), pero los node-dot están en una columna de 20px

### 3. Coordenadas aproximadas de estaciones nuevas
- Las 19 estaciones nuevas (10 Biopetrol + 9 Genex) tienen coordenadas estimadas, no exactas
- Estaciones con baja confianza: Berea, La Teca, Lucyfer, Monteverde, Parapetí, Sur Central
- **Acción:** verificar/corregir coordenadas con Google Maps o Waze

## Mejoras pendientes

### 4. Icono 3D — tinte de color
- Se implementó hue-rotate para colorear el icono de thiings.co según stock
- **Validar:** que los colores resultantes se vean bien en el cel (verde/naranja/rojo/gris)
- Si no convence, considerar descargar el PNG y crear versiones coloreadas offline

### 5. Distancia de navegación más real
Opciones investigadas (todas gratis):

| Opción | Key | Límite | Recomendación |
|---|---|---|---|
| OSRM Demo (actual) | No | Sin SLA | OK por ahora |
| OpenRouteService | Sí (free) | 2,000 req/día | Mejor corto plazo |
| Valhalla OSM público | No | Sin doc | Alternativa sin key |
| Stadia Maps | Sí (free) | 5,000 req/día | Buena opción |
| Mapbox | Sí (free) | 100K req/mes | Mejor free tier |
| OSRM self-hosted (Oracle Cloud) | No | Ilimitado | Mejor largo plazo |

**Decisión pendiente:** elegir opción e implementar

### 6. Deploy a GitHub Pages
- El repo `calepes/combustible` tiene Pages activo y sirve en `apps.lepesqueur.net/combustible/`
- El repo `calepes/calepes.github.io` también tiene copia (desactualizada) en `combustible/pwa/`
- **Acción:** sincronizar o eliminar la copia en `calepes.github.io` para evitar confusión

### 7. Service Worker cache
- Cada cambio requiere bump manual de `CACHE_NAME` en `sw.js`
- Actualmente en `combustible-cards-v8`
- **Considerar:** strategy network-first para index.html, o versionado automático

## Estado actual

- **29 estaciones** configuradas (11 Genex, 16 Biopetrol, 1 Gasgroup, 1 Rivero)
- **Vista journey** implementada con timeline vertical
- **Icono 3D** de thiings.co con tinte por color de stock
- **Distancia incremental** entre estaciones en badges del timeline
- **Distancia total** desde ubicación al lado del CTA "Navegar"
- **Dark mode** soportado
- **MAX_ITEMS = 30** para mostrar todas las estaciones
