---
id: gateway
title: nexus-gateway
sidebar_position: 1
description: The nexus-gateway repository — Rust + axum + hyper service that fronts every Nexus deployment. Build, run, configure, deploy.
keywords:
  - micro frontend gateway
  - nexus-gateway
  - Rust web server
  - reverse proxy
---

# nexus-gateway

The `nexus-gateway` repository ships the Rust service that fronts every Nexus deployment. This page is the per-repo build / run / deploy reference. For the operational deep dive, see [Infra: gateway](../infrastructure/infra-gateway.md).

## Repository layout

```
nexus-gateway/
├── src/
│   ├── main.rs              # entry + axum wiring
│   ├── startup.rs           # bootstrap from registry
│   ├── state.rs             # GatewayState, GatewayConfig, ProtectionConfig
│   ├── route_table.rs       # in-memory routing
│   ├── proxy.rs             # HTTP proxy handler
│   ├── ws_proxy.rs          # WebSocket bridge
│   ├── protection.rs        # 7-layer middleware
│   ├── metrics.rs           # Prometheus exporter
│   ├── spa.rs               # framework-aware vanilla JS shell
│   ├── registry_listener.rs # WS subscriber
│   └── tests/
├── Cargo.toml
├── Cargo.lock
├── Dockerfile               # multi-stage Rust build
├── Dockerfile.local         # dev variant
├── .dockerignore
└── LICENSE
```

## Build

### Native (development)

```bash
cd nexus-gateway
cargo build --release
./target/release/nexus-gateway
```

### Docker (production)

```bash
docker build -t ghcr.io/bimo-dk/nexus-gateway:dev .
```

The multi-stage Dockerfile compiles with `cargo build --release` against `rust:1.83`, then copies the binary into a `distroless/cc` image. Final image weight: ~25 MB.

## Run

```bash
docker run --rm -p 8668:8668 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e REGISTRY_URL=http://registry:8670 \
  --network nexus_default \
  ghcr.io/bimo-dk/nexus-gateway:dev
```

The gateway requires:

| Env var | Purpose |
|---|---|
| `NEXUS_TOKEN` | authenticates to the registry |
| `REGISTRY_URL` | base URL of the registry (defaults to `http://registry:8670`) |
| `NEXUS_GATE_NAME` | which gate this instance serves (defaults to the first gate the registry returns) |
| `PORT` | listen port (default 8668) |
| `LOG_JSON` | `1` / `true` for JSON logs |

## Health

```bash
curl http://localhost:8668/health
```

Response:

```json
{
  "status": "ok",
  "service": "nexus-gateway",
  "version": "0.1.0",
  "registry_connected": true,
  "gate": "storefront-prod",
  "host": "storefront",
  "framework": "angular",
  "route_count": 12
}
```

## Configuration

The gateway reads its operational configuration from the registry at `GET /api/config/gateway`. Local env vars only cover what the gateway needs *to reach* the registry. Everything else — CORS, headers, the seven protection layers — is editable in the portal and pushed live over WebSocket.

| Where | What |
|---|---|
| Env vars | bootstrap settings (token, registry URL, port) |
| Registry → gateway config | CORS, custom headers, protection layers, framework |

## Deploy

Use the prebuilt image:

```yaml
gateway:
  image: ghcr.io/bimo-dk/nexus-gateway:1.0
  environment:
    NEXUS_TOKEN: ${NEXUS_TOKEN}
    REGISTRY_URL: http://registry:8670
  ports:
    - "8668:8668"
  depends_on:
    - registry
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:8668/health"]
    interval: 10s
    timeout: 3s
    retries: 3
```

For HA: run two or more behind a load balancer. Each instance discovers its gate from the registry. See [infra-high-availability](../infrastructure/infra-high-availability.md).

## Logs

```bash
docker logs gateway -f
```

JSON mode:

```bash
docker run -e LOG_JSON=true ...
```

## Tests

```bash
cd nexus-gateway
cargo test
```

Test files: `src/tests/{headers,health,protection,route_table,spa,startup}_tests.rs`.

## Next

- [Infra: gateway](../infrastructure/infra-gateway.md) — what the code does at runtime.
- [Infra: protection](../infrastructure/infra-protection.md) — operate the seven layers.
- [Reference: environment](../reference/environment.md) — full env var list.
