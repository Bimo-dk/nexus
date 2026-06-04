---
id: registry
title: Registry
sidebar_position: 2
description: The Nexus registry — Node/Express source of truth for all remotes. WebSocket broadcast on change, JSON persistence, observability endpoints for logs, metrics, and health checks.
keywords: [micro frontend registry, Angular remote registry, WebSocket micro frontend, micro frontend source of truth]
---

# Registry

Repo: [`nexus-registry`](https://github.com/Bimo-dk/nexus-registry) — Image: `ghcr.io/bimo-dk/nexus-registry`

The **registry** is the source of truth for which remotes the host should load. It is a small Node 22 / Express 5 service with an on-disk JSON store, a WebSocket broadcast channel, and an in-process health-check loop.

## What it stores

`data/registry.json` is the only persistent file. Schema:

```jsonc
{
  "remotes": [
    {
      "name": "catalog",
      "url": "/remotes/catalog/remoteEntry.json",
      "exposedModule": "./CatalogPage",
      "routePath": "products",
      "enabled": true,
      "addedAt": "2026-06-01T12:34:56.789Z"
    }
  ]
}
```

Writes use a `tmp + rename` pattern with an in-process write lock — no half-written file is ever visible. Mount this directory as a Docker volume so the data survives container restarts:

```yaml
registry:
  volumes:
    - registry-data:/app/data
```

## HTTP API

Base URL: `http://localhost:8668/api` (through gateway) or `http://registry:3000/api` (in-cluster).

All routes require the header `X-Nexus-Token: <NEXUS_TOKEN>` except `GET /health`.

### Remotes

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/remotes`           | List all remotes |
| `GET`    | `/api/remotes/:name`     | One remote |
| `POST`   | `/api/remotes`           | Create a remote |
| `PUT`    | `/api/remotes/:name`     | Update a remote |
| `DELETE` | `/api/remotes/:name`     | Remove a remote |
| `POST`   | `/api/remotes/:name/toggle`   | Flip `enabled` |
| `POST`   | `/api/remotes/:name/redeploy` | Log a redeploy signal (orchestrator-agnostic) |

#### Validation

- `name` — `/^[a-zA-Z][a-zA-Z0-9]*$/` (camelCase)
- `routePath` — `/^[a-z0-9-]+$/` (kebab-case)
- `url` — http(s) URL or path starting with `/`
- `exposedModule` — must start with `./`

A failed validation returns `400 { error, message, correlationId }`. A duplicate `name` returns `409 conflict`.

### System

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/system/health`  | Aggregated health snapshot (cached, `?fresh=true` to force) |
| `GET` | `/api/system/config`  | Effective env-derived configuration |
| `GET` | `/api/system/logs`    | Recent log entries from the in-memory ring buffer |
| `GET` | `/api/system/metrics` | Request counters, latency stats, custom counters |

### Public

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness probe — no auth |

## WebSocket — `/ws`

The registry attaches a WebSocket server at the same port. Connect with the same `X-Nexus-Token` header (or query param if your client cannot set headers).

### Messages from server → client

```ts
type ServerMessage =
  | { type: 'welcome'; timestamp: string; clients: number }
  | { type: 'remotes_changed'; timestamp: string; remotes: RemoteConfig[]; trigger: string }
  | { type: 'system_health'; timestamp: string; snapshot: HealthSnapshot }
  | { type: 'log'; entry: LogEntry }
  | { type: 'pong'; timestamp: string };
```

- `remotes_changed` is broadcast every time the registry mutates — `add:<name>`, `update:<name>`, `toggle:<name>`, `delete:<name>`. Hosts react by re-running their route registration.
- `system_health` is broadcast after every health-check cycle.
- `log` is only sent to clients that opted in (see below).

### Messages from client → server

```ts
{ type: 'ping' }                                       // → pong
{ type: 'subscribe',   subscribe: 'logs' }             // start log stream
{ type: 'unsubscribe', subscribe: 'logs' }             // stop log stream
```

Subscribing to logs is what powers the portal's live log viewer — no polling.

## Observability

### Log buffer

`captureConsole()` intercepts every `console.*` call into a 500-entry ring buffer (configurable via `LOG_BUFFER_CAPACITY`). Each entry:

```ts
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, unknown>;
}
```

Available via:

- `GET /api/system/logs?since=ISO&limit=N&level=info`
- WebSocket subscription `{ type: 'subscribe', subscribe: 'logs' }`

### Metrics

`metricsMiddleware` records per-route counts, status code histograms, p50/p95 latencies. Snapshot via `GET /api/system/metrics`.

### Health-check loop

Every `HEALTH_CHECK_INTERVAL_MS` (default 30s), the registry hits each remote's `<url>/../health` and stores the result. The portal dashboard reads the cached snapshot.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `NEXUS_TOKEN` | — | required; matched against `X-Nexus-Token` |
| `ALLOWED_ORIGINS` | `*` | comma-separated CORS allowlist |
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | |
| `LOG_BUFFER_CAPACITY` | `500` | |
| `SYSTEM_SERVICES` | `''` | extra service URLs whose health to track |

## Error responses

All non-2xx responses share a shape:

```json
{
  "error": "validation_failed",
  "message": "name must be camelCase, starting with a letter",
  "correlationId": "01HXYZ..."
}
```

The `correlationId` ties the response to the matching log line on the server.

## Running standalone

```bash
cd nexus-registry
npm ci
NEXUS_TOKEN=dev-token npm run dev  # tsx watch on :3000
```

For Docker dev (no Angular):

```bash
docker compose -f docker-compose.dev.yml up
```

## Testing the API

```bash
TOKEN=dev-token

# List
curl -H "X-Nexus-Token: $TOKEN" http://localhost:3000/api/remotes

# Add
curl -X POST -H "Content-Type: application/json" -H "X-Nexus-Token: $TOKEN" \
  -d '{"name":"checkout","url":"/remotes/checkout/remoteEntry.json","routePath":"checkout"}' \
  http://localhost:3000/api/remotes

# Toggle
curl -X POST -H "X-Nexus-Token: $TOKEN" http://localhost:3000/api/remotes/checkout/toggle

# WebSocket (one-liner with websocat)
websocat -H "X-Nexus-Token: $TOKEN" ws://localhost:3000/ws
```
