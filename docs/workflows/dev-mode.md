---
id: dev-mode
title: Local dev mode (hot reload)
sidebar_position: 2
---

# Local dev mode

Run one (or more) remotes on your machine with hot reload — everything else (host, registry, other remotes) is served from a shared dev/staging environment. You see the full app in your browser, but only the parts you're working on come from your local Angular dev server.

There are two flavours of this:

| Tool | Config file | When to use |
|---|---|---|
| `npm run dev:<remote>` in the `nexus` orchestrator | `nexus.dev.json` | Working with the NexusShop example monorepo |
| `bnx dev` (CLI, recommended) | `nexus.config.json` | Any app — first-class multi-environment config |

The flows look the same to the browser. Pick whichever matches the repo layout.

## Quick start with `npm run dev:catalog`

```bash
# In the nexus orchestrator repo (nexus-example cloned as a sibling)
git clone https://github.com/Bimo-dk/nexus.git
cd nexus

# nexus.dev.json is already configured
npm run dev:catalog
```

What happens:

1. `dev-tools/switch-local.mjs catalog 8701` atomically rewrites the `local` block in `nexus.dev.json`.
2. `concurrently` starts:
   - `cd ../nexus-example/remote-catalog && npm start` (Angular dev server on :8701 with HMR)
   - `npm run dev:proxy` (the nexus dev-proxy on :9000)
3. You open http://localhost:9000.

The browser sees the full NexusShop app — host, layout, registry — from `nexus.dev.json#remote.url`, with `/remotes/catalog/*` going to `localhost:8701` instead.

### Switching to another remote

```bash
npm run dev:cart      # catalog local → cart local
npm run dev:checkout  # cart local → checkout local
```

Scripts available: `dev:catalog` (:8701), `dev:cart` (:8702), `dev:product` (:8703), `dev:checkout` (:8704), `dev:account` (:8705).

Stop the current proc (`Ctrl+C`), then run the script for the remote you want. The proxy starts fresh against the new local.

### Pointing at staging

Edit `nexus.dev.json`:

```jsonc
{
  "remote": { "url": "https://nexus-staging.example.com" }
}
```

Now your local remote runs against staging's host + registry. You see real staging data, but with your code in the remote you're iterating on.

## Quick start with `bnx dev`

```bash
npm install -g @bimo-dk/nexus-cli

# In your app repo (with nexus.config.json)
bnx dev
```

The CLI reads `nexus.config.json` and:

1. Picks the `baseEnv` (e.g. `staging`).
2. Autostarts any remote with `autostart: true` (`npm start` in the configured `path`).
3. Starts the proxy on `proxyPort`.
4. Opens your browser.

### `nexus.config.json` setup

```jsonc
{
  "environments": {
    "staging": {
      "publicUrl": "https://nexus-staging.example.com",
      "tokenEnv": "NEXUS_STAGING_TOKEN"
    }
  },
  "dev": {
    "baseEnv": "staging",
    "proxyPort": 9000,
    "remotes": {
      "checkout": {
        "port": 4201,
        "path": "./packages/checkout",
        "autostart": true
      }
    }
  }
}
```

Set `NEXUS_STAGING_TOKEN` in your `.env` (in the cwd) and run `bnx dev`. The CLI loads `.env` for you.

### Running more than one remote locally

Add multiple entries under `dev.remotes`:

```jsonc
{
  "dev": {
    "remotes": {
      "checkout": { "port": 4201, "path": "./packages/checkout", "autostart": true },
      "orders":   { "port": 4202, "path": "./packages/orders",   "autostart": true }
    }
  }
}
```

`bnx dev` will autostart both. Each gets its own HMR; the proxy routes `/remotes/checkout/*` and `/remotes/orders/*` to the respective ports; everything else goes to staging.

## What the browser sees

```
http://localhost:9000
  └─ GET /                          → staging (host shell)
  └─ GET /assets/config.json        → staging
  └─ GET /host/remoteEntry.json     → staging
  └─ GET /api/remotes               → staging
  └─ WS  /ws                        → staging
  └─ GET /remotes/checkout/*        → http://localhost:4201   ◄── your code, HMR
  └─ GET /remotes/orders/*          → http://localhost:4202   ◄── your code, HMR
```

The host shell believes it is talking to staging end-to-end; it has no idea your two remotes are local. Federation simply loads whatever URL the registry says — and the proxy intercepts that URL.

## Hot reload caveats

- Angular's HMR works **inside** your remote. Save a `.ts` file under `packages/checkout/src/...` → HMR.
- Changes to `federation.config.json` itself need a full rebuild (`npm run build`) — the host re-evaluates the manifest on the next module load.
- Changes in *other* remotes deployed to staging are visible on the next navigation — the host's WebSocket connection to staging's `/ws` receives the broadcast and updates routes without refresh.

## Debugging the proxy

`logRouting: true` (default) prints every routing decision:

```
[nexus-proxy] GET    /remotes/checkout/remoteEntry.json     -> LOCAL checkout (http://localhost:4201)
[nexus-proxy] GET    /host/remoteEntry.json                 -> SHARED (https://nexus-staging.example.com)
[nexus-proxy] POST   /api/remotes                           -> SHARED (https://nexus-staging.example.com)
```

When staging is unreachable, the proxy returns a 502 with the error message — it does not crash:

```json
{
  "error": "shared_environment_unreachable",
  "target": "https://nexus-staging.example.com",
  "message": "getaddrinfo ENOTFOUND nexus-staging.example.com",
  "path": "/api/remotes"
}
```

## Auth in dev

The proxy forwards `X-Nexus-Token` and `X-Request-ID` to the shared env unchanged. The host you load from staging brings its own token (baked into its `/assets/config.json` at staging build time), so you typically don't need to set anything yourself.

If you need to override the token for testing: edit `nexus.config.json`'s `environments.staging.tokenEnv` and set that env-var in your shell.

## Related

- [`nexus-proxy` reference](../services/proxy.md) — the underlying proxy.
- [`bnx dev`](../packages/nexus-cli.md#bnx-dev--the-local-dev-workflow) — the CLI wrapper.
