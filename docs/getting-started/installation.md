---
id: installation
title: Installation
sidebar_position: 3
description: Install and run the Nexus Angular micro frontend platform. Prerequisites, environment variables, docker compose up, smoke test, and adding your first remote — running in under 5 minutes.
keywords: [Angular micro frontend install, Nexus installation, docker compose Angular, micro frontend setup guide]
---

# Installation

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 22 | All packages and services |
| npm | ≥ 10 | Workspace tooling |
| Docker | ≥ 24 (with BuildKit) | Compose orchestration + `--mount=type=secret` |
| docker compose | v2 | The `compose` plugin syntax |
| GitHub PAT | scope `read:packages` | To pull `@bimo-dk/nexus-*` from GitHub Packages |

Verify your toolchain:

```bash
node --version          # v22.x.x
docker --version        # 24+
docker compose version  # v2.x
```

## 1. Clone the orchestrator

```bash
git clone https://github.com/Bimo-dk/nexus.git
cd nexus
```

This repo only contains the `docker-compose.yml` and developer scripts; the implementation lives in the sibling `nexus-*` repos. Clone them next to each other so the compose `build.context: ../nexus-<svc>` paths resolve:

```
parent-folder/
├── nexus/                  # you are here
├── nexus-gateway/
├── nexus-host-template/
├── nexus-portal/
├── nexus-registry/
├── nexus-remote-templat/
├── nexus-example/          # optional — runnable demo
└── nexus-packages/         # optional — package source
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```ini
# Strong shared secret — every service must agree on this
NEXUS_TOKEN=replace-with-a-long-random-string

# CORS allowlist for the registry (browser origins only)
ALLOWED_ORIGINS=http://localhost:8668,http://localhost:8669

# GitHub Packages auth — needed for any Docker image that installs @bimo-dk/*
NODE_AUTH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

:::important
Use `NODE_AUTH_TOKEN`, not `GITHUB_TOKEN`. The `.npmrc` in each service expects exactly that variable name when authenticating against `npm.pkg.github.com`.
:::

:::warning Never put the token in an `ARG`
The Dockerfiles use BuildKit `--mount=type=secret` for `NODE_AUTH_TOKEN`. Tokens passed via `--build-arg` are persisted in image layer metadata and visible to anyone who inspects the image. Compose injects it as a secret automatically — do not change the Dockerfile to use ARG.
:::

## 3. Start the stack

```bash
docker compose up --build
```

Services start in dependency order:

```
registry → host, remotes → gateway, portal
```

When everything is healthy:

- **Application** — http://localhost:8668
- **Admin portal** — http://localhost:8669
- **Registry health** — http://localhost:3000/health (only reachable in `docker-compose.dev.yml`)

## 4. Smoke-test

```bash
# Public health (no token)
curl http://localhost:8668/health
# {"status":"ok","service":"app"}

# Registry health (no token)
curl http://localhost:8668/api/../health  # goes through gateway -> registry

# Registry remotes (token required)
curl -H "X-Nexus-Token: $NEXUS_TOKEN" http://localhost:8668/api/remotes
# {"remotes":[],"total":0,"enabled":0}
```

If the last request returns `401`, the token in `.env` does not match what the registry container loaded — re-check `NEXUS_TOKEN` and `docker compose up --build` to rebuild.

## 5. Add your first remote

### Automatic (recommended)

Deploy a remote container with these environment variables set:

```yaml
environment:
  REGISTRY_INTERNAL_URL: http://registry:3000
  NEXUS_TOKEN: ${NEXUS_TOKEN}
  PUBLIC_URL: /remotes/checkout/remoteEntry.json
  UPSTREAM_URL: http://checkout:80
```

When the container starts, `provideNexusRemote()` POSTs the remote to the registry. The registry broadcasts `remotes_changed`. The host adds the route. Gateway adds the proxy. The remote is live at `http://localhost:8668/checkout` within seconds — with no config changes anywhere else.

### Manual (via portal)

Open http://localhost:8669 → **Remotes → Add remote**, and fill in `name`, `url`, `upstreamUrl`, `exposedModule` and `routePath`. The host receives a WebSocket broadcast and registers the route within seconds.

## Common environment variables

| Variable | Where it is read | Default |
|---|---|---|
| `NEXUS_TOKEN` | registry, host, portal, gateway (build) | `change-this-to-a-strong-secret-in-production` |
| `ALLOWED_ORIGINS` | registry CORS | `*` |
| `NODE_AUTH_TOKEN` | host, portal, registry build (BuildKit secret) | — |
| `HOST_REMOTE_ENTRY` | gateway runtime | `/host/remoteEntry.json` |
| `HOST_EXPOSED_MODULE` | gateway runtime | `./AppShell` |
| `PORT` | registry | `3000` |
| `HEALTH_CHECK_INTERVAL_MS` | registry | `30000` |
| `LOG_BUFFER_CAPACITY` | registry | `500` |

A complete table is in [reference/environment](../reference/environment.md).

## Next

- [Architecture](architecture.md) — how the pieces talk.
- [Developer workflows](../workflows/dev-mode.md) — hot reload one remote against staging.
- [Portal walkthrough](../services/portal.md) — what the admin app exposes.
