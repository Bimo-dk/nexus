---
id: why-nexus
title: Why Nexus
sidebar_position: 1
---

# Why Nexus

Plain [Native Federation](https://www.npmjs.com/package/@angular-architects/native-federation) gives you ESM module sharing between Angular apps. It does **not** give you:

- A registry that the host can poll/subscribe to
- A way to add or remove remotes without a host rebuild
- A working local dev story for one-team-at-a-time
- A token-aware HTTP client + WS reconnect logic
- An admin UI for ops
- A discoverable cross-remote component catalog
- A zero-downtime deploy story baked into the cache layer
- A fallback chain when the registry is unreachable

Nexus is the layer that turns Native Federation into a product you can hand to a multi-team org without each team rebuilding the same plumbing.

---

## What you do NOT have to do

| You don't write | Because Nexus provides |
|---|---|
| `federation.config.json` by hand | `@NexusRemote()` + `nexus-build` CLI generates it |
| Registry sync code in the host | `provideNexusHost({...})` does it in one provider |
| WebSocket reconnect with backoff | `RegistryWebSocketService` ships with exponential backoff |
| Token-injecting HTTP interceptor | `nexusAuthInterceptor` is bundled in `provideNexusHost/Remote` |
| Per-request correlation ID | `correlationIdInterceptor` issues UUID v4 per request, registry logs it |
| Static-backup fallback when registry is down | Three-layer chain (live → cache → static) wired in `RegistryService` |
| `loadRemoteModule()` glue + cache + error UI | `<nexus-component>` tag |
| Route-based federation lazy-load | `nexusRoute({ path, remote, expose })` |
| Catalog UI ("what components exist?") | `@NexusComponent({...})` + portal `/catalog` page |
| Health-check loop + metrics endpoint | Registry's `/api/system/{health,metrics,logs}` |

---

## What it costs you

Honest tradeoffs:

- **You buy into the Angular 19 + Native Federation stack.** Nexus does not abstract the federation layer — it codifies it. A future major bump on `@angular/core` requires a coordinated upgrade across host + remotes (same as without Nexus, but more services to touch).
- **`@bimo-dk/*` packages live on GitHub Packages**, not the public npm registry. Every consuming repo needs `.npmrc` + a PAT with `read:packages`. The Dockerfiles use BuildKit secrets to keep this clean — see [security](../reference/security.md).
- **The token model is symmetric.** Anyone with `NEXUS_TOKEN` can mutate the registry. A per-user identity model is on the roadmap; for now, treat the token like a database password.
- **The gateway is the choke point.** Restarting it is a few seconds of "Connection refused" — fine for staging, plan blue/green for prod. Everything else (remotes, host, registry) is zero-downtime.

---

## A multi-team workflow, end to end

```
┌────────────────────────┐
│ Team A (checkout)      │  pushes to ghcr.io/teamA/checkout:1.4.2
│ owns: checkout repo    │     │
└────────────────────────┘     │ CI deploys to staging
                               ▼
                       docker compose pull checkout
                       docker compose up -d --no-deps checkout
                               │
                               │ container boots
                               │ provideNexusRemote(...) calls
                               │ POST /api/remotes (or PUT if existing)
                               ▼
                       registry persists, writes broadcast
                               │
                               │ WebSocket "remotes_changed"
                               ▼
                       host (in every open browser tab)
                       registers the new route
                               │
                               ▼
                       next user navigation hits new bundle
                       (cache: no-store on remoteEntry.json)
```

**No host restart. No registry restart. No gateway restart. No user reload.**

Team B sees Team A's component in the portal's catalog the moment Team A's container starts — because `catalog.json` is published next to `remoteEntry.json`. Team B can drop it into their own remote with:

```html
<nexus-component remote="checkout" expose="CartSummary" [inputs]="{ compact: true }" />
```

---

## Compared with alternatives

| | Nexus | Plain Native Federation | Single Webpack Module Federation | Build-time monorepo |
|---|---|---|---|---|
| Independent deploys | ✓ | ✓ | partial (host rebuild often needed) | ✗ |
| Runtime add/remove of remotes | ✓ (registry + WS) | ✗ | partial | ✗ |
| Zero-downtime cache strategy | ✓ (nginx `no-store` baked in) | DIY | DIY | n/a |
| Cross-team component discovery | ✓ (catalog) | ✗ | ✗ | ✓ (in-repo) |
| Local dev (one remote, rest staging) | ✓ (`bnx dev`) | DIY | very painful | n/a |
| Admin UI | ✓ (portal) | ✗ | ✗ | n/a |
| Vendor lock-in | none (MIT, all-open) | none | webpack | none |

---

## Adoption shape

A typical adoption is incremental:

1. **Week 1 — stand up the orchestrator.** Run `docker compose up` from the `nexus` repo. Existing apps are not touched yet.
2. **Week 2 — first remote.** One team scaffolds with `bnx generate remote`, deploys, registers. The portal shows it.
3. **Month 2 — convert the layout shell.** Existing monolith's outer chrome becomes the host. Inner pages move to remotes one at a time.
4. **Month 3+ — catalog adoption.** Teams add `@NexusComponent()` to components they think other teams might want. The catalog populates organically; cross-team reuse becomes possible.

You do not have to go all-in on day one. The registry happily serves a single remote.

---

## Next

- [Installation](installation.md) — `docker compose up --build`, five minutes.
- [Architecture deep dive](architecture.md) — every box, every arrow.
- [Component catalog](../workflows/component-catalog.md) — what unlocks once you tag components.
