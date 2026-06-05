---
id: troubleshooting
title: Troubleshooting
sidebar_position: 6
description: Common Nexus problems and how to fix them. Auth, federation, WebSocket, CORS, BuildKit, gateway routing, and protection-layer false positives.
keywords:
  - Nexus troubleshooting
  - micro frontend debugging
  - federation errors
  - common issues
---

# Troubleshooting

Common failure modes and their fixes. Search the page (`Ctrl/Cmd-F`) for the error string you're seeing.

## Authentication

### `401 Unauthorized` from `/api/*`

Your `X-Nexus-Token` is missing or doesn't match. Check:

```bash
docker compose exec registry env | grep NEXUS_TOKEN
# Compare to what your client is sending.
```

Tokens are case-sensitive. The header name is `X-Nexus-Token`, exact spelling.

### Just rotated and now `401`

The grace period may have already expired. Check:

```bash
curl -H "X-Nexus-Token: $NEW_TOKEN" http://localhost:8668/api/config/token
# { "hasActive": true, "hasPrevious": false, ... }
```

If `hasPrevious` is `false`, the old token is gone — you need to use the new one everywhere. Restart any client that cached the old token.

## Federation

### `Cannot find module './RemoteEntry'`

The host received the federation manifest but the exposed module name doesn't match. Check:

- The remote's `exposes` block (in `federation.config.json` for Angular, in `nexusVite({ exposes })` for Vue/React).
- The `expose` field the host passes to `nexusRoute` / `useNexusComponent` / `<NexusComponent>`.

Both must be exactly the same. Default is `RemoteEntry`.

### Remote loads but renders nothing

The `default` export of the exposed module is missing or wrong. The Angular adapter expects a class with `@Component`; Vue expects an SFC `<script setup>` module; React expects a function component.

### `loadRemoteModule` throws `404`

The gateway has no route for `/remotes/<name>/*`. Check:

```bash
bnx status
# Is the remote enabled? Listed?
```

If listed but 404: the gateway's route table didn't pick up the change. Restart the gateway, or check its log:

```
docker compose logs gateway | grep -i "route_table"
```

### Stale `remoteEntry.json` after deploy

The gateway's `Cache-Control` rule isn't reaching the browser. Common causes:

- A CDN in front of the gateway is overriding `no-store`. Set `no-store` at the CDN too.
- The remote's nginx config sets a long cache. Remove the override.

## WebSocket

### `WebSocket connection failed`

Check:

```bash
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8668/ws
# Should return HTTP/1.1 426 (browser-only upgrade) or 101 (server-side test client)
```

If `404`, the gateway isn't routing `/ws`. Confirm it's running and connected to the registry:

```bash
curl http://localhost:8668/health
# Expect "registry_connected": true
```

### Reconnects forever, never gets `welcome`

The token is invalid for the WS. Browser DevTools → Network → WS frame inspection should show a close with code 1008 or 4401. Update the token in the client.

## CORS

### `Access-Control-Allow-Origin missing`

The registry's `ALLOWED_ORIGINS` doesn't include the calling origin. Update:

```bash
# .env
ALLOWED_ORIGINS=https://shop.example.com,https://admin.example.com
docker compose restart registry
```

Wildcards aren't supported — list each origin.

### Browser sees `Access-Control-Allow-Origin: *` but still gets blocked

Either you're sending credentials (then `*` isn't allowed — use the explicit origin) or you have a stale CORS preflight cached. Open DevTools → Network → check the OPTIONS request, then disable cache and retry.

## BuildKit / npm

### `Could not resolve "@bimo-dk/nexus-runtime"` during Docker build

The BuildKit secret didn't reach the build stage. Common causes:

- Forgot `--secret id=npmrc,src=$HOME/.npmrc` on `docker build`.
- The `RUN` line is missing `--mount=type=secret,id=npmrc,target=/root/.npmrc`.
- The `.npmrc` doesn't have the GitHub Packages line.

Verify locally:

```bash
cat ~/.npmrc
# Should include:
# @bimo-dk:registry=https://npm.pkg.github.com
# //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}

echo $NODE_AUTH_TOKEN | head -c 8
# Should print eight chars of your PAT.
```

### `npm error code E401` from GitHub Packages

Your PAT doesn't have `read:packages` scope, or it's expired. Regenerate at github.com → Settings → Developer settings → Personal access tokens.

## Gateway routing

### `Bad Gateway 502`

The upstream isn't reachable. Check:

- The container is running (`docker compose ps`).
- The container's port matches the `UPSTREAM_URL` registered with the registry.
- The Docker network is the same for both gateway and upstream.

### Routes for a new gate don't work

The gateway runs per-instance with one gate selected. If you added a gate after the gateway started, restart the gateway, or set `NEXUS_GATE_NAME` explicitly so the new gate is picked.

## Protection layer false positives

### Legitimate user got banned

In the portal → Protection page → find them in **Active bans** → click **Unban**. Then raise `banThresholdViolations` — your threshold is too tight for your traffic.

### Healthchecks getting rate-limited

The gateway has no built-in whitelist today. Either:

- Route healthchecks through a different gate that bypasses the rate limit.
- Send them from a known IP and accept the violations (they're below ban threshold under normal cadence).

### Real users hitting `payload_too_large`

`maxBodyBytes` defaults to 1 MiB. Raise it for endpoints that accept uploads.

## CLI

### `bnx publish` fails with `ECONNREFUSED`

`REGISTRY_URL` doesn't resolve. Check:

```bash
echo $REGISTRY_URL
curl -s $REGISTRY_URL/health
```

If you're running outside Docker, use `http://localhost:8668` (through the gateway) or `http://localhost:8670` (registry direct, dev compose only).

### `bnx dev` reports remotes as "not running"

The autostart didn't pick them up. Check that:

- `nexus.config.json#dev.remotes.<name>.path` is correct.
- `npm start` in that path works manually.
- The `port` matches what the dev script binds to.

### `bnx status` shows `framework: unknown`

The host record is missing the `framework` field. This happens with hosts created before multi-framework support. Update via:

```bash
curl -X PUT http://localhost:8668/api/hosts/$HOST_ID \
  -H "X-Nexus-Token: $NEXUS_TOKEN" \
  -d '{ "framework": "angular" }'
```

## Performance

### Slow first page load

Pre-load remotes you know the user will need:

```ts
// Angular
provideNexusHost({ preload: ['catalog', 'orders'] })
```

The federation runtime fetches and resolves them in parallel, so the first navigation is instant.

### Registry RAM climbing

The log buffer holds `LOG_BUFFER_CAPACITY` entries (default 500). If you bumped it for debugging, lower it again.

The WebSocket broadcast channel has a fixed capacity (256 messages). It should not grow unbounded. If it does, file a bug.

## When all else fails

Look at the correlation id. Every error response carries one (`correlationId` field). Search the registry logs:

```bash
docker compose logs registry | grep <correlation-id>
```

You'll see every log line for that request — middleware decisions, validation, store calls, broadcast emission. That's usually enough to identify the root cause.

## Next

- [Reference: security](security.md)
- [Infra: protection](../infrastructure/infra-protection.md)
- [Workflows: zero-downtime](../workflows/zero-downtime.md)
