---
id: compare-module-federation
title: Nexus vs Webpack Module Federation
sidebar_position: 1
description: Honest comparison. Webpack Module Federation pioneered runtime federation. Nexus adds the platform layer Module Federation was never trying to be.
keywords:
  - module federation alternative
  - Webpack Module Federation
  - micro frontend comparison
  - Angular Vue React micro frontend
---

# Nexus vs Webpack Module Federation

## What Module Federation does well

[Webpack Module Federation](https://webpack.js.org/concepts/module-federation/) introduced runtime ES module federation to the JavaScript ecosystem in 2020. It changed the conversation about micro frontends — for the first time, "share React/Angular/Vue across builds at runtime" was a practical option, not a research project.

Module Federation is excellent at:

- **Build-time configuration of remote exposes.** Your `webpack.config.js` declares what you ship and what you consume.
- **Shared singleton management.** React, Angular DI, design tokens — all shareable across builds.
- **Bundler integration.** Native to Webpack 5, with an Rspack port and Vite plugins.
- **Vendor diversity.** No single owner. The spec is open; multiple implementations.

If you have a single team that wants build-time federation between two apps that ship together, Module Federation is enough.

## What Module Federation does not do

Module Federation is a *bundler feature*, not a platform. It does not give you:

| You need | Module Federation provides | Nexus provides |
|---|---|---|
| Dynamic registry of remotes | Manual JSON file | Rust registry with REST + WS |
| Add a remote without host rebuild | Edit webpack config + rebuild | POST /api/remotes — host updates live |
| Runtime gateway / reverse proxy | DIY (nginx, Caddy, …) | Rust gateway with hot route swap |
| Admin UI | DIY | Portal with hosts, gates, remotes, protection |
| DDoS protection | DIY | Seven layers built into the gateway |
| Multi-domain via gates | DIY | First-class gate entity |
| Cross-team component catalog | DIY (Storybook deployment per team) | `@NexusComponent` + portal catalog |
| Local dev for one team | DIY | `bnx dev` proxy |
| Three frameworks first-class | Possible but per-team setup | Adapters shipped |
| Zero-downtime cache policy | DIY | Gateway enforces `no-store` on entries |
| Token-aware auth across services | DIY interceptors per app | Built into the adapters |
| Three-layer fallback for registry outages | DIY | Built into runtime-core |

If you adopt Module Federation, you still build all of the above. Most teams do — and the platform layer takes 6–12 months of work to get right.

## The honest tradeoffs

### Where Module Federation wins

- **Smaller scope to adopt.** You add a webpack plugin and ship.
- **No platform vendor lock-in.** Even though Nexus is MIT, you're adopting an opinionated layout (gates, hosts, remotes, three frameworks).
- **Granular shared module control.** Module Federation's `shared` config is more expressive than what Nexus exposes through the adapters today.

### Where Nexus wins

- **Operations.** You get a registry, a portal, protection, metrics, fallbacks, and zero-downtime deploys without writing them.
- **Multi-framework.** Angular, Vue, and React are equal citizens.
- **Hot route swap.** Add a remote in production without a single restart.
- **Multi-domain.** Gates are a real abstraction, not a custom proxy config.

### When to choose what

Choose Module Federation if:

- You have one team and one framework.
- You're comfortable building registry + admin + protection + dev tooling yourself.
- You need fine-grained control over the `shared` config beyond what Nexus exposes.

Choose Nexus if:

- You have multiple teams shipping independently.
- You want runtime add/remove of remotes without rebuilds.
- You want an admin UI out of the box.
- You operate across more than one framework.
- You don't want to build platform code that isn't your business.

## Federation underneath

Worth noting: Nexus uses [Native Federation](https://www.npmjs.com/package/@angular-architects/native-federation) for Angular and Vite-based federation for Vue/React, both of which are ESM-spec-aligned successors to Webpack Module Federation. The mechanism is the same — Nexus adds the layer above.

## Summary

|  | Module Federation | Nexus |
|---|---|---|
| Scope | bundler feature | platform |
| Frameworks | any (per-team setup) | Angular, Vue, React (built in) |
| Runtime registry | DIY | included (Rust) |
| Gateway | DIY | included (Rust) |
| Admin UI | DIY | included (Portal) |
| Protection | DIY | seven layers, hot-configurable |
| Cross-team catalog | DIY | included |
| Dev mode | DIY | `bnx dev` |
| Vendor lock-in | none | none (MIT) |

## Next

- [Quick start: Angular](../getting-started/quick-start-angular.md)
- [Quick start: Vue](../getting-started/quick-start-vue.md)
- [Quick start: React](../getting-started/quick-start-react.md)
- [Compare: single-spa](compare-single-spa.md)
