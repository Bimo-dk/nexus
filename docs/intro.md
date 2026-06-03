---
id: intro
title: Nexus
slug: /
sidebar_position: 1
---

# Nexus — micro frontends without the pain

> **An open-source Angular 19 micro frontend platform — developed by Bimo. MIT-licensed.**

Nexus is the production stack we wish existed when we started doing micro frontends in Angular. It bundles a **gateway**, a **layout host**, a **registry with WebSocket broadcast**, an **admin portal**, a **hot-reload dev proxy**, a **CLI** and **seven `@bimo-dk/*` packages** — so a multi-team product can ship independent remotes with zero downtime, no hand-edited federation config, and a one-command local dev loop.

```bash
docker compose up --build
# → http://localhost:8668   the app
# → http://localhost:8669   the admin portal
```

---

## Why you want this

| Pain | What Nexus does |
|---|---|
| Hand-editing `federation.config.json` per remote | `@NexusRemote()` decorator — config is generated at build time |
| Restarting the host every time a remote ships | Registry broadcasts over WebSocket; host adds the route live |
| "Works on my machine" remote dev | `bnx dev` runs one remote locally against shared staging in a single command |
| Browser caching a stale `remoteEntry.json` after deploy | Gateway sets `no-store` on every federation entry — new bundles are visible instantly |
| No way to discover what components other teams expose | `@NexusComponent({...})` produces a `catalog.json`; the portal shows an aggregated, searchable catalog |
| Five YAML files to add a new mount-point in your shell | `<nexus-component remote="..." expose="..." />` or `nexusRoute({...})` — one line each |
| Registry outage = production outage | Three-layer fallback: live → sessionStorage cache → static backup |
| Federation tokens leaking through build args | BuildKit `--mount=type=secret` baked into every Dockerfile template |
| Multiple teams stepping on the same gateway URL | Stable `/host/*`, `/remotes/<name>/*`, `/api/*` contract — host & remotes redeploy independently |

---

## The 30-second pitch

```ts
// In a remote — this is the only file you should write
import { NexusRemote, NexusComponent } from '@bimo-dk/nexus-build';

@NexusRemote()                           // <- federation config is generated for you
@NexusComponent({                        // <- catalog metadata appears in the portal
  title: 'Order Table',
  category: 'data-display',
  tags: ['orders', 'commerce'],
  inputs: {
    filter: { type: 'string', default: 'pending' },
    pageSize: { type: 'number', default: 25 },
  },
})
@Component({ /* ... */ })
export default class OrderTableComponent {}
```

```ts
// In the host — three ways to mount a federated component
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  nexusRoute({ path: 'orders', remote: 'orders', expose: 'OrderTable' }),
];

// or as a drop-in tag, anywhere in any template:
<nexus-component remote="orders" expose="OrderTable" [inputs]="{ filter: 'pending' }" />
```

That's it. Federation, route registration, cache, error states, registry sync — all handled.

---

## What's in the platform

```
        Browser
           |
           v
    +-------------+
    |   gateway   |  :8668  (public entry — nginx + thin Angular)
    +-------------+
           |
           |  /host/*       -> host (layout shell)
           |  /remotes/*    -> a remote (micro frontend)
           |  /api/*        -> registry HTTP API
           |  /ws           -> registry WebSocket
           v
    +-------------+   +-------------+   +-------------+
    |    host     |   |  remote-X   |   |  registry   |
    +-------------+   +-------------+   +-------------+
           ^
           |  fetches enabled remotes
           +-- WebSocket /ws — live config updates
                       |
                +-------------+
                |   portal    |  :8669  (admin UI + component catalog)
                +-------------+
```

| Piece | What it is | Where it lives |
|---|---|---|
| **Gateway** | Public entry, nginx reverse-proxy + minimal Angular shell | [`nexus-gateway`](services/gateway.md) |
| **Host** | Layout shell that federates remotes at runtime | [`nexus-host-template`](services/host.md) |
| **Registry** | Source of truth — Node/Express + WebSocket broadcast | [`nexus-registry`](services/registry.md) |
| **Portal** | Admin Angular app: dashboard, metrics, remote CRUD, component catalog | [`nexus-portal`](services/portal.md) |
| **Remote template** | Starter app cloned by `bnx generate remote` | [`nexus-remote-templat`](services/remotes.md) |
| **Dev proxy** | Local hot-reload proxy — one remote local, everything else staging | [`nexus-proxy`](services/proxy.md) |
| **Base image** | Shared Docker base for every service | [`nexus-base-image`](services/base-image.md) |
| **Packages** | 7 published packages (core, client, build, runtime, ui, testing, cli) | [`nexus-packages`](packages/overview.md) |
| **Example** | Runnable playground with 20+ demo components driven by catalog | [`nexus-example`](workflows/example-playground.md) |

---

## When it fits

- One product, several teams contribute — each owns their own pipeline and Docker image.
- The user must never see a deployment break — remotes are loaded by URL at runtime.
- A team can spin up locally and work on **only their remote** while everything else runs in shared staging.
- You want a searchable cross-team catalog of "what components do we have?" without standing up a separate Storybook deployment.
- You need the boring stuff (auth header, correlation id, fallback chain, health checks, structured logs, metrics) without writing it yourself.

---

## What's next

- [Why Nexus over plain Native Federation](getting-started/why-nexus.md) — the value-add in numbers.
- [Setup & install](getting-started/installation.md) — get everything running locally in 5 minutes.
- [Architecture deep dive](getting-started/architecture.md) — request flow, deploy flow, fallback chain, security.
- [Create a new remote](workflows/create-remote.md) — end-to-end with `bnx`.
- [Component catalog](workflows/component-catalog.md) — `@NexusComponent`, `<nexus-component>`, the portal catalog.
- [Loading patterns](workflows/loading-patterns.md) — route-based, tag-based, programmatic.

---

## About

Nexus is developed and maintained by **Bimo**. Built to give multi-team Angular products an honest path to micro frontends — no proprietary runtime, no lock-in, just sensible defaults on top of an ESM federation spec.

MIT-licensed. Free to use, free to fork, contributions welcome.
