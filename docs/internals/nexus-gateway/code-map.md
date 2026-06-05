---
id: code-map
title: Gateway internals — code map
sidebar_position: 2
description: File-by-file index of the nexus-gateway Rust crate. Each module's role, key types, and what tends to break when it's edited.
keywords:
  - nexus gateway code map
  - Rust module layout
  - axum project structure
---

# Gateway internals — code map

Companion to [architecture](./architecture.md). Open this when you're about to touch a file and want to know what it owns and what touches it.

Source: [Bimo-dk/nexus-gateway](https://github.com/Bimo-dk/nexus-gateway). The crate is a single binary, `nexus-gateway`. Entry point is `src/main.rs`. Everything below is relative to `nexus-gateway/`.

## Top level

| Path | What it is |
|---|---|
| `Cargo.toml` | Single-binary crate. Axum 0.7, hyper 1, tokio, tokio-tungstenite, dashmap, parking_lot, prometheus, ulid, tracing, anyhow, tower-http. |
| `Dockerfile` | Multi-stage build: cargo build → distroless. The runtime stage also installs `gettext` so `docker-entrypoint.d/` can envsubst the runtime config. |
| `docker-entrypoint.d/` | Shell snippets run on container start. Used to template env-driven values into `static/index.html` before axum boots. |
| `static/` | Two HTML templates baked into the binary at compile time via `include_str!`: `index.html` (host bound) and `not-ready.html` (no host yet). |
| `nginx.conf`, `angular.json`, `tsconfig*.json`, `package.json`, `src/main.ts`, `src/app/` | Leftovers from the pre-rewrite nginx+Angular gateway. Kept so the legacy Docker build path still works for tenants that haven't switched. Not referenced by `cargo build`. |

When in doubt, anything inside `src/*.rs` is what the Rust binary actually runs.

## Source modules

| File | Role | Key types / functions |
|---|---|---|
| `src/main.rs` | Composes the router, spawns the registry listener, defines all four `/api/protection/*` handlers and the fallback. | `AppState`, `main`, `health_handler`, `ws_handler`, `metrics_handler`, `fallback_handler`, `ban_ip`, `unban_ip`, `clear_bans`, `is_authed`, `constant_time_eq` |
| `src/state.rs` | All shared types. The serde shape contract with the registry lives here. | `HostFramework`, `ProtectionConfig`, `GatewayConfig`, `CustomHeader`, `GatewayState`, `SharedState`, `RegistryGate`, `RegistryHost`, `RegistryRemote`, `RegistryGatewayConfig` |
| `src/startup.rs` | Reads env, calls the registry until it has a gate + host + remotes, builds the initial `RouteTable`. Find-or-create logic for gate and host (auto-registration). | `Env`, `read_env`, `bootstrap`, `ensure_gate`, `fetch_with_retry`, `build_route_table`, `is_visible` |
| `src/route_table.rs` | Concurrent prefix→target table. Longest-prefix `resolve`. Helpers for bulk replacement. | `UpstreamTarget`, `RouteTable`, `RouteTable::upsert`, `resolve`, `clear_remotes`, `iter_all` |
| `src/registry_listener.rs` | The one background task that watches the registry WebSocket. Dispatches `WsMessage` variants. | `WsMessage`, `HostChangedPayload`, `GateChangedPayload`, `ReconnectPolicyPayload`, `run`, `handle_message` |
| `src/protection.rs` | Seven-layer protection middleware + the auto-ban funnel. RAII guard for WS counters. | `ProtectionState`, `SharedProtection`, `ConnectionCount`, `BanEntry`, `ViolationRecord`, `TokenBucket`, `WsGuard`, `middleware`, `check_ban`, `try_rate_limit`, `record_violation`, `try_acquire_ws`, `client_ip` |
| `src/proxy.rs` | HTTP forward path. Adds `X-Forwarded-For` / `X-Nexus-Gateway` / `X-Request-Id`, applies cache + security headers. | `ProxyClient`, `build_client`, `handler`, `error_response`, `not_found` |
| `src/spa.rs` | Framework-aware SPA fallback. Picks `index.html` vs `not-ready.html`, injects `window.__NEXUS_GATEWAY_CONFIG__` with XSS-safe JSON. | `handler` (uses `include_str!` constants) |
| `src/ws_proxy.rs` | Pipes a client WebSocket to the registry WebSocket and back. RAII-style: returns when either side closes. | `handler`, `pipe_socket`, `pipe`, `axum_to_tung`, `tung_to_axum` |
| `src/headers.rs` | Owns the security header allowlist and the cache-control policy. | `LOCKED`, `apply_security_headers`, `apply_custom_headers`, `cache_control_value`, `is_immutable_asset` |
| `src/health.rs` | Composes the `/health` JSON response. Read-only access to `AppState`. | `handler` |
| `src/http_client.rs` | Thin wrappers over hyper-util's legacy client for `GET`/`POST` JSON against the registry. Sets `X-Nexus-Token` + `Accept: application/json`. | `HyperClient`, `build`, `get_json`, `post_json`, `send` |
| `src/metrics.rs` | Prometheus counters, gauges, histograms. Cardinality controls. | `REQUESTS_BLOCKED`, `ACTIVE_CONNECTIONS`, `BANNED_IPS`, `VIOLATIONS`, `REQUEST_DURATION`, `init`, `gather_text`, `path_pattern`, `ip_class` |
| `src/bootstrap.ts`, `src/main.ts`, `src/environments/`, `src/styles.scss`, `src/app/`, `federation.config.js` | Legacy Angular SPA assets, only used by the pre-rewrite Docker stage. Not part of the Rust build. |

## Tests

`#[cfg(test)] mod tests { ... }` in `src/main.rs` declares the test files. Tests live under `src/tests/` and run with `cargo test`.

| File | Covers |
|---|---|
| `src/tests/headers_tests.rs` | Cache-control rules, locked security headers, custom header overlap |
| `src/tests/health_tests.rs` | `/health` JSON shape, `registry_connected` flag |
| `src/tests/protection_tests.rs` | All seven layers — rate limit, connection cap, header/body size, timeouts, auto-ban funnel |
| `src/tests/route_table_tests.rs` | Longest-prefix `resolve`, disabled targets, `clear_remotes` semantics |
| `src/tests/spa_tests.rs` | JSON injection escaping (`</script>` neutralisation) |
| `src/tests/startup_tests.rs` | Bootstrap path, retry, `is_visible`, auto-registration |

Test harness uses `wiremock` for the registry side.

## Where common changes land

| You want to change ... | Edit |
|---|---|
| Add a new env var the gateway reads | `startup::Env`, `read_env`, document in `nexus/docs/reference/environment.md` |
| Add a new protection layer | `protection.rs` middleware (place in order vs the other 7), `ProtectionConfig` (mirror the registry's `GatewayProtectionConfig`), `metrics.rs` (new `reason` label) |
| Change WS message dispatching | `registry_listener::WsMessage` + matching arm in `handle_message`; mirror the type in `nexus-registry/src/ws/messages.rs` |
| Add a new HTTP route | `main.rs` router builder. If it's auth-required, replicate the `is_authed` check at the top of the handler. |
| Adjust cache or security headers | `headers.rs`. If a security header should be allow-overridable, remove it from `LOCKED`. |
| Add a metric | `metrics.rs` — register a new `Lazy<...>`, force it in `init()`. |
| Touch the SPA shim | `static/index.html` or `static/not-ready.html`. The HTML is `include_str!`'d at compile time — `cargo build` after edits. |
