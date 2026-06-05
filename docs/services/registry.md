---
id: registry
title: nexus-registry
sidebar_position: 2
description: The nexus-registry repository — Rust + axum + sqlx service that owns hosts, gates, remotes, and platform configuration. Build, run, configure, deploy.
keywords:
  - micro frontend registry
  - nexus-registry
  - Rust web server
  - axum sqlx
---

# nexus-registry

The `nexus-registry` repository ships the Rust service that owns every piece of platform state. This page is the per-repo build / run / deploy reference. For the operational deep dive and full API, see [Infra: registry](../infrastructure/infra-registry.md).

## Repository layout

```
nexus-registry/
├── src/
│   ├── main.rs              # entry, axum wiring
│   ├── api/{remotes,hosts,gates,system}.rs   # HTTP routers
│   ├── config/              # hot-reloadable feature config
│   ├── features/            # rate limit, breaker, token rotation, shutdown
│   ├── store/sqlite.rs      # SQLite adapter
│   ├── ws/{hub,messages}.rs # WebSocket broadcast hub
│   ├── observability/       # metrics, log buffer
│   ├── validators.rs        # input validation
│   └── tests.rs
├── Cargo.toml
├── Cargo.lock
├── Dockerfile
├── Dockerfile.local
├── rustfmt.toml
└── LICENSE
```

## Build

```bash
cd nexus-registry
cargo build --release
./target/release/nexus-registry
```

Docker:

```bash
docker build -t ghcr.io/bimo-dk/nexus-registry:dev .
```

The image is multi-stage Rust → distroless, ~22 MB final size.

## Run

```bash
docker run --rm -p 8670:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e ALLOWED_ORIGINS=http://localhost:8668,http://localhost:8669 \
  -e DATABASE_URL=sqlite:/data/registry.db \
  -v registry-data:/data \
  ghcr.io/bimo-dk/nexus-registry:dev
```

| Env var | Default | Purpose |
|---|---|---|
| `NEXUS_TOKEN` | — | Initial token. Required in production. |
| `NEXUS_TOKEN_PEPPER` | warns if unset | HMAC pepper for token hashing. |
| `ALLOWED_ORIGINS` | `*` | CORS allowlist. Comma-separated. |
| `DATABASE_URL` | `sqlite:./data/registry.db` | Storage URL. |
| `DATA_DIR` | `./data` | SQLite directory. |
| `PORT` | `8670` | Listen port. |
| `BIND_ADDRESS` | `0.0.0.0` | Listen interface. |
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | Background remote health probe. |
| `LOG_BUFFER_CAPACITY` | `500` | Ring buffer entry count. |
| `RUST_LOG` | `info` | Tracing filter (axum/sqlx levels). |

## Health

```bash
curl http://localhost:8670/health
```

```json
{ "status": "ok", "service": "nexus-registry", "db": "ok", "wsClients": 4, "timestamp": "..." }
```

## Storage

SQLite by default. Mount a volume at `DATA_DIR` so writes persist across restarts. PostgreSQL is the planned HA backend — see [infra-high-availability](../infrastructure/infra-high-availability.md).

## Authentication

Every `/api/*` route requires `X-Nexus-Token`. The `/health` endpoint is public. Rotate the token via `POST /api/config/token/rotate` with a grace period; the registry honors the previous token for the configured window.

## Deploy

```yaml
registry:
  image: ghcr.io/bimo-dk/nexus-registry:1.0
  environment:
    NEXUS_TOKEN: ${NEXUS_TOKEN}
    NEXUS_TOKEN_PEPPER: ${NEXUS_TOKEN_PEPPER}
    ALLOWED_ORIGINS: https://shop.example.com,https://admin.example.com
    DATABASE_URL: sqlite:/data/registry.db
  volumes:
    - registry-data:/data
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:8670/health"]
    interval: 10s
```

## Tests

```bash
cd nexus-registry
cargo test
```

## Logs

The registry writes structured logs to stdout. Levels per module are controllable via `RUST_LOG`:

```bash
RUST_LOG=info,sqlx=warn,axum=info nexus-registry
```

A live ring-buffer of the last N entries (env: `LOG_BUFFER_CAPACITY`) is queryable via `GET /api/system/logs` and streamable over the WebSocket `log` channel — that is what the portal's Logs page displays.

## Next

- [Infra: registry](../infrastructure/infra-registry.md) — full API, WS messages, config features.
- [Reference: api-reference](../reference/api-reference.md) — every endpoint.
- [Reference: websocket-messages](../reference/websocket-messages.md) — every message type.
