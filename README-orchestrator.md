# Nexus orchestrator — developer reference

This document covers the `nexus/` orchestrator repo specifically. For the full platform docs see [README.md](./README.md) and the [documentation site](./docs/).

---

## Developer workflow

### A. Create a new remote

```bash
# 1. Scaffold — prompts for name and route
bnx generate remote

# 2. Build — @NexusRemote decorator generates federation.config.json automatically
cd <your-new-remote> && npm install && npm run build

# 3. Register — reads federation.config.json, POSTs to /api/remotes
export NEXUS_TOKEN=<token>
export REGISTRY_URL=http://localhost:8668
export REMOTE_URL=/remotes/<name>/remoteEntry.json
bnx publish
```

`@NexusRemote({ exposeAs: 'MyPage' })` on the entry class is the only config touch-point — all federation wiring is generated from it.

### B. Work locally on one remote with hot reload

```bash
# From the nexus/ directory (nexus-example must be a sibling)
npm run dev:catalog    # catalog remote on :8701
npm run dev:cart       # cart remote on :8702
npm run dev:product    # product remote on :8703
npm run dev:checkout   # checkout remote on :8704
npm run dev:account    # account remote on :8705
```

Open http://localhost:9000 — you see the complete NexusShop app with your local remote running with HMR; everything else proxied to `nexus.dev.json#remote.url`.

---

## Architecture

```
                     Browser
                        |
                        v
          http://localhost:8668  (gateway — public entry)
                        |
           /host/*  →  host (layout shell)
           /remotes/<name>/*  →  remote-<name>:80
           /api/*  →  registry:3000/api/*
           /ws  →  registry:3000/ws

     registry (source of truth — WebSocket broadcast on change)
          ^
          | admin REST API + WS
          |
     http://localhost:8669  (portal — admin UI)
```

**Zero-downtime deploy flow:**

1. Build and start a new remote container.
2. Remote calls `POST /api/remotes` at startup — self-registers.
3. Registry broadcasts `remotes_changed`.
4. Host adds the route via WebSocket — no restart, no user disruption.
5. Gateway regenerates its nginx proxy rules — new URL is live immediately.

---

## Quick start

```bash
cp .env.example .env
# Set NEXUS_TOKEN (strong secret) and NODE_AUTH_TOKEN (GitHub PAT, read:packages)

echo "$NODE_AUTH_TOKEN" | docker login ghcr.io -u <your-github-user> --password-stdin
docker compose up --build

# Application:  http://localhost:8668
# Admin portal: http://localhost:8669
```

---

## Ports

| Service | Host port | Visible to browser? |
|---|---|---|
| `gateway` | **8668** | yes — public entry |
| `portal` | **8669** | yes — admin |
| `registry` | — | no (reached via `/api/*`) |
| `host` | — | no |
| `remote-*` | — | no |

Dev proxy port: **9000**

NexusShop example dev ports: catalog 8701, cart 8702, product 8703, checkout 8704, account 8705.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXUS_TOKEN` | `change-this-in-production` | `X-Nexus-Token` shared secret |
| `ALLOWED_ORIGINS` | `http://localhost:8668,http://localhost:8669` | Registry CORS |
| `NODE_AUTH_TOKEN` | — | GitHub PAT for `@bimo-dk/*` packages (BuildKit secret) |
| `REGISTRY_INTERNAL_URL` | — | Internal Docker URL for remote self-registration |
| `PUBLIC_URL` | — | Public URL a remote announces to the registry |
| `UPSTREAM_URL` | — | Internal Docker URL gateway proxies to |

Full table: [reference/environment](./docs/reference/environment.md).

---

## Add a remote via the portal

1. http://localhost:8669 → **Remotes → Add remote**
2. Fill in `name`, `url`, `upstreamUrl`, `exposedModule`, `routePath`
3. Save — registry persists, broadcasts `remotes_changed`, host adds the route, gateway reloads. Live within seconds.

---

## Zero-downtime update of an existing remote

```bash
docker compose up --build --no-deps remote-catalog
```

Only that container rebuilds. Host picks up the new version via WebSocket broadcast on next registration. Active users continue without interruption.

---

## Security

- `X-Nexus-Token` required on all registry endpoints except `GET /health`.
- `nexusAuthInterceptor` in `@bimo-dk/nexus-runtime` injects the token automatically.
- `NODE_AUTH_TOKEN` is passed via BuildKit `--mount=type=secret` — never in build args or image layers.
- Nginx sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` on every response.

---

## Health checks

```bash
# Public (no token)
curl http://localhost:8668/health

# Registry (no token — through gateway)
curl http://localhost:8668/api/../health

# Remote (from inside Docker network)
docker compose exec gateway wget -qO- http://remote-catalog:80/health

# Remotes list (token required)
curl -H "X-Nexus-Token: $NEXUS_TOKEN" http://localhost:8668/api/remotes
```

---

## Verification checklist

- [ ] `docker compose up --build` starts all services without errors
- [ ] http://localhost:8668 shows NexusShop with navbar and product list
- [ ] http://localhost:8669 shows the admin portal with all remotes listed
- [ ] `GET /health` returns 200 without a token
- [ ] `GET /api/remotes` returns 401 without a token
- [ ] `GET /api/remotes` with the correct token returns the remote list
- [ ] Disable a remote in the portal → host removes the route within seconds (no restart)
- [ ] Re-enable → route comes back immediately
- [ ] `docker compose up --build --no-deps remote-catalog` only updates that container
- [ ] Registry data survives `docker compose down && docker compose up` (volume persistence)
