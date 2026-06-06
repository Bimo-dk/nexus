---
id: installation
title: Installation
sidebar_position: 3
description: Install and run the Nexus micro frontend platform. Prerequisites, environment variables, docker compose up, smoke test, and adding your first remote.
keywords:
  - micro frontend install
  - Nexus installation
  - docker compose micro frontend
  - micro frontend setup
  - Angular Vue React micro frontend setup
---

# Installation

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Docker | ≥ 24 with BuildKit | Compose orchestration + `--mount=type=secret` |
| docker compose | v2 | The `compose` plugin syntax |
| Node.js | ≥ 22 | Only for the CLI and the packages workspace |
| npm | ≥ 10 | Workspace tooling |
Verify your toolchain:

```bash
docker --version           # 24+
docker compose version     # v2.x
node --version             # v22+
```

## 1. Clone the orchestrator

```bash
git clone https://github.com/Bimo-dk/nexus.git
cd nexus
```

This repo contains the `docker-compose.yml`, the docs site, and developer scripts. The service implementations live in sibling repos. Clone them next to each other so the compose `build.context: ../nexus-<svc>` paths resolve:

```
parent-folder/
├── nexus/                       # you are here
├── nexus-gateway/
├── nexus-registry/
├── nexus-portal/
├── nexus-host-template/         # Angular host scaffold
├── nexus-host-template-vue/     # Vue host scaffold
├── nexus-remote-templat/        # Angular remote scaffold
├── nexus-remote-templat-vue/    # Vue remote scaffold
├── nexus-remote-templat-react/  # React remote scaffold
├── nexus-base-image/
├── nexus-packages/              # optional — package source
└── nexus-example/               # optional — runnable demo
```

If you only want to run the platform (not develop on it), the gateway, registry, portal, and base-image repos are enough — the rest are templates.

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```ini
# Long random string. Every service must agree on this token.
NEXUS_TOKEN=replace-with-a-long-random-string

# Browser origins the registry CORS layer trusts. Comma-separated.
ALLOWED_ORIGINS=http://localhost:8668,http://localhost:8669

# Portal session cookie signing secret. Random ≥32 bytes.
PORTAL_SESSION_SECRET=$(openssl rand -hex 32)

# Portal first-run admin password. Required ONLY before the SQLite users
# table has any rows. Unset after the first admin login + password change.
PORTAL_INITIAL_PASSWORD=changeme-on-first-login
```

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

## 4. Smoke-test

```bash
# Public health (no token).
curl http://localhost:8668/health
# { "status": "ok", "service": "nexus-gateway" }

# Registry health through the gateway (no token).
curl http://localhost:8668/api/health

# Registry remotes (token required).
curl -H "X-Nexus-Token: $NEXUS_TOKEN" http://localhost:8668/api/remotes
# { "remotes": [], "total": 0, "enabled": 0 }
```

If the last request returns `401`, the token in `.env` does not match what the registry container loaded. Re-check `NEXUS_TOKEN` and rebuild.

## 5. Add your first remote

Two options:

### Automatic (recommended)

Deploy a remote container with these environment variables set:

```yaml
environment:
  REGISTRY_INTERNAL_URL: http://registry:8670
  NEXUS_TOKEN: ${NEXUS_TOKEN}
  PUBLIC_URL: /remotes/checkout/remoteEntry.json
  UPSTREAM_URL: http://checkout:80
```

When the container starts, the framework adapter POSTs the remote to the registry. The registry broadcasts `remotes_changed`. The host adds the route. The gateway adds the proxy. The remote is live at `http://localhost:8668/checkout` within seconds — with no config changes anywhere else.

### Manual (via portal)

Open http://localhost:8669 — you will land on the portal's **login page**. Sign in as `admin` with the value you set in `PORTAL_INITIAL_PASSWORD`. The portal forces you to change the password before continuing; once changed, you can unset `PORTAL_INITIAL_PASSWORD` from `.env` (it is only read when the users table is empty).

Navigate to **Remotes → Add remote**, and fill in `name`, `url`, `upstreamUrl`, `exposedModule`, and `routePath`. The host receives a WebSocket broadcast and registers the route within seconds.

To create a read-only `developer` user, go to **Users → Add user**.

## Install the CLI

```bash
# npm
npm install -g @bimo-dk/nexus-cli

# pnpm
pnpm add -g @bimo-dk/nexus-cli

# yarn
yarn global add @bimo-dk/nexus-cli
```

```bash
bnx --version
bnx status   # shows hosts, gates, remotes
```

The CLI authenticates against the registry via `NEXUS_TOKEN` and `REGISTRY_URL` (read from `.env` in the current directory).

## Common environment variables

| Variable | Read by | Default |
|---|---|---|
| `NEXUS_TOKEN` | registry, host, portal BFF, remotes | none — required |
| `ALLOWED_ORIGINS` | registry CORS | `*` |
| `PORTAL_SESSION_SECRET` | portal BFF | none — required |
| `PORTAL_INITIAL_PASSWORD` | portal BFF | none — required on first boot only |
| `PORT` | registry | `8670` |
| `BIND_ADDRESS` | registry | `0.0.0.0` |
| `DATABASE_URL` | registry | `sqlite:./data/registry.db` |
| `HEALTH_CHECK_INTERVAL_MS` | registry | `30000` |
| `LOG_BUFFER_CAPACITY` | registry | `500` |
| `NEXUS_TOKEN_PEPPER` | registry | none — set in production |
| `REGISTRY_URL` | gateway, CLI | `http://registry:8670` |
| `LOG_JSON` | gateway | `false` |

A complete table is in [reference/environment](../reference/environment.md).

## Next

- [Quick start: Angular remote](quick-start-angular.md)
- [Quick start: Vue remote](quick-start-vue.md)
- [Quick start: React remote](quick-start-react.md)
- [Architecture deep dive](architecture.md)
