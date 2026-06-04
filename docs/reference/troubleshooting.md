---
id: troubleshooting
title: Troubleshooting
sidebar_position: 4
description: Nexus troubleshooting guide — remote not appearing, 401 on registry calls, WebSocket not connecting, federation load failures, stale remoteEntry.json, and Docker volume issues. Symptoms, causes and fixes.
keywords: [Nexus troubleshooting, Angular federation errors, micro frontend debug, remote not loading Angular]
---

# Troubleshooting

The 80/20 of "why isn't it working." Each entry has the symptom, the likely cause, and a check command.

## Browser shows blank screen / "Host shell unavailable"

The gateway loaded but the host module did not.

```bash
docker compose ps host
docker compose logs host
curl -sI http://localhost:8668/host/remoteEntry.json
```

Causes:

- `host` container is unhealthy. Restart it: `docker compose up -d --no-deps host`.
- Gateway's `nginx.conf` does not have a `location ^~ /host/` block. Check `nexus-gateway/nginx.conf`.
- `host` is up but `dist/host/browser/remoteEntry.json` is missing — broken build. Rebuild with `docker compose up -d --build host`.

## `GET /api/remotes` returns 401

Token mismatch.

```bash
curl -i -H "X-Nexus-Token: $NEXUS_TOKEN" http://localhost:8668/api/remotes
docker compose exec registry env | grep NEXUS_TOKEN
```

The token on your client and the registry's `NEXUS_TOKEN` env-var must match. If you bake a token into the host bundle (ARG `NEXUS_TOKEN`) and a different one in `/assets/config.json`, the runtime value wins — make sure your `docker-entrypoint.d/40-runtime-config.sh` is running.

## Host shows "Registry offline — showing cached data"

The host could not reach `/api/remotes` *and* `/ws`. It is showing data from `sessionStorage` cache or the static backup file.

```bash
docker compose ps registry
docker compose logs registry | tail -20
curl http://localhost:8668/api/.../health    # gateway → registry
```

Causes:

- Registry container is down or unhealthy. Restart: `docker compose up -d --no-deps registry`.
- Gateway's `nginx.conf` `/api/` block is wrong.
- Token mismatch — the *registry* logs will show `401`s.

The host's WebSocket reconnects automatically with backoff. Once registry is back, the banner disappears within a minute.

## Adding a remote via portal: it shows up but the route 404s

The registry accepted the entry but the gateway has no proxy block for `/remotes/<name>/*`.

```bash
curl -sI http://localhost:8668/remotes/checkout/remoteEntry.json
# 404 → gateway is missing the route
```

Fix: extend `nexus-gateway/nginx.conf` with a `location ^~ /remotes/checkout/` block, rebuild gateway, redeploy. See [gateway docs](../services/gateway.md#adding-a-route-for-a-new-remote).

## Federation entry returns 200 but host shows "failed remote"

The entry's `exposes` block does not contain the key the host requested.

```bash
curl -s http://localhost:8668/remotes/checkout/remoteEntry.json | jq .
```

Check:

- `exposes` has the key your `exposedModule` field referenced (`./RemoteEntry` by default).
- The hashed chunk files in `exposes` exist (200 on fetch).

Run `nexus-build --dry-run` in the remote to see what config was generated.

## Docker build fails with `npm ERR! 401`

The container can't fetch `@bimo-dk/*` from GitHub Packages.

```bash
echo "$NODE_AUTH_TOKEN" | docker login ghcr.io -u <user> --password-stdin
DOCKER_BUILDKIT=1 docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN ...
```

Common mistakes:

- `NODE_AUTH_TOKEN` is unset or lacks `read:packages` scope.
- You passed the token as `--build-arg NODE_AUTH_TOKEN=...` — it doesn't reach the `RUN --mount=type=secret` block.
- `.npmrc` references `${GITHUB_TOKEN}` instead of `${NODE_AUTH_TOKEN}`. Use the latter.
- BuildKit not enabled — set `DOCKER_BUILDKIT=1` or use `docker buildx`.

## `nexus-build` errors with "no @NexusRemote found"

The decorator was not detected. Check:

- The class has both `@NexusRemote()` and `@Component(...)`. Order doesn't matter.
- The file is under `src/` (or `--src` value).
- The import is `from '@bimo-dk/nexus-build'` exactly.
- The class is exported (`export class` or `export default class`).

Run `nexus-build scan` to see what *was* discovered.

## WebSocket disconnects every 30s

A proxy or load balancer between the browser and the registry is closing idle connections.

```nginx
# nexus-gateway/nginx.conf — the /ws location must have:
proxy_read_timeout 86400;
proxy_send_timeout 86400;
```

In production, configure your LB to keep WebSockets open at least 60s.

## Two remotes have the same name → 409

```bash
# When publishing
curl -X POST -H "X-Nexus-Token: $T" -d '...' http://.../api/remotes
# 409 conflict { message: "Remote \"checkout\" already exists" }
```

Either:

- `DELETE /api/remotes/checkout` then re-POST.
- `PUT /api/remotes/checkout` with partial fields (most fields can be updated except `name`).

If you're using `bnx publish`, it currently POSTs; if you re-publish, expect 409. The `SelfRegisterService` in `@bimo-dk/nexus-runtime` already handles this by trying PUT-then-POST.

## Registry data disappeared after restart

The volume is not mounted.

```yaml
# docker-compose.yml — registry block must have:
volumes:
  - registry-data:/app/data
```

Without it, `data/registry.json` lives only inside the container's writable layer, which is reset on every `docker compose up --build`.

To recover, you can re-register every remote via portal or CLI. Or, if you have a backup, restore it:

```bash
docker cp ./registry.json.bak nexus-registry:/app/data/registry.json
docker compose restart registry
```

## "Out of sync" — portal shows remote X but the route doesn't work

This is rare and indicates the host did not receive the broadcast. Two checks:

1. **Is the host's WS connected?** Look at the portal's dashboard → connected clients. If `0`, the host's WS died.
2. **Is the host's `RegistryWebSocketService` connected?** Open the host in DevTools → Network → WS. You should see `/ws` with frames flowing.

Reload the browser tab — the host re-bootstraps and re-pulls `/api/remotes`. If that fixes it, the WS broadcast path needs investigation.

## "I changed nginx.conf but it has no effect"

You changed it in the repo, but the running container is using the baked copy.

```bash
docker compose up -d --build --no-deps gateway
```

`nginx.conf` is `COPY`'d at image build time. Editing the file on the host doesn't change the container — you must rebuild.

## When in doubt

```bash
# All service status
docker compose ps

# Last 50 log lines from every service
docker compose logs --tail=50

# Just the registry
docker compose logs -f registry

# Internal docker network connectivity
docker compose exec gateway wget -qO- http://registry:3000/health
docker compose exec gateway wget -qO- http://host:80/health
docker compose exec gateway wget -qO- http://remote-catalog:80/health
```

If `wget` from inside the gateway works but the browser doesn't, the issue is gateway's `nginx.conf` or the browser cache.
