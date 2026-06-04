---
id: portal
title: Portal
sidebar_position: 3
description: The Nexus admin portal — Angular 19 operator UI for managing remotes, viewing live logs and metrics, toggling features, and monitoring registry health. Real-time updates over WebSocket, no page refresh needed.
keywords: [micro frontend admin portal, Angular admin dashboard, remote management UI, micro frontend operator tools]
---

# Portal

Repo: [`nexus-portal`](https://github.com/Bimo-dk/citizen/nexus-portal) — Image: `ghcr.io/bimo-dk/nexus-portal`

The **portal** is an Angular 19 admin app for operating the platform. It talks to the registry over HTTP + WebSocket, never to the remotes directly.

URL: http://localhost:8669

## Feature areas

| Route | Component | What you can do |
|---|---|---|
| `/dashboard` | `DashboardComponent` | One-glance status: registry online, remote count, last broadcast, recent log lines |
| `/system/health` | `SystemComponent` | Live aggregated health from `/api/system/health` |
| `/system/config` | `ConfigComponent` | Effective registry config (env-derived) |
| `/system/logs` | `LogsComponent` | Live log viewer over `/ws` log subscription |
| `/system/metrics` | `MetricsComponent` | Per-route counters, p50/p95 latencies, custom counters |
| `/remotes` | `RemoteListComponent` | Table of remotes with toggle/delete actions |
| `/remotes/new` | `RemoteAddComponent` | Form to register a remote |
| `/remotes/:name` | `RemoteDetailComponent` | One remote — config, health, redeploy button |

## How the portal talks to the registry

- HTTP — `ManagerService` (under `features/services/`) uses `HttpClient` with the `nexusAuth` and `correlationId` interceptors, exactly like the host. Token is loaded from `/assets/config.json` at app start.
- WebSocket — the portal subscribes to `remotes_changed`, `system_health` and `log` events from `/ws` and updates signals in place.

This means every action you take in the portal is reflected on connected hosts within milliseconds — *and* every change a CLI client makes shows up in the portal without refresh.

## Build & deploy

The portal is shipped as a single Docker image. At container start, `docker-entrypoint.d/40-runtime-config.sh` substitutes:

- `NEXUS_TOKEN` into the bundled interceptor
- `REGISTRY_URL` into `/assets/config.json`

so the same image runs against any environment.

```bash
docker compose up --build portal
```

## Adding a new view

Components live under `src/app/features/`. The pattern:

1. Create a standalone component under `features/<area>/<view>.component.ts`.
2. Add a lazy `loadComponent` route in `app.routes.ts`.
3. Inject the existing `ManagerService` and read from its signals.

The whole app is `OnPush` + signals; there is no Zone-based change detection mental model — values change only when a signal updates.

## Local development

```bash
cd nexus-portal
npm ci
npm start            # ng serve --port 8669 --host 0.0.0.0
```

For talking to a local registry, set `/assets/config.json` to:

```json
{ "registryUrl": "http://localhost:3000", "nexusToken": "dev-token" }
```

For developing the portal while pointing at a deployed registry, use the dev-proxy and put the portal's `registryUrl` to `/api`:

```jsonc
// nexus.dev.json (in nexus orchestrator)
{ "proxyPort": 9000, "local": {}, "remote": { "url": "https://nexus-staging.example.com" } }
```

Then run the portal on top of the proxy.

## Files of interest

- `src/app/features/services/manager.service.ts` — single point of contact for registry calls.
- `src/app/interceptors/nexus-auth.interceptor.ts` — adds `X-Nexus-Token`.
- `src/app/interceptors/correlation-id.interceptor.ts` — adds `X-Request-ID`.
- `src/app/types/` — UI-side mirror of `@bimo-dk/nexus-core` types.

## Why not just curl the registry?

The portal is the **discoverability surface** for everyone who is not a developer with `curl` muscle memory:

- A PM can see "is the platform up?" without opening a terminal.
- A tester can toggle a remote on/off without redeploying.
- An on-call engineer can read live logs without `docker logs`.

It is the same registry API behind a calm UI.
