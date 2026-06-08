---
id: compare-single-spa
title: Nexus vs single-spa
sidebar_position: 2
description: Honest comparison. single-spa is the original micro frontend orchestration library. Nexus is the platform that includes the runtime infrastructure single-spa expects you to bring.
keywords:
  - single-spa alternative
  - micro frontend comparison
  - single-spa vs Nexus
  - frontend orchestration
---

# Nexus vs single-spa

## What single-spa does well

[single-spa](https://single-spa.js.org/) is the OG micro frontend library — it predates Module Federation and pioneered the idea of mounting independent applications under one shell. It's mature, framework-agnostic, and well-documented.

single-spa is excellent at:

- **Framework diversity.** Out of the box: React, Vue, Angular, Svelte, Web Components, and more. Each app keeps its own framework runtime.
- **Lifecycle hooks.** `bootstrap`, `mount`, `unmount`, `update` — explicit and inspectable.
- **Import-map-based loading.** No bundler dependency. The orchestrator loads ES modules from URLs you list.
- **Mature community.** Years of production use, a stable API.

If your goal is "mount three independent SPAs on the same page and let them coexist," single-spa is a battle-tested choice.

## What single-spa does not do

single-spa is a *library*, not a platform. It does not give you:

| You need | single-spa provides | Nexus provides |
|---|---|---|
| Where do modules live? | Import map you maintain | Registry with API + WebSocket |
| Add a module without app rebuild | Edit import map, redeploy | POST /api/remotes — host updates live |
| Reverse proxy / public surface | DIY (nginx, Caddy) | Rust gateway with hot route swap |
| Admin UI to add/toggle modules | DIY | Portal with hosts, gates, remotes |
| DDoS protection | DIY | Seven layers built into gateway |
| Multi-domain routing | DIY | Gates |
| Cross-team component discovery | DIY | Catalog populated automatically |
| Local dev for one team | DIY | `bnx dev` proxy |
| Health checks + metrics | DIY | Built into the registry and gateway |

## The mental model difference

```
single-spa:    "library that orchestrates apps you bring"
Nexus:         "platform that includes the runtime infrastructure"
```

A single-spa adoption typically looks like:

1. Choose a root config (manual).
2. Set up an import map server (manual).
3. Build each application with single-spa adapters.
4. Wire up routing rules in the root config.
5. Build a deployment pipeline that updates the import map.
6. Build an admin UI to manage which modules are active.
7. Build a dev proxy for local development.

Steps 1–4 are similar between Nexus and single-spa. Steps 5–7 are *what Nexus already is*.

## The honest tradeoffs

### Where single-spa wins

- **More framework adapters.** If you ship Svelte or Solid alongside Angular, single-spa has direct adapters today. (Nexus's `runtime-core` makes Svelte/Solid adapters straightforward to add — but they're not shipped yet.)
- **More mature.** single-spa has been in production at large companies for years.
- **Smaller starting footprint.** No Rust services to run.

### Where Nexus wins

- **You don't build the import-map server.** The registry is it, plus an admin UI, plus protection, plus metrics.
- **Hot route swap.** No need to redeploy a root config to add a module.
- **Multi-domain.** Gates are a real entity, not a routing-rule convention.
- **Cross-team catalog out of the box.**
- **Dev story.** `bnx dev` for free.

### When to choose what

Choose single-spa if:

- You ship four or more frameworks today, including ones Nexus doesn't have adapters for.
- You already have platform tooling (CI, admin UIs, monitoring) you want to keep and just need orchestration.
- You prefer a library you can drop in.

Choose Nexus if:

- You want the platform layer included.
- Your stack is Angular, Vue, and/or React.
- You want hot route swapping without redeploys.
- You want one admin UI for the whole frontend estate.

## Coexistence

The two can coexist. A single-spa root config can load a remote that's registered with Nexus (the import URL is just the gateway's `/remotes/<name>/remoteEntry.json`). Useful during migration from single-spa to Nexus.

## Summary

|  | single-spa | Nexus |
|---|---|---|
| Type | library | platform |
| Frameworks shipped | many | Angular, Vue, React |
| Registry / import map | DIY | Rust registry included |
| Admin UI | DIY | Portal included |
| Gateway / proxy | DIY | Rust gateway included |
| Multi-domain | DIY | Gates |
| Protection | DIY | seven layers |
| Dev mode | DIY | `bnx dev` |
| Catalog | DIY | `@NexusComponent` |
| Vendor lock-in | none | none (AGPL-3.0 + commercial option) |

## Next

- [Quick start: Angular](../getting-started/quick-start-angular.md)
- [Compare: Bit](compare-bit.md)
- [Compare: Nx monorepo](compare-nx-monorepo.md)
