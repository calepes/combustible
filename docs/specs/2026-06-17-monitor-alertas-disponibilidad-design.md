# Monitor de alertas de disponibilidad de gasolina — Diseño

**Fecha:** 2026-06-17
**Estado:** Aprobado (pendiente implementación)
**Autor:** Cal + Jano

## Problema

En Santa Cruz hay escasez intermitente de Gasolina Especial. Las estaciones suelen
estar en 0 litros y de golpe les llega una cisterna. Cal quiere enterarse **apenas
llega gasolina** a las estaciones que le interesan (inicialmente Urubó, Equipetrol y
Vangas), sin tener que abrir la PWA a cada rato.

La app ya sabe cuántos litros tiene cada estación (`/api/stations` del worker
`combustible-proxy`), pero no hay monitoreo continuo ni alertas. Falta:
1. Un proceso que revise solo cada pocos minutos.
2. Detección de "llegó gasolina" (flanco de subida) y aviso por Telegram.
3. Configuración editable por Jano (qué estaciones, umbrales, frecuencia, etc.).

## Objetivo

Servicio serverless, siempre encendido (sin depender de la laptop ni del daemon de
Jano), que monitorea las estaciones configuradas y avisa a Cal por Telegram cuando
hay gasolina, con parámetros que Jano puede leer y modificar conversacionalmente
(incluido un menú de estaciones).

## No-objetivos (YAGNI)

- No avisar cuando una estación se **queda** sin gasolina (solo alertas positivas).
- No predecir llegadas ni histórico de tendencias (la PWA ya cubre lo visual).
- No tocar la lógica de distancias / Google Maps del MCP.
- No reactivar proactividad dentro del daemon de Jano.

## Arquitectura (Approach A — Cron Trigger en el worker existente)

```
┌────────────────────────────────────────────────────────────┐
│ Cloudflare Worker  combustible-proxy                         │
│                                                              │
│  scheduled() cada 1 min ── gate checkIntervalMin ──┐         │
│        │                                            │        │
│        ▼                                            ▼        │
│  fetchAllStationsData(env)  ──►  evaluateStation()  ──► Telegram │
│   (ya existe: 27 est.)            (función pura)      sendMessage │
│        │                              │                       │
│        ▼                              ▼                       │
│   KV CAPACIDAD                  KV monitor_state              │
│                                 KV monitor_config            │
│                                                              │
│  HTTP:                                                        │
│   GET  /api/stations      (existente)                        │
│   GET  /monitor/config    leer config                        │
│   POST /monitor/config    merge parcial  (X-Monitor-Token)   │
│   GET  /monitor/status    estado + litros en vivo            │
└────────────────────────────────────────────────────────────┘
            ▲                              ▲
            │ getFuelStatus               │ getFuelMonitorConfig / Status / set
            │                             │
   ┌────────┴───────┐            ┌────────┴────────┐
   │ MCP combustible│            │  Jano (daemon)  │
   │ (existente)    │            │  menú Telegram  │
   └────────────────┘            └─────────────────┘
```

- **No depende de la laptop** ni del daemon de Jano: el cron corre en Cloudflare.
- Reusa `fetchAllStationsData(env)`, el KV `CAPACIDAD` y los parsers ya portados al worker.
- Jano queda 100% reactivo; solo gana tools para leer/editar config y mostrar el menú.

## Componentes

### 1. Config — `monitor_config` (KV)

Documento JSON único. Si el KV está vacío, el worker lo **siembra** derivando la lista
completa de estaciones de su propio array `STATIONS` (las 27), con `enabled:false` salvo
las 3 iniciales.

```jsonc
{
  "enabled": true,              // master switch
  "checkIntervalMin": 5,        // evalúa cada N min (gate sobre cron de 1 min)
  "reminderHours": 3,           // recordatorio si sigue disponible
  "maxReminders": 2,            // tope de recordatorios por evento
  "quietHours": { "enabled": false, "start": 22, "end": 6 }, // hora local SCZ (UTC-4)
  "chatId": 94137698,           // destino Telegram
  "defaultMinLitros": 1500,
  "stations": [
    { "name": "Urubó",      "enabled": true,  "minLitros": 1500 },
    { "name": "Equipetrol", "enabled": true,  "minLitros": 1500 },
    { "name": "Vangas",     "enabled": true,  "minLitros": 1500 },
    { "name": "Genex Banzer", "enabled": false, "minLitros": 1500 }
    // … las 23 restantes, enabled:false
  ]
}
```

Reglas de la config:
- `minLitros` por estación define "hay gasolina" (≥ umbral). Default 1500 L (evita
  lecturas residuales/erráticas; consistente con el filtro interno de Gasgroup).
- `setFuelMonitorConfig` hace **merge parcial**: campos top-level y, dentro de
  `stations`, merge por `name`. Estaciones desconocidas (que no estén en el array
  `STATIONS` del worker) se rechazan.
- `checkIntervalMin` editable en caliente: el cron dispara cada 1 min pero solo evalúa
  si pasó `checkIntervalMin` desde el último tick (timestamp `lastRun` en KV).

### 2. Lógica de evaluación — `evaluateStation()` (función pura, testeable)

Estado en KV `monitor_state`, por estación:

```jsonc
{
  "Urubó": {
    "available": false,      // ya estaba disponible
    "since": null,           // epoch ms del flanco de subida
    "lastNotified": null,    // epoch ms del último mensaje enviado
    "remindersSent": 0,
    "lastLitros": 0
  }
}
```

`evaluateStation(prev, litros, stationCfg, globalCfg, now)` → `{ nextState, action }`
donde `action ∈ { "alert", "reminder", null }`:

1. `available = litros >= stationCfg.minLitros`
2. **Flanco de subida** (`!prev.available && available`) → `action:"alert"`;
   `nextState = { available:true, since:now, lastNotified:now, remindersSent:0, lastLitros:litros }`
3. **Sigue disponible** (`prev.available && available`):
   - si `now - prev.lastNotified >= reminderHours*3600e3` y `prev.remindersSent < maxReminders`
     → `action:"reminder"`; `lastNotified:now`, `remindersSent+1`.
   - si no → `action:null`, solo actualiza `lastLitros`.
4. **Flanco de bajada** (`prev.available && !available`) → `action:null`;
   resetea `{ available:false, since:null, lastNotified:null, remindersSent:0 }`.
5. **Sigue vacía** → `action:null`, `lastLitros:litros`.

El handler `scheduled()`:
- si `!globalCfg.enabled` → return.
- gate `checkIntervalMin` (vs `lastRun` en KV).
- `fetchAllStationsData(env)` → mapa name→litros.
- por cada estación con `enabled:true`: `evaluateStation(...)`.
- si `action` y **no** estamos en quiet hours → enviar Telegram.
  (Si quiet hours suprime el envío, igual se persiste el estado para no re-disparar
  el mismo flanco al salir de la ventana; nota: quiet hours arranca apagado.)
- persistir `monitor_state` y `lastRun`.

### 3. Mensajes de Telegram

Envío directo a `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage`,
`parse_mode: HTML`, `chat_id` de la config. Litros con `toLocaleString("es-BO")`.
Link Waze tomado del array `STATIONS` del worker (se le agrega el campo `waze` desde
`stations.js`).

**Alerta (flanco de subida):**
```
⛽🟢 ¡Llegó gasolina!
<b>Urubó</b> (Orsa) — ~12.300 L
📍 <a href="...waze...">Cómo llegar</a>
```

**Recordatorio:**
```
⛽🔔 Todavía hay gasolina
<b>Urubó</b> (Orsa) — ~9.800 L · disponible hace 3h
📍 <a href="...waze...">Cómo llegar</a>
```

### 4. Endpoints HTTP (worker)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/monitor/config` | — | Devuelve config actual (siembra defaults si vacío). |
| POST | `/monitor/config` | `X-Monitor-Token` | Merge parcial; valida nombres de estación. |
| GET | `/monitor/status` | — | Por estación: `enabled`, litros actuales, `available`, `since`, empresa. Insumo del menú de Jano. |

`scheduled(event, env, ctx)` agregado al `export default`.
`wrangler.toml`: `[triggers] crons = ["* * * * *"]`.

### 5. Secrets (worker)

`wrangler secret put`:
- `TELEGRAM_BOT_TOKEN` — token del bot de notificaciones (@ClaudeCalbot, mismo `NOTIF_BOT_TOKEN`).
- `MONITOR_TOKEN` — secreto compartido para autorizar `POST /monitor/config`.

### 6. Tools nuevas en el MCP `combustible`

Apuntan al mismo `PROXY_BASE`. Leen `MONITOR_TOKEN` de `~/.combustible-mcp.env`.

- `getFuelMonitorConfig()` → `GET /monitor/config`.
- `getFuelMonitorStatus()` → `GET /monitor/status` (para armar el menú).
- `setFuelMonitorConfig({ enabled?, checkIntervalMin?, reminderHours?, maxReminders?, quietHours?, chatId?, stations? })`
  → `POST /monitor/config` con header `X-Monitor-Token`. Merge parcial.

### 7. Menú e integración en Jano (daemon)

- Agregar los 3 nombres de tool al allowlist en `agent-options.ts`.
- 1 bloque en `system-prompt.ts`: cómo y cuándo mostrar el **menú de estaciones**.
- **Menú:** Jano llama `getFuelMonitorStatus()` y renderiza las 27 agrupadas por empresa
  (Genex / Biopetrol / Orsa / Rivero), cada fila con toggle ✅/⬜ + litros actuales.
  Tocar una → callback → `setFuelMonitorConfig({ stations:[{name, enabled:!prev}] })` →
  confirma y re-renderiza. Patrón de inline keyboard + ruteo de callbacks ya existente.
- Sin crons internos nuevos en el daemon (Jano sigue 100% reactivo).

## Manejo de errores

- `fetchAllStationsData` ya es resiliente: una fuente caída devuelve 0 L para sus
  estaciones sin matar al resto. Una estación a 0 por error de fetch **no** dispara
  flanco de bajada con notificación (la bajada es silenciosa), así que no genera ruido;
  el riesgo es perder un flanco de subida momentáneo, aceptable a 5 min.
- Fallo al enviar Telegram: se loguea; el estado **no** se marca como notificado para
  reintentar en el siguiente tick (evita perder la alerta).
- `POST /monitor/config` con token inválido → 403. Con JSON inválido o estación
  desconocida → 400 con detalle.

## Testing

- **Unitario** (`tests/proxy/`): `evaluateStation()` — flanco de subida, recordatorio
  por tiempo, tope `maxReminders`, flanco de bajada (reset), bajo umbral (sin alerta),
  gate de quiet hours.
- **Manual:** `wrangler dev --test-scheduled` + `curl .../__scheduled` para forzar un
  tick; verificar mensaje en Telegram. Probar `/monitor/config` GET/POST y `/monitor/status`.

## Decisiones tomadas

- Umbral: opción "mínimo razonable" (≥1500 L default), no "cualquier litro".
- Alerta: flanco de subida + recordatorio cada 3h (máx. 2).
- Sin horario de silencio (alertas 24/7); el parámetro existe apagado por si se quiere luego.
- Chequeo cada 5 min. Canal: bot de notificaciones a chat de Cal.
- Las 27 estaciones quedan configurables; Jano las muestra en menú.

## Archivos afectados

- `repo/proxy/worker.js` — `scheduled()`, endpoints `/monitor/*`, `evaluateStation()`, seed de config, campo `waze` en `STATIONS`.
- `repo/proxy/wrangler.toml` — `[triggers] crons`.
- `repo/tests/proxy/worker.test.js` — tests de `evaluateStation()`.
- `repo/CLAUDE.md` — documentar el monitor.
- MCP `servers/combustible/src/index.ts` (+ `worker.ts` si aplica) — 3 tools nuevas.
- Jano `daemon-v2/src/agent-options.ts` (allowlist) + `system-prompt.ts` (menú).
- `~/.combustible-mcp.env` — `MONITOR_TOKEN`.
- Secrets del worker — `TELEGRAM_BOT_TOKEN`, `MONITOR_TOKEN`.
