---
id: productivity
title: Productivity and time-to-market
sidebar_position: 2
description: A grounded view of what Nexus saves a multi-team frontend organization. Concrete line counts from the platform repos, sprint-level reclaim per team, and end-to-end time-to-first-production-remote.
keywords:
  - micro frontend productivity
  - micro frontend time to market
  - platform engineering ROI
  - micro frontend framework
  - multi-team frontend
---

# Productivity and time-to-market

This page is the case the CTO needs to read. The numbers are grounded in actual repo content — not vendor copy — so you can verify each row against the source.

## What a tenant team writes vs. what the platform provides

The platform repos are the work your teams do not do. Counted from the workspace as of this release:

| Surface | Owner | Code size |
|---|---|---|
| Angular remote scaffold (`nexus-remote-templat/src/`) | Tenant team starts here | **97 lines** of TypeScript + HTML across 8 files |
| Framework-agnostic federation loader (`@bimo-dk/nexus-runtime-core`) | Platform | 453 lines |
| Type contracts + validators (`@bimo-dk/nexus-core`) | Platform | 467 lines |
| Rust registry — source of truth, WebSocket, multi-DB, config store | Platform | **9 479 lines** |
| Rust gateway — hot-swap routing, framework SPA, 7-layer protection | Platform | **3 044 lines** |
| Angular / Vue / React framework adapters | Platform | ~1 200 lines each |
| `bnx` CLI — 7 command groups (`dev`, `generate`, `publish`, `status`, `health`, `hosts`, `gates`) | Platform | own repo |

A tenant team starts with 97 lines of scaffolded code, replaces three of them with their own component, and ships. The 12 500+ lines of registry, gateway, runtime-core, types, framework adapters and CLI are the work the platform team already did once on everyone's behalf.

## Per-task time, before vs. with Nexus

Honest estimates from a multi-team adoption. Direction and order of magnitude are what matter — your team will land somewhere on the line.

| Task | Without a platform | With Nexus | Saving |
|---|---|---|---|
| Scaffold a new remote (decisions + boilerplate) | ~1 day | `bnx generate remote` → ~10 minutes | ~95% |
| Wire that remote into a host | ~0.5 day (federation config, types, deploy) | 0 (self-registration on container boot) | 100% |
| Add a public domain pointing at the existing app | ~3 days (DNS + nginx vhost + pipeline + brand assets) | ~5 minutes (portal → new gate) | ~99% |
| Roll out a UI feature flag across teams | sprint coordination | one config push in the registry, hot-applied | days → minutes |
| Recover from a bad routing change | hours (find the diff, redeploy) | `POST /api/remotes/<name>/rollback { "version": N }` — see [rollback workflow](../workflows/rollback.md) | hours → seconds |
| Move a gate from shell A to shell B (test new chrome) | parallel environment + DNS swap | one PUT to the gate, see [host-swap workflow](../workflows/gate-host-swap.md) | days → seconds |
| First cross-team component reuse | sprint-scale (library, versioning, types) | hours (`@NexusComponent()` + `<nexus-component>`) | weeks → hours |
| Survive a 30-second registry blip | per-team retry / cache code | three-layer fallback chain shipped in the runtime | written once at the platform, never written by teams |
| Local dev against shared backend | custom devserver, mocked registry | `bnx dev` | hours of setup → one command |

## Sprint-level reclaim per team

The platform-related work that goes away for a typical product team:

| Sprint activity that disappears | Hours / sprint / team |
|---|---|
| Federation config maintenance (webpack / vite federation plugin tuning) | 4–8 h |
| nginx or ingress changes when a new remote ships | 2–6 h |
| Custom retry + fallback logic per remote consumer | 2–4 h |
| Token plumbing, refresh, and propagation | 2–4 h |
| Cross-team contract negotiation for shared UI components | 4–12 h |
| Manual deploy choreography (host restart timed against remote ship) | 2–6 h |
| **Total reclaimed per team per sprint** | **~16–40 h** |

For a 6-team organization that is **~100–240 engineering hours per sprint** redirected from platform plumbing to product features. At the low end of that range a single platform-engineer slot running Nexus pays for itself several times over per quarter.

## Time-to-first-production-remote

Concretely — a tenant team that has Nexus already running in their environment can ship a new remote into production in **half a day**:

```
T+0       bnx generate remote checkout    (CLI prompts for name, route, framework)
T+10m     cd checkout, npm install
T+30m     replace the scaffolded entry.component with the real component
T+1h      docker build + push to your registry
T+1.5h    container boots, self-registers, appears in the portal
T+2h      @NexusComponent() tag the exposed component, regenerate
T+2.5h    other teams discover it in the portal catalog
T+4h      merged, deployed to prod
```

The same workflow without a platform layer typically takes **one to two weeks** the first time: a federation manifest, a host wire-up, an nginx or ingress change, registry-of-truth discussion, fallback logic written from scratch, monitoring hookups, deploy-order coordination. Nexus collapses each of those into either zero work or one CLI command.

## Where the savings come from architecturally

Three platform decisions drive the productivity numbers:

1. **The registry as source of truth.** Every host, gate, remote, and runtime configuration value lives in one durable place. Adding, moving, or rolling back any of them is one API call — never a multi-system coordination.
2. **Self-registration on container boot.** A remote does not need its host to know about it ahead of time. Container starts → POSTs to the registry → registry broadcasts → host and gateway adopt the change live. No deploy choreography.
3. **Cluster-shape from day one.** Gateway is stateless and horizontal; registry runs on Postgres / MySQL / MariaDB for multi-replica deployments. The HA story is not a future migration — it is the default deployment shape. See [infra-high-availability](../infrastructure/infra-high-availability.md).

## What does not get faster

Honest about what Nexus is *not*:

- Writing the business logic in your remote. That is yours, and Nexus does not write it for you.
- Designing your shared component contracts. Nexus makes them embeddable, not designed.
- Replacing your code review or your CI pipeline. Nexus integrates into them, it does not replace them.

The savings are in the platform-plumbing surface. Use the reclaimed time on the product surface.

## Next

- [Installation](installation.md) — `docker compose up` in five minutes.
- [Quick start: Angular](quick-start-angular.md) / [Vue](quick-start-vue.md) / [React](quick-start-react.md) — five-minute path to a running remote.
- [Workflows: rollback](../workflows/rollback.md) and [host-swap](../workflows/gate-host-swap.md) — the operational moves that turn into one API call.
- [Infra: high availability](../infrastructure/infra-high-availability.md) — the cluster shape that makes the productivity numbers durable.
