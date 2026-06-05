---
id: api-reference
title: HTTP API reference
sidebar_position: 3
description: Every Nexus HTTP endpoint. Registry CRUD for hosts, gates, remotes, config, system. Gateway health and protection endpoints. Request and response shapes.
keywords:
  - Nexus HTTP API
  - micro frontend API
  - REST API reference
  - micro frontend registry API
---

# HTTP API reference

Every HTTP endpoint exposed by Nexus.

## Conventions

- Base URL: `http://localhost:8668/api/*` (in production: `https://your-gateway/api/*`).
- Auth (registry, gateway, host): `X-Nexus-Token` header on every `/api/*` request. `/health` is public on every service.
- Auth (portal BFF — `/api/auth/*`, `/api/users`, `/api/ws`, and the proxied `/api/*` calls reaching the registry): session cookie (`nexus_session`, httpOnly, signed, `SameSite=Lax`). Issued by `POST /api/auth/login`. The portal BFF attaches `X-Nexus-Token` server-side when forwarding to the registry; the browser never sees the token.
- Correlation: include `X-Request-ID` (ULID or UUIDv4) for tracing. The server generates one if absent.
- Errors: `{ "error": "<code>", "message": "<human>", "correlationId": "<id>" }`. Portal BFF errors use a shorter shape: `{ "error": "<human>", "code"?: "<machine>" }`.

## Registry — health

### GET /health

Public. Returns `{ status, service, db, wsClients, timestamp }`. Status `ok` or `degraded`.

## Registry — remotes

### GET /api/remotes

Query: `?host_id=<id>` to filter to remotes visible to a specific host.

Response: `{ remotes: RemoteConfig[], total: number, enabled: number }`.

### POST /api/remotes

Body:

```ts
{
  name: string;             // camelCase
  url: string;              // http(s) URL or absolute path
  routePath: string;        // kebab-case
  exposedModule?: string;   // default "./RemoteEntry"
  enabled?: boolean;        // default true
  upstreamUrl?: string;
  visibility?: 'global' | 'host:<id>';   // default 'global'
}
```

Returns `201 RemoteConfig`. Broadcasts `remotes_changed`.

### GET /api/remotes/`{name}`

Returns the `RemoteConfig`.

### PUT /api/remotes/`{name}`

Partial update. Same body shape as POST but every field optional.

### DELETE /api/remotes/`{name}`

Returns `204`. Broadcasts `remotes_changed`.

### POST /api/remotes/`{name}`/toggle

Toggles `enabled`. Returns the updated `RemoteConfig`. Broadcasts.

### POST /api/remotes/`{name}`/redeploy

Logs a redeploy signal. Returns `202 { accepted, remote, timestamp, note }`. Container orchestration is your responsibility.

## Registry — hosts

### GET /api/hosts

Returns `Host[]` with embedded gate counts.

### POST /api/hosts

```ts
{
  name: string;              // letters + digits, starts with letter
  url: string;               // http(s), no trailing slash
  framework: 'angular' | 'vue' | 'react';
  remoteEntry: string;       // starts with / or https://
  exposedModule: string;     // starts with ./
  enabled?: boolean;
}
```

Returns `201 Host`. Broadcasts `host_changed`.

### GET /api/hosts/`{id}`

Returns the `Host`.

### PUT /api/hosts/`{id}`

Partial update.

### DELETE /api/hosts/`{id}`

Returns `204` if deleted. Returns `409` with `blockingGates` in the body if any gates still reference the host. Broadcasts.

### GET /api/hosts/`{id}`/remotes

Returns `hostId`, `remotes`, `total` — `global` remotes plus remotes pinned to this host with a `source: 'global' | 'host-specific'` discriminator.

### POST /api/hosts/`{id}`/toggle

Toggles `enabled`. Broadcasts.

## Registry — gates

### GET /api/gates

Returns `GateWithHost[]` — each gate with its embedded host (or null).

### POST /api/gates

```ts
{
  name: string;       // letters + digits
  domain: string;     // valid hostname with optional :port, no protocol
  hostId?: string;
  enabled?: boolean;
}
```

Returns `201 GateWithHost`. Broadcasts `gate_changed`.

### GET /api/gates/`{id}`

Returns the `GateWithHost`.

### GET /api/gates/by-domain/`{domain}`

Lookup by domain. Used by the gateway at startup.

### PUT /api/gates/`{id}`

Partial update. If `hostId` changes, the broadcast includes `trigger: 'host_reassigned'` and both `oldHostId` and `newHostId`.

### DELETE /api/gates/`{id}`

Returns `204`. Broadcasts.

### POST /api/gates/`{id}`/toggle

Toggles `enabled`. Broadcasts.

## Registry — system

### GET /api/system/health

Snapshot of registry + upstream remote health. Cached. Query `?fresh=true` to force a live cycle.

### GET /api/system/config

Returns the env-loaded process configuration (read-only).

### GET /api/system/logs

Query: `since`, `limit`, `level`.

Returns `{ entries: LogEntry[] }`.

### GET /api/system/metrics

Internal counters snapshot. JSON. Distinct from the Prometheus `/metrics` endpoint.

### POST /api/system/shutdown

Triggers graceful shutdown. Returns `202`.

## Registry — config

See [reference: configuration](configuration.md) for the full shapes. Endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/api/config` | Bulk read/write |
| GET/PUT | `/api/config/rate-limiting` | Registry ingress rate limit |
| GET/PUT | `/api/config/ws-reconnect` | WS reconnect policy |
| GET/PUT | `/api/config/circuit-breaker` | Health-check breaker |
| GET | `/api/config/circuit-breaker/state` | Current per-remote state |
| POST | `/api/config/circuit-breaker/reset` | Reset all |
| POST | `/api/config/circuit-breaker/reset/{remote}` | Reset one |
| GET/PUT | `/api/config/graceful-shutdown` | Shutdown timings |
| GET/PUT | `/api/config/metrics` | Prometheus exporter |
| GET | `/api/config/token` | Token metadata (no secret) |
| POST | `/api/config/token/rotate` | Rotate active token |
| DELETE | `/api/config/token/previous` | Revoke grace-period token |
| GET | `/api/config/gateway` | Composite gateway config payload |
| GET/PUT | `/api/config/gateway/protection` | Seven-layer protection settings |

## Gateway

### GET /health (gateway)

Public. Returns `{ status, service, version, registry_connected, gate, host, framework, route_count }`.

### GET /metrics

Public. Prometheus text format.

### GET /ws

WebSocket upgrade. Proxies to the registry's `/api/ws`. See [reference: websocket-messages](websocket-messages.md) for message types.

### GET /api/protection/status

Token-required. Returns `{ active_bans, top_ips, rate_limit_config, total_requests_blocked_since_start }`.

### POST /api/protection/ban

Body: `{ ip: string, duration_seconds?: number }`. Returns `{ banned, duration_seconds }`.

### DELETE /api/protection/ban/`{ip}`

Returns `{ unbanned, was_banned }`.

### DELETE /api/protection/bans

Clears every ban. Returns `{ cleared }`.

## Portal BFF — authentication

All endpoints on the portal BFF authenticate by session cookie. The BFF itself does not accept `X-Nexus-Token` from the browser; it injects the token server-side when proxying to the registry.

### POST /api/auth/login

Body: `{ "username": string, "password": string }`.

Sets the `nexus_session` cookie on success. Returns `{ username, role, must_change_password }`. On bad credentials: `401 { error: "invalid credentials" }`.

### POST /api/auth/logout

Deletes the server-side session row and clears the cookie. Returns `{ status: "ok" }`.

### GET /api/auth/me

Returns `{ username, role, must_change_password }` for the current session, or `401` if no valid session.

### POST /api/auth/change-password

Body: `{ "current_password": string, "new_password": string }`. New password must be at least 8 characters.

The only endpoint a user with `must_change_password=true` can call (other than `/api/auth/me` and `/api/auth/logout`). Every other endpoint returns `403 { error: "password change required", code: "must_change_password" }` until the user changes their password.

## Portal BFF — users (admin-only)

All endpoints require role `admin`. Developer-role sessions get `403 { error: "insufficient permissions" }`.

### GET /api/users

Returns `User[]` with `{ id, username, role, must_change_password, created_at, last_login_at }`.

### POST /api/users

Body: `{ "username": string, "password": string, "role": "admin" | "developer" }`. Password ≥ 8 characters.

Created users always start with `must_change_password=true`.

Returns the new user. Conflicts on duplicate username return `409`.

### PATCH /api/users/`{id}`

Body: `{ "password"?: string, "role"?: "admin" | "developer" }`. Updating the password clears `must_change_password`. Returns the updated user.

### DELETE /api/users/`{id}`

Deletes the user and revokes all their sessions. Returns `{ status: "ok" }`. An admin cannot delete their own account (`400`).

## Error codes

| Code | Meaning |
|---|---|
| `invalid_body` | JSON body required or malformed. |
| `validation_failed` | Field-level validation failed. Message contains the rule violated. |
| `not_found` | Entity not found. |
| `conflict` | Name or domain already in use. |
| `unauthorized` | Missing or invalid `X-Nexus-Token`. |
| `internal_server_error` | Server-side failure. Correlation id always present. |

## Next

- [Reference: websocket-messages](websocket-messages.md) — every WS message type.
- [Reference: configuration](configuration.md) — config schemas.
- [Infra: registry](../infrastructure/infra-registry.md) — the API in context.
