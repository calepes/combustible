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
│  fetchAllStationsData(env)  ──►  evaluateStation()  ──┐      │
│   (ya existe: 27 est.)            (función pura)       │      │
│        │                              │               │      │
│        ▼                              ▼               │      │
│   KV CAPACIDAD                  KV monitor_state      │      │
│                                 KV monitor_config     │      │
│                                                       │ POST /fuel/alert
│  HTTP:                                                │ (+ X-Fuel-Secret)
│   GET  /api/stations · GET/POST /monitor/config       │      │
│   GET  /monitor/status                                │      │
└───────────────────────────────────────────────────────┼──────┘
            ▲                              ▲              │
            │ getFuelStatus               │ config/status│ evento de alerta
            │                             │              ▼
   ┌────────┴───────┐            ┌────────┴──────────────────────┐
   │ MCP combustible│            │ Jano                          │
   │ (existente)    │            │  worker-v2: /fuel/alert       │
   └────────────────┘            │     → INBOX (Queue)           │
                                 │  daemon: kind "fuel_alert"    │
                                 │     → re-check litros         │
                                 │     → mensaje + menú a Cal    │
                                 │  bot de Jano (COS_*)          │
                                 └───────────────────────────────┘
```

- **Detección siempre encendida** (cron en Cloudflare, no depende de la laptop).
- **Entrega vía Jano:** el worker no manda Telegram directo; hace POST a `/fuel/alert`
  del worker de Jano, que inyecta un `QueueMessage` al INBOX. El daemon (en la laptop)
  compone el aviso y ofrece el menú, desde el **bot de Jano** (no el de notificaciones).
- **Laptop apagada:** la cola de CF retiene la alerta; al volver, el daemon **re-verifica
  litros actuales** y, si ya no hay gasolina (alerta vieja), la **descarta en silencio**
  (solo la menciona si Cal pregunta). Nunca manda a Cal a una estación seca.
- Reusa `fetchAllStationsData(env)`, KV `CAPACIDAD` y los parsers ya portados al worker.
- Jano sin crons internos nuevos: sigue reactivo; reacciona a un evento externo.

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
- si `action` y **no** estamos en quiet hours → `POST /fuel/alert` a Jano (no Telegram directo).
  (Si quiet hours suprime el envío, igual se persiste el estado para no re-disparar
  el mismo flanco al salir de la ventana; nota: quiet hours arranca apagado.)
- persistir `monitor_state` y `lastRun`.

### 3. Mensajes de Telegram

Los mensajes los **compone y envía Jano** (no el worker), desde el bot de Jano
(`COS_TELEGRAM_BOT_TOKEN`), `parse_mode: HTML`, al chat de Cal. Litros con
`toLocaleString("es-BO")`. Link Waze va en el evento que manda el worker (tomado de su
array `STATIONS`, al que se le agrega el campo `waze` desde `stations.js`).

El worker solo envía el **evento estructurado** a `/fuel/alert` (ver §4); el texto final
es responsabilidad de Jano, que además puede adjuntar el menú o botones de acción.
Formato de referencia que Jano debe producir:

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

### 4. Endpoints HTTP

**Worker combustible:**

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/monitor/config` | — | Devuelve config actual (siembra defaults si vacío). |
| POST | `/monitor/config` | `X-Monitor-Token` | Merge parcial; valida nombres de estación. |
| GET | `/monitor/status` | — | Por estación: `enabled`, litros actuales, `available`, `since`, empresa. Insumo del menú de Jano. |

`scheduled(event, env, ctx)` agregado al `export default`. En cada acción, el worker
hace `POST` al endpoint de Jano (abajo) en lugar de mandar Telegram.
`wrangler.toml`: `[triggers] crons = ["* * * * *"]`.

**Worker de Jano (`worker-v2`) — nuevo:**

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/fuel/alert` | `X-Fuel-Secret` | Recibe `{ events:[{name,company,litros,waze,kind,since}] }`, valida secreto, inyecta `QueueMessage{kind:"fuel_alert", payload:{events}}` al INBOX. |

### 5. Secrets

- **Worker combustible** (`wrangler secret put`):
  - `JANO_ALERT_URL` — URL del endpoint `/fuel/alert` (puede ir como var en `wrangler.toml`).
  - `FUEL_ALERT_SECRET` — secreto compartido para autorizar el POST a Jano.
  - `MONITOR_TOKEN` — secreto para autorizar `POST /monitor/config`.
  - (Ya **no** necesita token de Telegram.)
- **Worker de Jano:**
  - `FUEL_ALERT_SECRET` — para verificar `/fuel/alert` (mismo valor que en combustible).
- **MCP combustible** (`~/.combustible-mcp.env`): `MONITOR_TOKEN`.

### 6. Tools nuevas en el MCP `combustible`

Apuntan al mismo `PROXY_BASE`. Leen `MONITOR_TOKEN` de `~/.combustible-mcp.env`.

- `getFuelMonitorConfig()` → `GET /monitor/config`.
- `getFuelMonitorStatus()` → `GET /monitor/status` (para armar el menú).
- `setFuelMonitorConfig({ enabled?, checkIntervalMin?, reminderHours?, maxReminders?, quietHours?, chatId?, stations? })`
  → `POST /monitor/config` con header `X-Monitor-Token`. Merge parcial.

### 7. Integración en Jano (worker-v2 + daemon)

**Worker-v2:** endpoint `POST /fuel/alert` (ver §4) que verifica `FUEL_ALERT_SECRET` e
inyecta el evento al INBOX (patrón idéntico a `/panini/register`).

**Shared (`shared-v2/src/types.ts`):** extender `QueueMessage.kind` a
`"telegram_update" | "fuel_alert"`; `payload` para `fuel_alert` = `{ events: FuelEvent[] }`.

**Daemon (`daemon-v2/src/index.ts`):** en el loop (junto al `kind === "telegram_update"`),
manejar `kind === "fuel_alert"`:
1. Por cada evento, **re-verificar** litros actuales (`getFuelMonitorStatus` o `/api/stations`).
2. Si la estación ya no está disponible → descartar en silencio (alerta vieja).
3. Si sigue disponible → `runAgent` con un prompt que compone el mensaje (formato §3) y,
   opcionalmente, adjunta botones (menú / "cómo llego").
4. Enviar por el flujo normal de Jano (bot `COS_*`, chat de Cal).

**Menú de estaciones (on-demand, cuando Cal lo pide o desde un botón):**
- Jano llama `getFuelMonitorStatus()` y renderiza las 27 agrupadas por empresa
  (Genex / Biopetrol / Orsa / Rivero), cada fila con toggle ✅/⬜ + litros actuales.
- Tocar una → callback → `setFuelMonitorConfig({ stations:[{name, enabled:!prev}] })` →
  confirma y re-renderiza. Inline keyboard + ruteo de callbacks (patrón existente).

**Config de tools:** agregar `getFuelMonitorConfig` / `getFuelMonitorStatus` /
`setFuelMonitorConfig` al allowlist en `agent-options.ts`; bloque en `system-prompt.ts`
explicando el menú y el manejo de `fuel_alert`.

- Sin crons internos nuevos en el daemon (Jano sigue reactivo; el `fuel_alert` es un
  evento externo que entra por la cola, no un cron interno).

## Manejo de errores

- `fetchAllStationsData` ya es resiliente: una fuente caída devuelve 0 L para sus
  estaciones sin matar al resto. Una estación a 0 por error de fetch **no** dispara
  flanco de bajada con notificación (la bajada es silenciosa), así que no genera ruido;
  el riesgo es perder un flanco de subida momentáneo, aceptable a 5 min.
- Fallo al hacer `POST /fuel/alert` a Jano: se loguea; el estado **no** se marca como
  notificado, para reintentar en el siguiente tick (evita perder la alerta).
- **Laptop apagada / daemon caído:** la cola de CF retiene el `fuel_alert`. Al volver, el
  daemon re-verifica litros y descarta en silencio las alertas ya vencidas (estación seca).
- `POST /monitor/config` con token inválido → 403. Con JSON inválido o estación
  desconocida → 400 con detalle. `/fuel/alert` con secreto inválido → 401.

## Testing

- **Unitario** (`tests/proxy/`): `evaluateStation()` — flanco de subida, recordatorio
  por tiempo, tope `maxReminders`, flanco de bajada (reset), bajo umbral (sin alerta),
  gate de quiet hours.
- **Manual:** `wrangler dev --test-scheduled` + `curl .../__scheduled` para forzar un
  tick; verificar que llega el `POST /fuel/alert` a Jano y que Jano manda el mensaje.
  Probar `/monitor/config` GET/POST, `/monitor/status` y `/fuel/alert` (con/sin secreto).

## Decisiones tomadas

- Umbral: opción "mínimo razonable" (≥1500 L default), no "cualquier litro".
- Alerta: flanco de subida + recordatorio cada 3h (máx. 2).
- Sin horario de silencio (alertas 24/7); el parámetro existe apagado por si se quiere luego.
- Chequeo cada 5 min.
- **Entrega vía Jano** (no Telegram directo): la alerta entra como evento `fuel_alert` por
  la cola de Jano, que la compone y la manda desde **su bot**, permitiendo interacción.
- Alerta vencida (laptop estuvo apagada): **descarte silencioso** tras re-verificar litros.
- Las 27 estaciones quedan configurables; Jano las muestra en menú.

## Archivos afectados

- `repo/proxy/worker.js` — `scheduled()`, endpoints `/monitor/*`, `evaluateStation()`, seed de config, campo `waze` en `STATIONS`, `POST /fuel/alert` a Jano.
- `repo/proxy/wrangler.toml` — `[triggers] crons`, var `JANO_ALERT_URL`.
- `repo/tests/proxy/worker.test.js` — tests de `evaluateStation()`.
- `repo/CLAUDE.md` — documentar el monitor.
- MCP `servers/combustible/src/index.ts` (+ `worker.ts` si aplica) — 3 tools nuevas.
- Jano `worker-v2/src/index.ts` — endpoint `/fuel/alert`.
- Jano `shared-v2/src/types.ts` — `QueueMessage.kind` + tipo `FuelEvent`.
- Jano `daemon-v2/src/index.ts` — dispatch `fuel_alert` + re-check de frescura.
- Jano `daemon-v2/src/agent-options.ts` (allowlist) + `system-prompt.ts` (menú + fuel_alert).
- `~/.combustible-mcp.env` — `MONITOR_TOKEN`.
- Secrets worker combustible — `FUEL_ALERT_SECRET`, `MONITOR_TOKEN`. Secret worker Jano — `FUEL_ALERT_SECRET`.
