---
id: infra-registry
title: Registry
sidebar_position: 1
description: The Nexus registry — Rust + axum + sqlx. Source of truth for hosts, gates, remotes, and platform configuration. Full HTTP API and WebSocket surface.
keywords:
  - micro frontend registry
  - Rust web server
  - micro frontend platform
  - axum
  - high availability frontend
---

# Registry

The registry is the source of truth for the Nexus platform. Every host, every gate, every remote, every runtime configuration value lives in its database. Hosts and the gateway read from it; the portal writes to it; the WebSocket fans out every change to every subscriber.

Code: `nexus-registry/`. Stack: Rust, [axum](https://docs.rs/axum), [sqlx](https://docs.rs/sqlx), [tokio](https://tokio.rs).

## What it owns

| Entity | Description |
|---|---|
| `Host` | A shell application. Name, URL, framework (angular/vue/react), `remoteEntry`, `exposedModule`. |
| `Gate` | A public entry bound to a domain. Points to one host. |
| `Remote` | A micro frontend. Name, URL, `exposedModule`, `routePath`, `visibility` (`global` or `host:<id>`). |
| `Config` | Six platform-level toggles, all hot-reloadable: rate limiting, WS reconnect policy, circuit breaker, graceful shutdown, metrics, token rotation. |
| `Gateway protection` | Fifteen DDoS settings shipped to every gateway over WebSocket. |
| `Tokens` | The active `NEXUS_TOKEN`, its hash, optional previous-token grace period. |

## HTTP API surface

All endpoints under `/api/*` require `X-Nexus-Token`. `/health` is public.

### Health and system

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness probe. Returns `{ status, db, wsClients }`. |
| `GET` | `/api/system/health` | Cached system snapshot (registry + upstream remote health). `?fresh=true` runs a live cycle. |
| `GET` | `/api/system/config` | Current process config (read-only — env-loaded). |
| `GET` | `/api/system/logs` | Ring-buffered logs. Query: `since`, `limit`, `level`. |
| `GET` | `/api/system/metrics` | Internal counters snapshot. JSON. |
| `POST` | `/api/system/shutdown` | Trigger graceful shutdown sequence. |

### Hosts

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/hosts` | List all hosts with gate counts. |
| `POST` | `/api/hosts` | Create. Body: `{ name, url, framework, remoteEntry, exposedModule, enabled? }`. |
| `GET` | `/api/hosts/{id}` | Detail. |
| `PUT` | `/api/hosts/{id}` | Update. Partial. |
| `DELETE` | `/api/hosts/{id}` | Delete. Returns 409 if gates reference it. |
| `GET` | `/api/hosts/{id}/remotes` | List remotes visible to this host (globals + host-specific). |
| `POST` | `/api/hosts/{id}/toggle` | Toggle enabled flag. |

Validation: `name` matches `[a-zA-Z][a-zA-Z0-9]*`. `framework` must be `angular` / `vue` / `react`. `remoteEntry` must start with `/` or be an `https://` URL. `exposedModule` must start with `./`.

### Gates

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/gates` | List all gates. |
| `POST` | `/api/gates` | Create. Body: `{ name, domain, hostId?, enabled? }`. |
| `GET` | `/api/gates/{id}` | Detail (includes embedded host). |
| `GET` | `/api/gates/by-domain/{domain}` | Lookup by domain. Used by the gateway. |
| `PUT` | `/api/gates/{id}` | Update. Partial. Changes broadcast `host_reassigned` if the gate moves to a different host. |
| `DELETE` | `/api/gates/{id}` | Delete. |
| `POST` | `/api/gates/{id}/toggle` | Toggle enabled flag. |

Validation: `domain` is a valid hostname with optional `:port`, no protocol prefix.

### Remotes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/remotes` | List all remotes. Query: `?host_id=<id>` filters to remotes visible to that host. |
| `POST` | `/api/remotes` | Create. Body: `{ name, url, routePath, exposedModule?, enabled?, upstreamUrl?, visibility? }`. |
| `GET` | `/api/remotes/{name}` | Detail. |
| `PUT` | `/api/remotes/{name}` | Update. Partial. |
| `DELETE` | `/api/remotes/{name}` | Delete. |
| `POST` | `/api/remotes/{name}/toggle` | Toggle enabled flag. |
| `POST` | `/api/remotes/{name}/redeploy` | Log a redeploy signal (returns 202). Orchestration is your responsibility. |

Validation: `name` is camelCase, `routePath` is kebab-case, `url` is `http(s)` or absolute path, `exposedModule` starts with `./`. `visibility` is `global` or `host:<id>` where `<id>` must reference an existing host.

### Config (hot-reloadable platform features)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/config` | Snapshot of all config. |
| `PUT` | `/api/config` | Bulk update; partial body accepted. |
| `GET/PUT` | `/api/config/rate-limiting` | Per-key rate limit (registry's own ingress). |
| `GET/PUT` | `/api/config/ws-reconnect` | Backoff policy broadcast to every WebSocket client. |
| `GET/PUT` | `/api/config/circuit-breaker` | Health-check circuit breaker. |
| `GET` | `/api/config/circuit-breaker/state` | Current state per remote. |
| `POST` | `/api/config/circuit-breaker/reset` | Reset all breakers. |
| `POST` | `/api/config/circuit-breaker/reset/{remote}` | Reset one breaker. |
| `GET/PUT` | `/api/config/graceful-shutdown` | Drain behavior. |
| `GET/PUT` | `/api/config/metrics` | Prometheus exporter config (path, auth). |
| `GET` | `/api/config/token` | Token metadata (no secret). |
| `POST` | `/api/config/token/rotate` | Rotate the active token with optional grace period. |
| `DELETE` | `/api/config/token/previous` | Revoke the previous token immediately. |
| `GET` | `/api/config/gateway` | Composite payload the gateway loads at startup. |
| `GET/PUT` | `/api/config/gateway/protection` | The seven-layer protection config the gateway enforces. |

Every `PUT` validates the payload server-side before writing. Out-of-range values return `400 validation_failed`.

## WebSocket

`GET /api/ws` upgrades to a WebSocket. The server sends a `welcome` frame on connect:

```json
{
  "type": "welcome",
  "timestamp": "2026-01-01T00:00:00Z",
  "clients": 4,
  "reconnect_policy": {
    "initial_delay_ms": 1000,
    "max_delay_ms": 30000,
    "backoff_multiplier": 2.0,
    "jitter_ms": 250,
    "max_attempts": 0
  }
}
```

Server messages:

| Type | Payload | When |
|---|---|---|
| `welcome` | client count, reconnect policy | on connect |
| `remotes_changed` | full remote list, trigger | any remote CRUD |
| `host_changed` | host, trigger | any host CRUD |
| `gate_changed` | gate (with host), trigger, optional `old_host_id` / `new_host_id` | any gate CRUD |
| `config_changed` | section, value | any config PUT |
| `reconnect_policy_changed` | policy | when WS reconnect config changes |
| `system_health` | snapshot | periodic |
| `log` | entry | live log streaming |
| `token_rotated` | `{ previous_token_expired }` | after rotation |
| `registry_shutting_down` | `{ resume_in_ms }` | before graceful shutdown |
| `pong` | timestamp | response to ping |

Client messages:

| Type | Payload | Purpose |
|---|---|---|
| `ping` | — | keep-alive |
| `subscribe` | `{ subscribe: "<channel>" }` | reserved for future scope filters |
| `unsubscribe` | `{ subscribe: "<channel>" }` | unsubscribe |
| `subscribe_gate` | `{ gate_name }` | gateway uses this to scope updates to its gate |

A complete schema is in [reference: websocket-messages](../reference/websocket-messages.md).

## Storage

SQLite by default (`sqlite:./data/registry.db`). The schema is created on first boot and migrated forward automatically. PostgreSQL is on the HA roadmap — see [infra-high-availability](infra-high-availability.md).

## Configuration features in detail

### Rate limiting

| Field | Range | Default |
|---|---|---|
| `enabled` | bool | true |
| `requestsPerSecond` | 1–1000 | 100 |
| `burstSize` | 1–500 (≥ rps) | 200 |
| `by` | `ip` or `token` | `ip` |

The registry uses a token bucket. Each authenticated key (or IP, depending on `by`) gets its own bucket.

### WebSocket reconnect policy

Pushed to every connected client in the `welcome` frame and `reconnect_policy_changed`. Clients should respect it.

| Field | Range | Default |
|---|---|---|
| `initialDelayMs` | 100–10 000 | 1 000 |
| `maxDelayMs` | 1 000–300 000 | 30 000 |
| `backoffMultiplier` | 1.0–10.0 | 2.0 |
| `jitterMs` | 0–5 000 | 250 |
| `maxAttempts` | 0 (∞) – 1 000 | 0 |

### Circuit breaker (health checks)

When a remote fails health checks consistently, its breaker opens — the registry stops calling it for `openDurationMs`. Half-open state lets a small number of probes through to test recovery.

| Field | Range | Default |
|---|---|---|
| `enabled` | bool | true |
| `failureThreshold` | 1–20 | 5 |
| `successThreshold` | 1–10 | 2 |
| `openDurationMs` | 1 000–3 600 000 | 60 000 |
| `halfOpenMaxCalls` | 1–5 | 3 |

### Graceful shutdown

| Field | Range | Default |
|---|---|---|
| `timeoutMs` | 1 000–60 000 | 10 000 |
| `wsNoticeMs` | 500–10 000 (`< timeoutMs`) | 2 000 |

When the registry receives SIGTERM, it broadcasts `registry_shutting_down` immediately, waits `wsNoticeMs` for clients to flush, then drains HTTP for the remaining budget before exiting.

### Metrics

| Field | Default |
|---|---|
| `prometheusEnabled` | true |
| `prometheusPath` | `/metrics` |
| `requireAuth` | false |
| `customLabels` | `{}` |

The Prometheus exporter is in-process. The path is configurable to support reverse-proxy conventions.

### Token rotation

Rotate via `POST /api/config/token/rotate` with `{ newToken, gracePeriodSeconds }`. The previous token is honored until the grace period expires. `DELETE /api/config/token/previous` revokes it immediately.

The registry stores token hashes with a configurable `NEXUS_TOKEN_PEPPER`. Set the pepper in production via env var; otherwise the registry warns on every start.

## Reading the code

- Entry: `nexus-registry/src/main.rs`.
- API: `nexus-registry/src/api/{remotes,hosts,gates,system}.rs`.
- Config routes: `nexus-registry/src/config/routes.rs`.
- WebSocket: `nexus-registry/src/ws/{hub,messages}.rs`.
- Store (SQLite): `nexus-registry/src/store/sqlite.rs`.
- Protection state: `nexus-registry/src/features/`.

## Next

- [Infra: gateway](infra-gateway.md) — what consumes this registry.
- [Infra: hosts and gates](infra-hosts-and-gates.md) — the mental model.
- [Reference: api-reference](../reference/api-reference.md) — every request/response shape.
