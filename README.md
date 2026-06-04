# Nexus

> **An open-source Angular 19 micro frontend platform — developed by Bimo. MIT-licensed.**

Nexus is the production stack we wish existed when we started doing micro frontends in Angular. It bundles a **gateway**, a **layout host**, a **registry with WebSocket broadcast**, an **admin portal**, a **hot-reload dev proxy**, a **CLI** and a **7-package ecosystem** — so a multi-team product can ship independent remotes with zero downtime, no hand-edited federation config, and a one-command local dev loop.

```bash
docker compose up --build
# → http://localhost:8668   the app
# → http://localhost:8669   the admin portal
```

---

## What you get out of the box

- **Zero-config federation.** `@NexusRemote()` decorator generates `federation.config.json` at build time. You never hand-edit it.
- **Live remote registration.** Registry persists, WebSocket broadcasts — host adds the route without a restart.
- **Cross-team component catalog.** `@NexusComponent({...})` produces `catalog.json`; the portal `/catalog` page aggregates every remote into one searchable index.
- **One-tag component embedding.** `<nexus-component remote="..." expose="..." />` does fetch + cache + outlet + error state. No `loadRemoteModule()` glue.
- **Local dev that works.** `bnx dev` runs one remote on your laptop with HMR, everything else from shared staging — one command, multi-environment config.
- **Zero-downtime deploys.** `no-store` on `remoteEntry.json` and `chunk-*.js` baked into nginx. New bundles are visible instantly; no service worker, no cache-busting hash.
- **Three-layer fallback.** When the registry is unreachable: live → `sessionStorage` cache → static backup. The user keeps working.
- **Secure by default.** `X-Nexus-Token` on every registry endpoint. `nexusAuthInterceptor` injects it. BuildKit secrets for `NODE_AUTH_TOKEN` — tokens never end up in image layers.
- **Observable.** Correlation IDs per request, ring-buffered logs over `/api/system/logs`, latency + counter metrics over `/api/system/metrics`. Portal's log viewer streams from `/ws`.

> 📚 **Documentation:** generated from [`docs/`](./docs/) and deployed to GitHub Pages by [`.github/workflows/deploy-docs.yml`](./.github/workflows/deploy-docs.yml).

---

## The 30-second pitch

```ts
// In a remote — this is the only file you write
import { NexusRemote, NexusComponent } from '@bimo-dk/nexus-build';

@NexusRemote()                       // → federation config generated for you
@NexusComponent({                    // → catalog metadata in the portal
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
// In a host or another remote — three ways to mount it
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  nexusRoute({ path: 'orders', remote: 'orders', expose: 'OrderTable' }),
];

// or, as a drop-in tag anywhere:
<nexus-component remote="orders" expose="OrderTable" [inputs]="{ filter: 'pending' }" />
```

That's it. Federation, route registration, cache, error states, registry sync — all handled.

---

## Documentation

| Section | What's covered |
|---|---|
| [Why Nexus](./docs/getting-started/why-nexus.md) | What you don't have to build, what it costs, who it fits |
| [Installation](./docs/getting-started/installation.md) | Prereqs, env, compose, first remote |
| [Architecture](./docs/getting-started/architecture.md) | Request flow, deploy flow, fallback chain, security |
| [Services](./docs/services/gateway.md) | One page per service — gateway, registry, portal, host, remotes, proxy, base image |
| [Packages](./docs/packages/overview.md) | All 7 `@bimo-dk/nexus-*` packages |
| [Component catalog](./docs/workflows/component-catalog.md) | `@NexusComponent` + portal `/catalog` |
| [Loading patterns](./docs/workflows/loading-patterns.md) | Route, tag and programmatic ways to mount federated components |
| [Create a remote](./docs/workflows/create-remote.md) | End-to-end with `bnx` |
| [Local dev](./docs/workflows/dev-mode.md) | Hot reload one remote against staging |
| [Zero-downtime updates](./docs/workflows/zero-downtime.md) | Why a deploy never breaks the user |
| [Reference](./docs/reference/environment.md) | Env vars, security, HTTP/WS API, troubleshooting |

---

## Running the docs locally

```bash
npm install --legacy-peer-deps
npm run docs:start
# → http://localhost:3000
```

---

## GitHub Pages deployment

The site is built and deployed automatically by the workflow at `.github/workflows/deploy-docs.yml`:

1. Enable Pages on the repo: **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` — the workflow builds Docusaurus and deploys.

The workflow auto-detects the GitHub org and repo name, so no config edit is needed if you fork or rename.

---

## Layout

```
nexus/                        ← you are here — orchestrator + docs site
  docker-compose.yml
  docs/                       markdown source — readable on GitHub, built by Docusaurus
  src/, static/               docs theme + assets
  .github/workflows/          deploy-docs.yml for GitHub Pages

nexus-gateway/                public ingress (nginx + Angular SPA)
nexus-host-template/          host layout shell template
nexus-portal/                 admin UI (now includes /catalog page)
nexus-registry/               source of truth (Node/Express + WS)
nexus-remote-templat/         remote scaffold (consumed by `bnx generate remote`)
nexus-proxy/                  dev-time hot-reload proxy
nexus-base-image/             shared Docker base
nexus-packages/               @bimo-dk/* monorepo (Turbo + Changesets)
nexus-example/                NexusShop demo — 5 remotes showing nexusRoute, <nexus-component> and cross-remote composition
```

---

## About

Nexus is developed and maintained by **Bimo**. Built to give multi-team Angular products an honest path to micro frontends — no proprietary runtime, no lock-in, just sensible defaults on top of an ESM federation spec.

## License

MIT — see [LICENSE](./LICENSE).
