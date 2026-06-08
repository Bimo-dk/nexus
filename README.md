# Nexus

> **The production micro frontend platform for Angular, Vue, and React.**
> One Rust-powered registry. One Rust-powered gateway. Unlimited applications. Dual-licensed AGPL-3.0-or-later or commercial.

Nexus solves the operational layer that Module Federation and Native Federation never touched: a persistent Rust registry of hosts, gates, and remotes; a Rust gateway that builds its proxy table from that registry at runtime; an admin portal; built-in DDoS protection; and adapter packages so an Angular host can load a Vue remote and a React remote in the same browser tab.

```bash
docker compose up --build
# → http://localhost:8668   the application
# → http://localhost:8669   the admin portal
```

---

## What you get out of the box

- **Three frameworks, one platform.** Angular 19, Vue 3, React 18. Mixed-stack hosts (Angular host loading Vue and React remotes) are first-class.
- **Rust registry and gateway.** ~12 MB RSS at idle, ~20 ms cold start, sub-millisecond hot-route swap when a remote is added.
- **Hosts, gates, remotes.** One registry manages unlimited applications. Many domains can point to one host via gates. Remotes are global or host-specific.
- **Self-registering remotes.** A remote container POSTs itself to the registry at startup. The registry broadcasts. The host and gateway pick it up live — no restart.
- **Seven-layer DDoS protection.** IP bans, connection caps, rate limiting, payload caps, header caps, Slowloris detection, WebSocket caps — all hot-configurable from the portal.
- **Hot-reloadable platform config.** Rate limits, breaker policy, WS reconnect, graceful shutdown, metrics, token rotation. Editable in the portal, applied in milliseconds.
- **Cross-team component catalog.** `@NexusComponent` (Angular) or the `catalog` field on `nexusVite` (Vue / React) populates a discoverable inventory in the portal.
- **Zero-downtime deploys.** Gateway hot-swaps routes; cache rules on `remoteEntry.json` and `chunk-*.js` mean a new bundle is visible the instant a container is up.
- **Three-layer fallback for the host.** Live registry → `sessionStorage` cache → static backup JSON. Open browser tabs survive a 30-minute registry outage.
- **Secure by default.** Machine-to-machine: `X-Nexus-Token` on every endpoint with rotation + grace period. Human-to-portal: username/password login backed by SQLite, role-based access (admin / developer), httpOnly session cookies — the registry token is held server-side and never reaches the browser. BuildKit secrets for GitHub Packages auth — tokens never end up in image layers.
- **Observable.** Prometheus `/metrics` on both registry and gateway. Per-request correlation IDs. Ring-buffered logs streamed over the WebSocket.

> 📚 **Documentation:** generated from [`docs/`](./docs/) (Docusaurus) and deployed to GitHub Pages by [`.github/workflows/deploy-docs.yml`](./.github/workflows/deploy-docs.yml).

---

## The 30-second pitch

```ts
// A remote — Vue, in three lines plus the component.
import { createApp } from 'vue';
import { registerNexusRemote } from '@bimo-dk/nexus-runtime-vue';
import App from './app.vue';

registerNexusRemote({
  name: 'checkout',
  url: `${window.location.origin}/remoteEntry.json`,
  exposedModule: './RemoteEntry',
  routePath: 'checkout',
});

createApp(App).mount('#app');
```

```ts
// A host — Angular, in one provider.
import { provideNexusHost, nexusRoute } from '@bimo-dk/nexus-runtime';

bootstrapApplication(AppShell, {
  providers: [
    provideRouter([
      nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),
    ]),
    provideNexusHost({ configDefaults: { registryUrl: '/api' } }),
  ],
});
```

That's it. Federation, registration, route propagation, gateway proxy, cache, fallback — all handled.

---

## Repos in this workspace

Each row is a separate GitHub repo under [Bimo-dk](https://github.com/Bimo-dk). They are cloned side-by-side into one working directory; the `push-all.ps1` script at workspace root pushes branches across all of them.

| Repo | Role | Stack |
|---|---|---|
| [`nexus`](https://github.com/Bimo-dk/nexus) (you are here) | Orchestrator + docs site (Docusaurus) | docker-compose, scripts |
| [`nexus-gateway`](https://github.com/Bimo-dk/nexus-gateway) | Public ingress, hot-swap routing, 7-layer protection | Rust + axum + hyper |
| [`nexus-registry`](https://github.com/Bimo-dk/nexus-registry) | Source of truth for hosts, gates, remotes, config | Rust + axum + sqlx |
| [`nexus-portal`](https://github.com/Bimo-dk/nexus-portal) | Admin UI with auth/RBAC BFF — compact, dark/light, live | Angular 19 + Fastify + SQLite |
| [`nexus-host-template`](https://github.com/Bimo-dk/nexus-host-template) | Angular host scaffold | Angular 19 |
| [`nexus-host-template-vue`](https://github.com/Bimo-dk/nexus-host-template-vue) | Vue host scaffold | Vue 3 |
| [`nexus-host-template-react`](https://github.com/Bimo-dk/nexus-host-template-react) | React host scaffold | React 18 |
| [`nexus-remote-templat`](https://github.com/Bimo-dk/nexus-remote-templat) | Angular remote scaffold | Angular 19 |
| [`nexus-remote-templat-vue`](https://github.com/Bimo-dk/nexus-remote-templat-vue) | Vue remote scaffold | Vue 3 |
| [`nexus-remote-templat-react`](https://github.com/Bimo-dk/nexus-remote-templat-react) | React remote scaffold | React 18 |
| [`nexus-proxy`](https://github.com/Bimo-dk/nexus-proxy) | Dev-time hot-reload proxy | Node |
| [`nexus-base-image`](https://github.com/Bimo-dk/nexus-base-image) | Shared Docker base layer | node:22-alpine + nginx |
| [`nexus-packages`](https://github.com/Bimo-dk/nexus-packages) | Turborepo with 10 `@bimo-dk/*` SDK packages | TypeScript |
| [`nexus-cli`](https://github.com/Bimo-dk/nexus-cli) | `bnx` CLI — generate, publish, dev, status, health | Node |
| [`nexus-example`](https://github.com/Bimo-dk/nexus-example) | NexusShop demo — 5-remote webshop | Angular |

---

## Documentation

| Section | What's covered |
|---|---|
| [Why Nexus](./docs/getting-started/why-nexus.md) | What you don't have to build, the honest tradeoffs |
| [Installation](./docs/getting-started/installation.md) | Prereqs, env, compose, first remote |
| [Architecture](./docs/getting-started/architecture.md) | Request flow, deploy flow, fallback chain, failure modes |
| [Ports and URLs](./docs/getting-started/ports-and-urls.md) | The public URL contract and cache rules |
| [Quick start: Angular](./docs/getting-started/quick-start-angular.md) | Five-minute Angular remote |
| [Quick start: Vue](./docs/getting-started/quick-start-vue.md) | Five-minute Vue remote |
| [Quick start: React](./docs/getting-started/quick-start-react.md) | Five-minute React remote |
| [Mixed-stack guide](./docs/guides/guide-mixed-stack.md) | Flagship: Angular host loading Vue and React remotes |
| [Infrastructure](./docs/infrastructure/infra-registry.md) | Registry, gateway, portal, hosts and gates, protection, HA, metrics |
| [Packages](./docs/packages/overview.md) | All 10 `@bimo-dk/nexus-*` packages |
| [Workflows](./docs/workflows/create-remote-angular.md) | Create per framework, dev mode, zero-downtime, multi-domain, protection |
| [Reference](./docs/reference/environment.md) | Env vars, config, HTTP API, WebSocket messages, security, troubleshooting |
| [Compare](./docs/compare/compare-module-federation.md) | vs Module Federation, single-spa, Bit, Nx monorepo |
| [Internals](./docs/internals/nexus-gateway/architecture.md) | Per-service module layout and code maps — for contributors changing the Rust services |

---

## Running the docs locally

```bash
npm install --legacy-peer-deps
npm run docs:start
# → http://localhost:3000
```

`npm run docs:build` produces the static site under `build/`. Search is local (no Algolia signup required) and Mermaid diagrams render in-page.

---

## GitHub Pages deployment

The site is built and deployed automatically by `.github/workflows/deploy-docs.yml`:

1. Enable Pages on the repo: **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` — the workflow builds Docusaurus and deploys.

The workflow auto-detects the GitHub org and repo name, so no config edit is needed if you fork or rename.

---

## About

Nexus is created by **Steffen Vitten Pedersen** ([svp@bimo.dk](mailto:svp@bimo.dk)) and developed inside **Bimo**. Built to give multi-team products an honest path to micro frontends — across Angular, Vue, and React, with no proprietary runtime, no SaaS dependency, no lock-in.

## License

**GNU Affero General Public License v3.0 or any later version** (AGPL-3.0-or-later) — see [LICENSE](./LICENSE).

A commercial license is available for organisations that cannot adopt AGPL. See [nexus.bimo.dk/commercial-license](https://nexus.bimo.dk/commercial-license) or contact [svp@bimo.dk](mailto:svp@bimo.dk).
