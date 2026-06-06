---
id: code-map
title: Registry internals — code map
sidebar_position: 2
description: File-by-file index of the nexus-registry Rust crate. Each module's role, key types, and what tends to break when it's edited.
keywords:
  - nexus registry code map
  - Rust module layout
  - axum project structure
  - sqlx project structure
---

# Registry internals — code map

Companion to [architecture](./architecture.md). Use this to find the right file before you change anything.

Source: [Bimo-dk/nexus-registry](https://github.com/Bimo-dk/nexus-registry). The crate is a single binary, `nexus-registry`. Entry point is `src/main.rs`. Everything below is relative to `nexus-registry/`.

## Top level

| Path | What it is |
|---|---|
| `Cargo.toml` | Single-binary crate, version `1.0.0`. Axum 0.8, sqlx 0.9 with `any` + `sqlite` + `postgres` + `mysql` + `tls-rustls` features, tokio, tower-http, reqwest (outbound probes), governor, prometheus, hmac/sha2, tracing. |
| `Dockerfile` | Release build. Strips symbols, thin LTO, codegen-units=1. |
| `Dockerfile.local` | Build profile used by `nexus-test`'s docker compose stack. No registry-token mounts; cheaper iteration. |
| `rustfmt.toml` | Style. Match the repo when adding code. |

## Source modules

### Entry and shared state

| File | Role | Key types / functions |
|---|---|---|
| `src/main.rs` | Composes the router, builds CORS, spawns signal listener + shutdown orchestrator + token expiry loop + system health loop. Owns `public_health`, `not_found`, the `CorrelationSpan` `MakeSpan`. | `main`, `build_router`, `build_cors`, `spawn_signal_listener`, `init_tracing`, `public_health`, `CorrelationSpan` |
| `src/state.rs` | The `AppState` struct cloned into every handler. | `AppState` (db, env, config_store, circuit_breaker, rate_limit, shutdown, metrics, log_buffer, broadcast_tx, health_cache, started_at) |
| `src/types.rs` | Domain types shared across modules — `Host`, `Gate`, `GateWithHost`, `RemoteConfig`, `RemoteHealthStatus`, request/response DTOs. All `#[serde(rename_all = "camelCase")]`. |
| `src/validators.rs` | Compiled regexes + helpers for name/route/url/domain validation. Called from every `POST`/`PUT` handler. |
| `src/http_error.rs` | `HttpError` type with `into_response()` — the standard error shape: `{ error, message?, correlationId, fields? }`. |
| `src/correlation.rs` | Per-request `CorrelationId` extension + `middleware` that generates/propagates `X-Request-Id`. |
| `src/time.rs` | `iso_now()` ISO-8601 timestamp helper. Use this everywhere instead of `chrono::Utc::now().to_rfc3339()` — keeps formatting consistent. |
| `src/system_health.rs` | Periodic probe loop. Pings every remote + every `SYSTEM_SERVICES` entry, classifies, updates `last_seen_at`, writes `health_cache`, broadcasts `system_health`. | `start_loop`, `ServiceHealth`, `ServiceKind`, `Summary`, `SystemHealthSnapshot` |

### API handlers (`src/api/`)

Each module exposes a `router()` that is `nest`ed under the `/api/<name>` prefix.

| File | Owns | Notable |
|---|---|---|
| `src/api/mod.rs` | Re-exports the sub-routers. | |
| `src/api/remotes.rs` | `GET /remotes`, `POST /remotes`, `GET/PUT/DELETE /remotes/:name`, `POST /remotes/:name/toggle`, `POST /remotes/:name/redeploy`. Calls `validators` + `store::*` + `broadcast_remotes_changed`. | |
| `src/api/hosts.rs` | `GET /hosts`, CRUD, `POST /hosts/:id/toggle`, `GET /hosts/:id/remotes`. Returns `{ hostId, remotes, total }` on `/remotes`. | |
| `src/api/gates.rs` | CRUD + `GET /gates/by-domain/:domain` (used by gateway bootstrap) + `POST /gates/:id/toggle`. On `PUT` with a `hostId` change, sends `broadcast_gate_changed` with `old_host_id` / `new_host_id`. | |
| `src/api/system.rs` | `/system/health`, `/system/config`, `/system/logs`, `/system/metrics`, `POST /system/shutdown`. Reads `health_cache` (or runs a fresh probe on `?fresh=true`). | |

### Config (`src/config/`)

Hot-reloadable platform features.

| File | Owns |
|---|---|
| `src/config/mod.rs` | Re-exports + `EnvConfig`. |
| `src/config/env.rs` | `EnvConfig::from_env()` — every boot-time env var (`PORT`, `BIND_ADDRESS`, `DATABASE_URL`, `DB_DRIVER`/`HOST`/`PORT`/`USER`/`PASSWORD`/`NAME`/`SSL`, `DATA_DIR`, `ALLOWED_ORIGINS`, `NEXUS_TOKEN`, `NEXUS_TOKEN_PEPPER`, `LOG_BUFFER_CAPACITY`, `SYSTEM_SERVICES`, `HEALTH_CHECK_INTERVAL_MS`, ...). |
| `src/config/database.rs` | `DatabaseConfig::resolve` picks `DATABASE_URL` or assembles from `DB_*`. `Dialect` enum (`Sqlite`, `Postgres`, `MySql`). `Dialect::render` rewrites `?` to `$N` for Postgres. `Dialect::prep` wraps in `sqlx::AssertSqlSafe` for sqlx 0.9's `SqlSafeStr` bound. `mariadb://` URLs rewrite to `mysql://` internally. Has unit tests for every branch. |
| `src/config/types.rs` | Strongly-typed config sections — `GatewayProtectionConfig`, `RateLimitConfig`, `WsReconnectConfig`, `CircuitBreakerConfig`, `GracefulShutdownConfig`, `MetricsConfig`, `StoredToken`. |
| `src/config/defaults.rs` | Default values for each section. Used by `ConfigStore::hydrate` when no row exists. |
| `src/config/store.rs` | `ConfigStore` — `Arc`-shared `parking_lot::RwLock` snapshots per section. `hydrate(db)` reads from the `config` table; getter methods (`gateway_protection()`, `ws_reconnect()`, `token()`, etc.) return `Arc<Section>`. |
| `src/config/routes.rs` | Every `/api/config/*` handler. Validates with `serde` + section-specific range checks, persists via `ConfigStore::set_*`, then calls `broadcast_config_changed` (or `broadcast_reconnect_policy` / `broadcast_token_rotated`). |

### Features (`src/features/`)

Cross-cutting concerns. Each module is the boundary between application logic and infrastructure.

| File | Role |
|---|---|
| `src/features/mod.rs` | Re-exports. |
| `src/features/token.rs` | Token middleware (`middleware`) + `verify_token` (constant-time, pepper-hashed) + `init_from_env` + `start_expiry_loop`. Reads from `ConfigStore::token()`. |
| `src/features/rate_limit.rs` | `RateLimitState` (governor `Quota` + per-IP/per-token buckets), `middleware`. Reads `ConfigStore::rate_limiting()` per request — config changes apply on the next request without restart. |
| `src/features/circuit.rs` | `CircuitBreakerRegistry`, per-remote `CircuitBreaker` state machine. Consumed by `system_health` (skips probes when breaker is open). |
| `src/features/shutdown.rs` | `ShutdownController` — `trigger()`, `wait_for_drain()`, `spawn_orchestrator(config_store, broadcast_tx)`. Owns the SIGTERM → broadcast → drain sequence. |
| `src/features/metrics.rs` | Prometheus registry (`init`), exporter `scrape_middleware` (auth, path, allowed-IPs), and the in-process counters used by WS (`set_ws_clients`, `record_ws_message`). |

### Storage (`src/store/`)

All sqlx access lives here. Handlers must not import sqlx directly. Despite the filename `sqlite.rs`, every dialect (SQLite, Postgres, MySQL / MariaDB) routes through these functions — the dispatch is via `Db.dialect` and the per-dialect `SCHEMA_*` constants.

| File | Owns |
|---|---|
| `src/store/mod.rs` | Re-exports the public surface. |
| `src/store/sqlite.rs` | `Db { pool: sqlx::AnyPool, dialect: Dialect }`, `init(cfg, data_dir)`, three `SCHEMA_*` constants, `sqlite_url_with_create_mode` for SQLite create-if-missing via URL, `list`, `list_for_host`, `get`, `insert`, `update`, `delete`, `toggle`, `is_unique_violation` (dispatches across SQLite code 2067, Postgres SQLSTATE 23505, MySQL code 1062), `StoreError`. |
| `src/store/entities.rs` | Host + gate CRUD using `sqlx::any::AnyRow` (`insert_host`, `list_hosts`, `get_host`, `host_exists`, `update_host`, `toggle_host`, `delete_host` → `DeleteHostOutcome`; equivalents for gate including `get_gate_by_domain`). |

### WebSocket (`src/ws/`)

| File | Owns |
|---|---|
| `src/ws/mod.rs` | Re-exports `upgrade` (handler) + every `broadcast_*` helper. |
| `src/ws/hub.rs` | `upgrade` (auth + handshake), `handle_connection` (the per-client select loop), `broadcast_remotes_changed`, `broadcast_host_changed`, `broadcast_gate_changed`, `broadcast_system_health`, `broadcast_config_changed`, `broadcast_reconnect_policy`, `connection_count`. Static `CONN_COUNT`/`CONN_ID_NEXT`/`GATE_SUBSCRIPTIONS`. |
| `src/ws/messages.rs` | The on-the-wire schema. `ServerMessage` (welcome / remotes_changed / host_changed / gate_changed / config_changed / reconnect_policy_changed / system_health / log / pong / registry_shutting_down / token_rotated) and `ClientMessage` (ping / subscribe / unsubscribe / subscribe_gate). All `#[serde(tag = "type", rename_all = "snake_case")]`. |

### Observability (`src/observability/`)

| File | Owns |
|---|---|
| `src/observability/mod.rs` | Re-exports. |
| `src/observability/log_buffer.rs` | `LogBuffer` (ring buffer + `broadcast::Sender<LogEntry>`), `RingBufferLayer` (tracing layer that pushes events into the buffer), `LogEntry`. |
| `src/observability/metrics.rs` | `Metrics` (in-process counters used by `/api/system/metrics`) + the request-counter `middleware`. |

### Data + tests

| Path | What it is |
|---|---|
| `src/data/registry.json` | Legacy seed file. Read by `store::init` when the DB is empty (only on a clean boot). |
| `src/tests.rs` | `cargo test` entry. Tests use `tower::ServiceExt::oneshot` against `build_router(...)`. |

## Where common changes land

| You want to change ... | Edit |
|---|---|
| Add a new HTTP endpoint | New handler in `src/api/<name>.rs`, register in that module's `router()`. If it mutates state, end with the matching `broadcast_*`. |
| Add a new hot-reloadable config section | `config/types.rs` (struct + serde), `config/defaults.rs`, `config/store.rs` (getter + setter), `config/routes.rs` (handler), `ws/messages.rs` only if a dedicated `*_changed` event makes sense; otherwise the generic `config_changed { section, value }` is enough. |
| Add a new WS server message | `ws/messages.rs` (new variant), `ws/hub.rs` (`broadcast_*` helper + `message_kind`), then add it on the consuming gateway/SDK side. |
| Add a new env var | `config/env.rs` (`EnvConfig::from_env`), document in `nexus/docs/reference/environment.md`. If it should be hot-reloadable, do not add it here — add a `ConfigStore` section instead. |
| Add a remote field | `types.rs` (struct + serde), `store/sqlite.rs` (add column to **all three** `SCHEMA_*` constants + update the INSERT/SELECT lists), `api/remotes.rs` (validation + handler), `validators.rs` (if it needs format checks). |
| Add support for another SQL dialect | New variant on `config::database::Dialect`, `match` arms in `render` / `prep` / `is_unique_violation` / the `upsert` helper, new `SCHEMA_*` constant + branch in `schema_for`, install the new sqlx driver feature in `Cargo.toml`. |
| Change auth | `features/token.rs` — never write a token comparison anywhere else. Update `verify_token` + the upgrade path in `ws/hub.rs` together. |
| Change CORS | `main.rs::build_cors`. Add headers to `allowed_headers` if a new client header is required. |
| Add a per-remote metric | `observability/metrics.rs` for in-process JSON, or `features/metrics.rs` for prometheus. |
