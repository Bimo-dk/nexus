---
id: environment
title: Environment variables
sidebar_position: 1
description: Every environment variable consumed by the Nexus registry, gateway, portal, hosts, and remotes. Defaults, validation rules, and where each is read.
keywords:
  - Nexus environment variables
  - configuration reference
  - micro frontend platform config
---

# Environment variables

The complete table of environment variables every Nexus service honors. Anything not listed here is silently ignored. Runtime feature config (rate limits, breakers, protection) lives in the registry and is set through the portal — see [reference: configuration](configuration.md).

## Registry (`nexus-registry`)

| Variable | Default | Validation | Purpose |
|---|---|---|---|
| `NEXUS_TOKEN` | empty | non-empty in prod | Initial active token. |
| `NEXUS_TOKEN_PEPPER` | default warning | non-default in prod | HMAC pepper for token hashing. |
| `ALLOWED_ORIGINS` | `*` | comma-separated origins or `*` | CORS allowlist. |
| `DATABASE_URL` | `sqlite:./data/registry.db` | sqlx URL | Storage backend. |
| `DATA_DIR` | `./data` | absolute path | SQLite directory. |
| `PORT` | `8670` | 1–65535 | Listen port. |
| `BIND_ADDRESS` | `0.0.0.0` | IPv4 / IPv6 literal | Listen interface. |
| `NODE_ENV` | `development` | string | Reported in `/api/system/config`. |
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | 1 000–600 000 | Background remote health probe. |
| `LOG_BUFFER_CAPACITY` | `500` | 10–10 000 | Ring buffer entry count. |
| `RUST_LOG` | `info` | tracing filter | Per-module log levels. |

## Gateway (`nexus-gateway`)

| Variable | Default | Validation | Purpose |
|---|---|---|---|
| `NEXUS_TOKEN` | empty | non-empty | Authenticates to the registry. |
| `REGISTRY_URL` | `http://registry:8670` | URL | Base URL of the registry. |
| `NEXUS_GATE_NAME` | first gate found | string | Which gate this instance serves. |
| `PORT` | `8668` | 1–65535 | Listen port. |
| `LOG_JSON` | `false` | `1` / `true` / `0` / `false` | Switch logs to JSON. |
| `RUST_LOG` | `info` | tracing filter | Log levels. |

## Portal (`nexus-portal`)

Read at container startup by `docker-entrypoint.sh` and substituted into `assets/config.json`.

| Variable | Default | Purpose |
|---|---|---|
| `REGISTRY_URL` | `/api` | Base URL the portal calls. |
| `WS_URL` | `/ws` | WebSocket path. |
| `NEXUS_TOKEN` | empty | Pre-populated token (optional). User can override in UI. |

## Host (Angular and Vue templates)

Read at bootstrap by `provideNexusHost()` (Angular) or `createNexusPlugin()` (Vue).

| Variable | Default | Purpose |
|---|---|---|
| `REGISTRY_INTERNAL_URL` | `http://registry:8670` | How the host reaches the registry. |
| `NEXUS_TOKEN` | empty | Token used for registry calls. |
| `STATIC_BACKUP_URL` | `/assets/registry-backup.json` | Fallback if the registry is down. |
| `WS_URL` | `/ws` | WebSocket path. |
| `HOST_NAME` | template name | Reported on self-registration. |
| `HOST_FRAMEWORK` | template default | `angular` / `vue` / `react`. |
| `HOST_PUBLIC_URL` | container URL | URL the gateway proxies to. |
| `HOST_REMOTE_ENTRY` | `/remoteEntry.json` | Path to the host's federation manifest. |
| `HOST_EXPOSED_MODULE` | `./AppShell` | Module the federation manifest exposes. |

## Remote (Angular, Vue, React templates)

Read by `provideNexusRemote()` (Angular) or `registerNexusRemote()` (Vue / React).

| Variable | Default | Purpose |
|---|---|---|
| `REGISTRY_INTERNAL_URL` | `http://registry:8670` | Where to self-register. |
| `NEXUS_TOKEN` | empty | Token used for the registration POST. |
| `PUBLIC_URL` | required | URL the remote will be served from (e.g. `/remotes/checkout/remoteEntry.json`). |
| `UPSTREAM_URL` | required | The container's internal URL (e.g. `http://checkout:80`). |
| `REMOTE_VISIBILITY` | `global` | `global` or `host:<host_id>`. |

## CLI (`bnx`)

| Variable | Default | Purpose |
|---|---|---|
| `NEXUS_TOKEN` | empty | Token used by every command that talks to the registry. |
| `REGISTRY_URL` | `http://localhost:8668` | Default registry URL. Read from `.env` in cwd. |
| `REMOTE_URL` | derived | URL to publish (for `bnx publish`). |
| `REMOTE_ROUTE` | derived | Route path override (for `bnx publish`). |
| `NEXUS_GATE_NAME` | none | Used by `bnx dev --gate`. |
| `NO_COLOR` | unset | Disable ANSI color in output. |

## Build (`@bimo-dk/nexus-build`)

Read by `nexus-build` at build time.

| Variable | Default | Purpose |
|---|---|---|
| `NEXUS_PROJECT_ROOT` | cwd | Override the project root for scanning. |
| `NEXUS_SRC` | `src` | Source dir relative to project root. |

## Docker build

| Variable | Purpose |
|---|---|
| `NODE_AUTH_TOKEN` | Read from a BuildKit secret named `npmrc`; never via `ARG`. PAT for GitHub Packages. |
| `DOCKER_BUILDKIT` | Must be `1`. Compose enables it automatically with `# syntax=docker/dockerfile:1.6`. |

## Where it all comes from

- Compose: `.env` in the `nexus` orchestrator repo, plus `environment:` blocks per service.
- Kubernetes: `Secret` for tokens, `ConfigMap` for everything else, `envFrom:` in the pod spec.
- Dev (`bnx dev`): `.env` in your workspace.

## Next

- [Reference: configuration](configuration.md) — runtime-configurable feature settings.
- [Reference: security](security.md) — token rotation, CORS, and the BuildKit secret pattern.
- [Reference: api-reference](api-reference.md) — endpoints these env vars enable.
