---
id: api
title: Registry HTTP & WS API
sidebar_position: 3
---

# Registry HTTP & WS API

Base URL: `http://localhost:8668/api` (through gateway) or `http://registry:3000/api` (intra-network).

All requests require the header `X-Nexus-Token: <NEXUS_TOKEN>` except `GET /health`. The response shape for all errors is:

```json
{
  "error": "<machine_code>",
  "message": "<human-friendly>",
  "correlationId": "<uuid>"
}
```

## Remotes

### `GET /api/remotes`

List all remotes.

```http
GET /api/remotes
X-Nexus-Token: <token>
```

```json
{
  "remotes": [
    {
      "name": "checkout",
      "url": "/remotes/checkout/remoteEntry.json",
      "exposedModule": "./RemoteEntry",
      "routePath": "checkout",
      "enabled": true,
      "addedAt": "2026-06-01T12:34:56.789Z"
    }
  ],
  "total": 1,
  "enabled": 1
}
```

### `GET /api/remotes/:name`

```json
{ "name": "checkout", "url": "...", ... }
```

Returns `404 { error: "not_found" }` if missing.

### `POST /api/remotes`

```http
POST /api/remotes
Content-Type: application/json
X-Nexus-Token: <token>

{
  "name": "checkout",
  "url": "/remotes/checkout/remoteEntry.json",
  "routePath": "checkout",
  "exposedModule": "./RemoteEntry",
  "enabled": true
}
```

`exposedModule` defaults to `./RemoteEntry`. `enabled` defaults to `true`.

Validation rules:

- `name`: `/^[a-zA-Z][a-zA-Z0-9]*$/`
- `routePath`: `/^[a-z0-9-]+$/`
- `url`: `http(s)://` URL or path beginning with `/`
- `exposedModule`: must start with `./`

Responses:

- `201 <RemoteConfig>` — created. Broadcast `remotes_changed: add:<name>`.
- `400 validation_failed`
- `409 conflict` — name already exists.

### `PUT /api/remotes/:name`

Partial update.

```http
PUT /api/remotes/checkout
Content-Type: application/json
X-Nexus-Token: <token>

{ "url": "https://cdn.example.com/checkout/remoteEntry.json" }
```

Responses:

- `200 <RemoteConfig>` — updated. Broadcast `remotes_changed: update:<name>`.
- `400 validation_failed` (if invalid `url`/`routePath` is given)
- `404 not_found`

`name` cannot be changed via PUT — delete + recreate.

### `DELETE /api/remotes/:name`

```http
DELETE /api/remotes/checkout
X-Nexus-Token: <token>
```

Responses:

- `204` no content. Broadcast `remotes_changed: delete:<name>`.
- `404 not_found`

### `POST /api/remotes/:name/toggle`

Flip the `enabled` field.

Responses:

- `200 <RemoteConfig>` — broadcast `remotes_changed: toggle:<name>`.
- `404 not_found`

### `POST /api/remotes/:name/redeploy`

Logs a redeploy signal. The registry does **not** execute a deploy itself — your orchestrator (Swarm, k8s, ECS) is responsible. This endpoint exists so portal/UI can record an intent.

Response: `202`:

```json
{
  "accepted": true,
  "remote": "checkout",
  "timestamp": "2026-06-01T12:34:56.789Z",
  "correlationId": "...",
  "note": "Redeploy is logged. Container orchestration (Docker Swarm/K8s) is responsible for actually redeploying."
}
```

## System

### `GET /api/system/health`

Aggregated health snapshot. Cached, refreshed every `HEALTH_CHECK_INTERVAL_MS`.

```http
GET /api/system/health
X-Nexus-Token: <token>
```

```json
{
  "lastCheck": "2026-06-01T12:34:56.789Z",
  "remotes": [
    { "name": "checkout", "status": "healthy", "latencyMs": 12, "url": "..." }
  ],
  "systemServices": []
}
```

Force a fresh check with `?fresh=true`.

### `GET /api/system/config`

Read-only view of the registry's effective config.

```json
{
  "nodeEnv": "production",
  "port": 3000,
  "healthCheckIntervalMs": 30000,
  "logBufferCapacity": 500,
  "allowedOrigins": ["..."],
  "systemServices": [],
  "nexusTokenConfigured": true,
  "wsClients": 3,
  "nodeVersion": "v22.x",
  "uptimeSec": 12345
}
```

### `GET /api/system/logs`

```http
GET /api/system/logs?since=2026-06-01T12:00:00Z&limit=100&level=warn
X-Nexus-Token: <token>
```

```json
{
  "entries": [
    {
      "timestamp": "2026-06-01T12:34:56.789Z",
      "level": "info",
      "message": "[remotes] [01HXY...] POST /api/remotes",
      "meta": { ... }
    }
  ]
}
```

Query params:

| Param | Type | Default |
|---|---|---|
| `since` | ISO 8601 | none — all in buffer |
| `limit` | number | 100 |
| `level` | `debug` `info` `warn` `error` | all |

### `GET /api/system/metrics`

```json
{
  "requests": { "total": 12345, "byRoute": { "GET /api/remotes": 5000 } },
  "latencies": { "p50Ms": 8, "p95Ms": 41, "p99Ms": 120 },
  "errors": { "total": 4, "byStatus": { "401": 3, "404": 1 } },
  "counters": { "broadcasts": 14 },
  "uptimeSec": 12345
}
```

## Public

### `GET /health`

```http
GET /health
```

```json
{
  "status": "ok",
  "timestamp": "2026-06-01T12:34:56.789Z",
  "service": "nexus-registry",
  "wsClients": 3
}
```

**No auth.** Liveness probe.

## WebSocket — `/ws`

Connect to `ws://localhost:3000/ws` (or `wss://...` in prod). Same `X-Nexus-Token` header as HTTP.

### Server → client messages

```ts
type ServerMessage =
  | { type: 'welcome'; timestamp: string; clients: number }
  | { type: 'remotes_changed'; timestamp: string; remotes: RemoteConfig[]; trigger: string }
  | { type: 'system_health'; timestamp: string; snapshot: HealthSnapshot }
  | { type: 'log'; entry: LogEntry }
  | { type: 'pong'; timestamp: string };
```

| Message | When sent |
|---|---|
| `welcome` | Right after connect. |
| `remotes_changed` | After any registry mutation (add/update/toggle/delete). `trigger` is e.g. `add:checkout`. |
| `system_health` | After every health-check cycle. |
| `log` | Only to clients that subscribed to logs. |
| `pong` | In response to a client `ping`. |

### Client → server messages

```json
{ "type": "ping" }
{ "type": "subscribe",   "subscribe": "logs" }
{ "type": "unsubscribe", "subscribe": "logs" }
```

### Reconnect

If using `@bimo-dk/nexus-client`'s `RegistryWebSocket`, reconnect is automatic with exponential backoff (1s → 30s max). For your own clients, implement the same — the registry does not restore session state.

## Headers

| Header | Direction | Meaning |
|---|---|---|
| `X-Nexus-Token` | request | Required on all routes except `/health` |
| `X-Request-ID` | request and response | Client-generated UUID; echoed back to enable cross-system correlation |
| `Content-Type: application/json` | request | Required on POST/PUT |
