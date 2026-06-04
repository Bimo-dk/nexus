---
id: architecture
title: Architecture
sidebar_position: 4
---

# Architecture

## Request flow at runtime

```
Browser
  │
  │ 1. GET /                       (HTML shell)
  ▼
gateway:80
  │  └─ serves dist/app/browser/index.html (its own SPA)
  │
  │ 2. /assets/config.json         (runtime config — substituted at container start)
  │
  │ 3. The app's bootstrap fetches the host federation entry:
  │    GET /host/remoteEntry.json  (proxied to host:80)
  │
  ▼
host:80
  │  - returns federation manifest
  │  - browser loads host AppShell as an ES module
  │
  │ 4. Host bootstrap runs:
  │      - GET /api/remotes        (proxied to registry:3000)
  │      - WS  /ws                 (proxied to registry:3000)
  │
  ▼
registry:3000
  │  - returns enabled remotes
  │  - keeps WS open for live updates
  │
  │ 5. For each remote, gateway proxies by upstreamUrl from registry:
  │      GET /remotes/<name>/remoteEntry.json  →  remote's upstreamUrl
  │
  ▼
remote-catalog:80    remote-cart:80    ...
```

Everything that the browser sees is `localhost:8668` — the gateway hides all upstream services behind a single nginx reverse-proxy.

The gateway nginx proxy routes are not static. At startup, gateway reads `GET /api/remotes` from the registry and generates location blocks for every enabled remote, using the remote's `upstreamUrl` field as the nginx upstream. When the registry broadcasts `remotes_changed`, gateway regenerates the routes and issues `nginx -s reload` — a graceful reload that does not drop in-flight requests.

This means remote containers can be named anything on the Docker network. The coupling between public path (`/remotes/catalog/`) and internal service name (`http://whatever-you-called-it:80`) lives only in the remote's own environment variables, not in the gateway config.

## Two timelines: cold start vs. live update

### Cold start (first visit)

```
T+0  ms  browser   GET /                          gateway
T+50 ms  browser   GET /assets/config.json        gateway
T+100ms  browser   GET /host/remoteEntry.json     gateway → host
T+150ms  host      GET /api/remotes               registry
T+200ms  host      WS  /ws (subscribe)            registry
T+250ms  host      loadRemoteModule(catalog)
T+300ms  browser   GET /remotes/catalog/...       gateway → remote-catalog
```

### Live add (operator opens portal and adds a remote)

```
T+0  s   operator  POST /api/remotes              portal → registry
T+5  ms  registry  writes registry.json
T+5  ms  registry  broadcasts { type: "remotes_changed", remotes: [...] }
T+10 ms  host      receives broadcast, calls loadRemoteModule()
T+50 ms  host      router gets new route — no reload
```

No reload, no container restart, no downtime.

## Deployment topology

```
                                  ┌───────────────────┐
                                  │ Docker host       │
                                  │                   │
        browser  ───── :8668 ────►│  gateway  (nginx) │
                                  │                   │
        operator ───── :8669 ────►│  portal   (nginx) │
                                  │                   │
                                  │  ┌─────────────┐  │
                                  │  │  registry   │  │  in-network only
                                  │  │  (Node 22)  │  │  exposed :3000
                                  │  └─────────────┘  │
                                  │  ┌─────────────┐  │
                                  │  │  host       │  │  in-network only
                                  │  │  (nginx)    │  │  expose :80
                                  │  └─────────────┘  │
                                  │  ┌─────────────┐  │
                                  │  │  remote-X   │  │  in-network only
                                  │  │  (nginx)    │  │  expose :80
                                  │  └─────────────┘  │
                                  └───────────────────┘
```

In production each remote is its own container, deployed by its team's CI. The `nexus` orchestrator references them by `build:` context (for dev) or `image:` reference (for prod pulls). Gateway reads each remote's `UPSTREAM_URL` from the registry and proxies to that address — the Docker service name can be anything.

## Why a gateway in front of host?

A separate gateway gives:

1. **Stable public URL** — `/host/*`, `/remotes/*` and `/api/*` are stable contracts. Host and remotes can be redeployed independently without touching browser-side URL constants.
2. **One TLS termination point** — `gateway` is the only container with a public port. Run TLS there once.
3. **One CORS origin** — every browser request goes to the same origin. CORS becomes a non-issue.
4. **WebSocket proxying** — `gateway/nginx.conf` upgrades `/ws` to the registry. Browser code only talks to its own origin.
5. **Caching policy in one place** — `remoteEntry.json` and `chunk-*.js` are tagged `no-store` (because they change with every deploy); other static assets are `immutable, max-age=31536000`.

## Why a registry?

Without one, every host build would hard-code the remote URLs — adding a remote means rebuilding host. The registry inverts the dependency:

- Host says: "give me the list of currently enabled remotes."
- Registry answers from disk (`data/registry.json`).
- A change to the registry — via Portal UI or `bnx publish` — fans out to every connected host over WebSocket.

The registry is the only stateful component. Its disk is the source of truth.

## Two HTTP layers

There are two HTTP layers in the request graph. They are both built from the same building blocks but have different roles:

1. **gateway/nginx** — opaque reverse proxy. Routes by URL prefix. Proxy rules are generated dynamically from registry data at startup and reloaded on every `remotes_changed` broadcast — no hardcoded remote names.
2. **host/Angular** — runtime federation loader. Reads `/api/remotes`, loads each entry, calls `provideRouter` for each route.

This separation means an operator can change which remotes are live (registry change → broadcast → host re-route) without ever touching the nginx layer.

## Token & correlation

Two headers are added at every layer:

| Header | Set by | Read by |
|---|---|---|
| `X-Nexus-Token` | `nexus-runtime`'s `nexusAuthInterceptor` (and `bnx` for server-side) | registry `nexusTokenAuth` middleware |
| `X-Request-ID` | `nexus-runtime`'s `correlationIdInterceptor` (UUID v4 per request) | registry `correlationMiddleware`, log buffer |

Every registry log line and error response carries the correlation id, so a failed call in the browser DevTools can be traced through the gateway, into the registry log, and out the WebSocket broadcast.

## Failure modes — what happens when X dies?

| Failure | Effect on user | Recovery |
|---|---|---|
| One remote container dies | That remote's route 502s on next navigation. Other remotes unaffected. | Restart the container — host receives no broadcast but next load works. |
| Host container dies | Browser cannot bootstrap host shell — gateway returns 502 from `/host/...`. | Restart `host`. The browser app retries up to `environment.retryAttempts`. |
| Registry container dies | Existing browser tabs keep working (cached remotes). New tabs see a backup file or empty list. | Restart `registry`. WebSocket auto-reconnects with exponential backoff. |
| Gateway container dies | Total outage — there is no upstream visible to the browser. | Restart `gateway`. |
| Disk full on registry volume | Writes start to fail with 5xx. Reads still work. | Increase volume, drain registry. |
| Gateway nginx reload fails | Routes stay as they were before reload. | Check nginx error log: `docker compose logs gateway`. Registry still has the new remote — retry is automatic on next `remotes_changed`. |

The host has a three-layer fallback chain for registry reads:

```
1. live registry over HTTP
   └─ fail ─► 2. browser sessionStorage cache
              └─ fail ─► 3. static file at /assets/registry-backup/remotes.json
```

## Reading the code

- Browser routes: `nexus-gateway/src/app/services/host-loader.service.ts`.
- Host federation bootstrap: `nexus-host-template/src/app/app.config.ts` (provider) + `@bimo-dk/nexus-runtime` `DynamicNexusService`.
- Registry HTTP: `nexus-registry/src/index.ts`, routes in `src/routes/`.
- Registry WS broadcast: `nexus-registry/src/websocket.ts`.
- nginx reverse proxy: `nexus-gateway/nginx.conf`.
