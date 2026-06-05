---
id: architecture
title: Registry internals — architecture
sidebar_position: 1
description: Module-level architecture of nexus-registry. AppState, sqlx storage, WebSocket broadcast hub, hot-reloadable config store, feature middlewares (rate limit, token, circuit breaker, shutdown), system-health loop. Reading for new contributors.
keywords:
  - nexus registry internals
  - axum sqlx
  - WebSocket broadcast hub
  - micro frontend registry internals
  - Rust web server internals
---

# Registry internals — architecture

Tenant-facing docs live under [infrastructure/registry](../../infrastructure/infra-registry.md). This page is for the person about to change the registry's code.

Code: `nexus-registry/`. Stack: Rust 2021, [axum 0.8](https://docs.rs/axum/0.8), [sqlx 0.9](https://docs.rs/sqlx/0.9) (SQLite, tokio runtime), [tokio](https://tokio.rs) with `broadcast` channels, [tower-http](https://docs.rs/tower-http) (CORS, trace), [governor](https://docs.rs/governor) for rate limiting, [reqwest](https://docs.rs/reqwest) for outbound health probes, [prometheus](https://docs.rs/prometheus), [tracing](https://docs.rs/tracing).

## Process model

One `#[tokio::main]` runtime. Several long-lived tasks spawned from `main`:

| Task | Owned by | Lifecycle |
|---|---|---|
| `axum::serve(...)` | `main` | Forever (until `ShutdownController::wait_for_drain` resolves) |
| Signal listener | `spawn_signal_listener` | Forever — listens for SIGINT/SIGTERM, calls `shutdown.trigger()` |
| Shutdown orchestrator | `ShutdownController::spawn_orchestrator` | Wakes when `trigger()` fires; broadcasts `registry_shutting_down`, drains, then resolves `wait_for_drain` |
| Token expiry loop | `features::token::start_expiry_loop` | Forever — every minute, expires the `previous_token` past its grace and broadcasts `token_rotated { previous_token_expired: true }` |
| System health loop | `system_health::start_loop` | Forever — periodic probe of remotes + system services; writes `health_cache`, broadcasts `system_health` |
| Per-connection WS task | `ws::hub::handle_connection` | One per upgrade; tied to the client socket |

No worker pool. The tokio executor multiplexes everything.

## AppState

```text
AppState  ─── cloned into every handler ──────────────────────────────
 ├─ db:             sqlx::SqlitePool                    (cheap to clone)
 ├─ env:            Arc<EnvConfig>                      (read-only after main)
 ├─ config_store:   Arc<ConfigStore>                    (hot-reloadable platform features)
 ├─ circuit_breaker: Arc<CircuitBreakerRegistry>        (per-remote state)
 ├─ rate_limit:     Arc<RateLimitState>                 (governor::Quota + IP/token buckets)
 ├─ shutdown:       Arc<ShutdownController>             (signals + drain waiter)
 ├─ metrics:        Arc<Metrics>                        (in-process counters surfaced as JSON)
 ├─ log_buffer:     Arc<LogBuffer>                      (ring buffer + broadcast::Sender<LogEntry>)
 ├─ broadcast_tx:   broadcast::Sender<ServerMessage>    (the WS fanout, capacity 256)
 ├─ health_cache:   Arc<RwLock<Option<SystemHealthSnapshot>>>   (parking_lot::RwLock)
 └─ started_at:     Arc<Instant>                        (for /api/system/* uptime)
```

Rules for adding fields:

- All new pieces of mutable state get `Arc<...>` (or a `broadcast::Sender`) so `AppState: Clone` stays trivial.
- Hot-reloadable config goes in `ConfigStore`, not here. Add a getter on `ConfigStore` instead of growing this struct.
- Anything in `AppState` is reachable from every handler — if it's per-request, pass it as an extractor instead.

## Router shape

```text
Router
 ├─ GET  /health                                              (public)
 ├─ GET  /api/ws                                              (token-required, query token allowed for browsers)
 └─ /api  ── token middleware ──
     ├─ /remotes/*    (api::remotes::router)
     ├─ /hosts/*      (api::hosts::router)
     ├─ /gates/*      (api::gates::router)
     ├─ /system/*     (api::system::router)
     └─ /config/*     (config::routes::router)
```

Layer order from outermost to handler (read bottom-up — outer wraps inner):

1. `CorsLayer` (from `build_cors(&env)`).
2. `correlation::middleware` — generates / propagates `X-Request-Id` into a `CorrelationId` extension.
3. `TraceLayer` with the `CorrelationSpan` `MakeSpan` impl so every log line carries `cid=...`.
4. `features::metrics::scrape_middleware` — gates `GET /metrics` based on the hot-reloadable metrics config (auth required, allowed paths).
5. `observability::metrics::middleware` — request counters + latency histograms.
6. `features::rate_limit::middleware` — governor-backed per-IP/per-token quota.
7. `DefaultBodyLimit::max(1 MiB)`.
8. The `/api/*` nest wraps a further `features::token::middleware` so only `/health` and `/api/ws` skip token auth.

Adding a new feature middleware? Decide where it sits in this stack — anything below `correlation::middleware` does not see `CorrelationId`; anything above `features::rate_limit::middleware` is not rate-limited.

## Storage

SQLite via sqlx. Database URL defaults to `sqlite:./data/registry.db`; the data directory is created on boot.

- `store::sqlite` — remote CRUD (`Db`, `init`, `list`, `list_for_host`, `get`, `insert`, `update`, `delete`, `toggle`, `StoreError`).
- `store::entities` — host + gate CRUD. Returns `DeleteHostOutcome` so the handler can distinguish "gone" from "blocked because gates reference it".
- All callsites go through the `store::*` re-exports — handlers should not import from the submodules directly.

The schema is migrated on first boot inside `store::init`. There is no separate `sqlx migrate` step.

## WebSocket hub

Single source of truth for fan-out: `state.broadcast_tx: broadcast::Sender<ServerMessage>`. Capacity 256. Every handler that needs to push to clients calls one of the `broadcast_*` helpers in `ws::hub`:

| Helper | Sends | Triggered by |
|---|---|---|
| `broadcast_remotes_changed` | `RemotesChanged { remotes: store::list(&db) }` | Any remote CRUD |
| `broadcast_host_changed` | `HostChanged { host }` | Any host CRUD |
| `broadcast_gate_changed` | `GateChanged { gate, old_host_id, new_host_id }` | Any gate CRUD, including host reassignment |
| `broadcast_config_changed` | `ConfigChanged { section, value }` | Any `PUT /api/config/...` |
| `broadcast_reconnect_policy` | `ReconnectPolicyChanged { policy }` | `PUT /api/config/ws-reconnect` |
| `broadcast_system_health` | `SystemHealth { snapshot }` | `system_health::start_loop` |

Helpers short-circuit when `receiver_count() == 0`. They never block; a slow client cannot starve the registry. If a receiver lags past the buffer, it gets `RecvError::Lagged` and skips frames; `handle_connection` logs `debug!` and keeps the socket alive.

Per-connection task (`handle_connection`):

```text
on_upgrade
  → assign conn_id (atomic)
  → increment CONN_COUNT (atomic) and prom::set_ws_clients
  → send Welcome { clients, reconnect_policy }
  → loop {
       tokio::select! {
         msg from client  → match ClientMessage { Ping, Subscribe, Unsubscribe, SubscribeGate }
         msg from broadcast_tx  → forward to socket as ServerMessage
         msg from log_buffer.subscribe()  → forward iff client called Subscribe { subscribe: "logs" }
       }
     }
  → on close: drop GATE_SUBSCRIPTIONS entry, decrement counters
```

`subscribe_gate` is recorded in a static `RwLock<HashMap<conn_id, gate_name>>` but **not yet used for per-gate filtering** — all subscribers receive every broadcast. The field is plumbed so the filter can be added without protocol churn.

`token::verify_token` is called once at upgrade time — either against `X-Nexus-Token` or the `?token=` query parameter (browsers cannot set custom headers on the WS upgrade). Failure returns 401 before `on_upgrade`.

## Config store

`config::store::ConfigStore` is the hub for everything hot-reloadable. It hydrates from the `config` table on boot and keeps a `parking_lot::RwLock`-backed snapshot per section:

| Section | Type | Getter | Broadcast |
|---|---|---|---|
| Gateway protection (mirrors the gateway-side `ProtectionConfig`) | `GatewayProtectionConfig` | `gateway_protection()` | `config_changed { section: "gateway_protection" }` |
| Per-key rate limit (this registry's own ingress) | `RateLimitConfig` | `rate_limiting()` | `config_changed { section: "rate_limiting" }` |
| WS reconnect policy | `WsReconnectConfig` | `ws_reconnect()` | `welcome` frame + `reconnect_policy_changed` |
| Circuit breaker | `CircuitBreakerConfig` | `circuit_breaker()` | `config_changed { section: "circuit_breaker" }` |
| Graceful shutdown | `GracefulShutdownConfig` | `graceful_shutdown()` | (read at shutdown time) |
| Metrics exporter | `MetricsConfig` | `metrics_config()` | `config_changed { section: "metrics" }` |
| Active token | `Option<StoredToken>` | `token()` | `token_rotated` |

Add a new hot-reloadable feature: add a section to `config::types`, default in `config::defaults`, a getter on `ConfigStore`, a handler under `config::routes`, and a broadcast call.

## Feature modules

`src/features/` is one module per cross-cutting concern. Keep them small; the handler-side surface is a middleware or a getter, not raw state.

| Module | Owns | Surface |
|---|---|---|
| `features::token` | Active + previous token hashes (HMAC-SHA256 with `NEXUS_TOKEN_PEPPER`). | `middleware` (axum `from_fn_with_state`), `verify_token`, `init_from_env`, `start_expiry_loop` |
| `features::rate_limit` | governor-backed quotas keyed by IP or token. | `middleware`, `RateLimitState` |
| `features::circuit` | Per-remote circuit breaker. State machine: closed → open → half-open. | `CircuitBreakerRegistry`, used by `system_health` |
| `features::shutdown` | Signal trigger + graceful drain orchestrator. | `ShutdownController::trigger`, `wait_for_drain`, `spawn_orchestrator` |
| `features::metrics` | Prometheus exporter middleware (auth, path, token check). | `scrape_middleware`, `set_ws_clients`, `record_ws_message`, `init` |

## Observability

- **Logs:** `tracing` + `tracing-subscriber::fmt` (ANSI off, target on) + a custom `RingBufferLayer` that pushes every event into `LogBuffer`. `LogBuffer` keeps the last `LOG_BUFFER_CAPACITY` (default depends on `EnvConfig`) and broadcasts every `LogEntry` to subscribers — that's how clients receive `Log` frames after `subscribe: "logs"`.
- **Correlation:** `correlation::middleware` extracts the `X-Request-Id` header (or generates a ULID), stores it as a `CorrelationId` extension, and adds it to the response. `CorrelationSpan::make_span` puts the ID on every log line for the request.
- **Metrics:** `observability::metrics::Metrics` is for in-process JSON (`GET /api/system/metrics`). The prometheus exporter is in `features::metrics` and goes out the configurable `prometheus_path` (default `/metrics`).
- **System health:** `system_health::start_loop` probes every remote + every `SYSTEM_SERVICES` entry, classifies as `healthy` / `degraded` / `down` / `unknown`, and caches the snapshot. The cache is also returned by `GET /api/system/health`. The same loop updates remote `last_seen_at` via `store::update`.

## Shutdown

Graceful sequence:

```text
SIGTERM → spawn_signal_listener → shutdown.trigger()

ShutdownController::spawn_orchestrator (already running):
  step 1: broadcast registry_shutting_down { resume_in_ms = ws_notice_ms }
  step 2: sleep ws_notice_ms (clients flush)
  step 3: stop accepting new HTTP   (axum.with_graceful_shutdown resolves)
  step 4: in-flight handlers complete or timeout_ms expires
  step 5: db.close()
  step 6: process exits
```

The `timeoutMs` and `wsNoticeMs` are read from `ConfigStore::graceful_shutdown()` at shutdown time, so the operator can tune them live without restarting.

## Token auth

Two paths:

1. `/api/*` HTTP — `features::token::middleware` reads `X-Nexus-Token`, hashes it with the pepper, compares constant-time against `ConfigStore::token()`. The grace window for the previous token is honored if `previous_token_expires_at > now`.
2. `/api/ws` upgrade — same `verify_token` but accepts the token via `?token=` query param too (browser WebSocket APIs cannot set headers). The token never appears in logs because the WS layer reads `Query<HashMap<String, String>>` raw and never traces it.

Token rotation flow:

- `POST /api/config/token/rotate { newToken, gracePeriodSeconds }` → stores the new token, demotes the current one to `previous` with `previous_token_expires_at = now + grace`.
- The expiry loop notices when the grace expires, clears the previous entry, and broadcasts `token_rotated { previous_token_expired: true }`. Clients should rotate their stored token before that fires.

## CORS

`build_cors(&env)`. If `ALLOWED_ORIGINS` is empty or contains `*`, the registry uses `AllowOrigin::any()`. Otherwise it parses the comma-separated list into `HeaderValue` and uses `AllowOrigin::list(parsed)`. Methods allowed: GET/POST/PUT/DELETE/OPTIONS. Allowed headers: `content-type`, `x-nexus-token`, `x-request-id`. Exposed: `x-request-id`.

## Invariants

1. All serializable types use `#[serde(rename_all = "camelCase")]`. The gateway and SDK packages depend on this. Don't add a snake_case field without rename — there is no test that catches this at compile time, only the e2e harness will.
2. `ServerMessage` (in `ws::messages`) is the contract with every WS client (gateway + portal + SDKs). Variants are `#[serde(tag = "type", rename_all = "snake_case")]`. Adding a variant is additive only — never repurpose a `type` tag.
3. `broadcast_*` helpers in `ws::hub` are the **only** way to push to clients. Don't call `state.broadcast_tx.send(...)` from a handler — go through the helper so the schema stays in one place.
4. SQL access goes through `store::*` re-exports. Don't `sqlx::query(...)` from a handler.
5. Hot-reloadable config goes through `ConfigStore`. Don't reach for the env var at request time — it was snapshotted into `Arc<EnvConfig>` at boot.
6. Token comparisons go through `features::token::verify_token`. Don't write a `==` byte comparison; the existing helper does constant-time + pepper.
7. The `/health` route is **public** by design (orchestrator probes). Adding sensitive fields to it must be reviewed.
8. WS subscribe_gate is recorded but not filtered on. If you wire filtering, the test harness needs a fan-out scope check — it currently asserts every broadcast reaches every client.

## Adjacent reading

- [Code map](./code-map.md) — file-by-file index.
- [Infrastructure: registry](../../infrastructure/infra-registry.md) — tenant-facing overview.
- [Reference: WebSocket messages](../../reference/websocket-messages.md) — every server/client frame shape.
- [Internals: gateway](../nexus-gateway/architecture.md) — the primary consumer.
