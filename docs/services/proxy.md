---
id: proxy
title: Dev Proxy
sidebar_position: 6
---

# Dev Proxy

Repo: [`nexus-proxy`](https://github.com/Bimo-dk/nexus-proxy)

The **dev proxy** is the second-best feature of Nexus (after the registry, debatable). It lets you run *one* remote on your machine with hot reload while everything else — host, registry, all other remotes — is served by a shared staging environment.

You point your browser at `http://localhost:9000` and see the full application. The remote you are working on streams from your local `ng serve` and supports HMR; everything else is your team's deployed stack.

## Why this matters

The traditional micro-frontend dev story is painful:

- Start the host
- Start the registry
- Start every remote
- Configure half a dozen `proxy.conf.json` files

Within five minutes you've spent an afternoon on plumbing. The Nexus dev proxy collapses it to:

```bash
npm run dev:remote-one
```

You see the entire app, but only your remote is local.

## How it works

```
browser ──────► localhost:9000 (proxy)
                  │
   /remotes/remoteOne/* ──► localhost:8666  (your ng serve, with HMR)
   /remotes/remoteTwo/* ──► <shared env>
   /host/*              ──► <shared env>
   /api/*               ──► <shared env>
   /ws                  ──► <shared env>  (websocket upgrade)
   everything else      ──► <shared env>
```

The proxy is a small Express server using `http-proxy-middleware`. It reads `nexus.dev.json`, maps every `local` remote to a local port, and forwards everything else to `remote.url`.

## Configuration — `nexus.dev.json`

```jsonc
{
  "proxyPort": 9000,
  "local": {
    "remoteOne": 8666
  },
  "remote": {
    "url": "http://localhost:8668"
  },
  "logRouting": true
}
```

| Field | Description |
|---|---|
| `proxyPort` | Port the proxy listens on. Default `9000`. |
| `local` | Map of `<remote-name>` → local port. Each entry bypasses `remote.url`. |
| `remote.url` | Shared environment. Use staging URL for a realistic setup. |
| `remote.registryApiPath` | Default `/api`. Override if the staging registry lives elsewhere. |
| `logRouting` | `true` to log every request's destination. |

The CLI helper `dev-tools/switch-local.mjs` rewrites the `local` block atomically — used by the npm scripts so you can do `npm run dev:remote-two` without manually editing JSON.

## Token & correlation passthrough

The proxy forwards `X-Nexus-Token` and `X-Request-ID` to the shared env on every request. WebSockets are upgraded through with the same handlers. CORS is set wide-open (`*`) since this is a developer-only tool.

## Pointing at staging

Edit `remote.url` to your staging URL:

```jsonc
{
  "remote": { "url": "https://nexus-staging.example.com" }
}
```

Restart the proxy. Now your local remote hits the staging registry, host and other remotes.

## Hot reload

When you edit code in the locally running remote (e.g. `remote-one/src/...`), Angular's dev server reloads. The proxy does not need a restart — it does not read files; it only proxies URLs.

If you edit code on the proxy itself, restart it with `Ctrl+C` and re-run the npm script.

## Adding a new `dev:remote-X` script

In the `nexus` orchestrator's root `package.json`:

```json
{
  "scripts": {
    "dev:remote-three": "node dev-tools/switch-local.mjs remoteThree 8700 && concurrently \"cd remote-three && npm start\" \"npm run dev:proxy\""
  }
}
```

`switch-local.mjs` accepts `<name> <port>` and atomically rewrites the `local` block to that one entry.

## Output

```
╭───────────────────────────────────────────────────────────
│  Nexus Dev Proxy
├───────────────────────────────────────────────────────────
│  Listening:  http://localhost:9000
│  Shared:     http://localhost:8668
│  Local:
│    /remotes/remoteOne/* -> http://localhost:8666
╰───────────────────────────────────────────────────────────

[nexus-proxy] GET    /remotes/remoteOne/remoteEntry.json     -> LOCAL remoteOne (http://localhost:8666)
[nexus-proxy] GET    /host/remoteEntry.json                  -> SHARED (http://localhost:8668)
[nexus-proxy] POST   /api/remotes                            -> SHARED (http://localhost:8668)
```

## When the shared env goes down

Each shared-env request that fails returns a clear `502`:

```json
{
  "error": "shared_environment_unreachable",
  "target": "http://localhost:8668",
  "message": "connect ECONNREFUSED 127.0.0.1:8668",
  "path": "/api/remotes"
}
```

The proxy does not crash — open DevTools to see exactly which request failed.

## See also

- [Local dev workflow](../workflows/dev-mode.md) — full step-by-step.
- [`@bimo-dk/nexus-cli`](../packages/nexus-cli.md) — `bnx dev` is the spiritual successor and orchestrates this proxy from a per-app config file (`nexus.config.json`).
