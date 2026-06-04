---
id: overview
title: Overview
sidebar_position: 2
---

# What is Bimo-Nexus

Bimo-Nexus is an opinionated production stack on top of **Native Federation** (the build-system-agnostic successor to Webpack Module Federation). It bundles everything you need to run a multi-team Angular micro frontend in production:

- A **gateway** that is the only port the public sees.
- A **host** layout-shell that mounts remotes at runtime.
- A **registry** that decides which remotes are mounted, with WebSocket broadcast on change.
- A **portal** admin UI for adding, toggling and inspecting remotes.
- A **dev-proxy** that lets you run one remote locally against staging.
- A polished **CLI** (`bnx`) and a set of reusable packages.

## Mental model — three runtime trust zones

```
PUBLIC                       INTERNAL                    DEV-ONLY
=================            =================           =================
:8668  gateway   ──────► host, remote, registry         (your laptop)
:8669  portal   ──────►   registry HTTP + WS            :9000 dev proxy
                                                        :86xx local remote
```

- Public ports are the **only** ones bound on the docker host (`gateway`, `portal`).
- All upstream services (`registry`, `host`, `remote-*`) are reached via Docker's internal network — never exposed.
- The token (`X-Nexus-Token`) protects every write/read endpoint on the registry; only `/health` is public.

## How gateway discovers remotes

When gateway starts it fetches the full remote list from the registry and generates its nginx proxy routes. From that point it subscribes to the registry WebSocket — the same `/ws` the host uses. When a remote is added, toggled or removed, the registry broadcasts `remotes_changed`. Gateway regenerates its routes and calls `nginx -s reload`. No container restart, no config file to edit.

## Repository layout (multi-repo)

Nexus is intentionally multi-repo so each piece has an independent lifecycle:

| Repo | Owner | Released as | Public? |
|---|---|---|---|
| `nexus` | platform | Docker compose orchestrator | private |
| `nexus-gateway` | platform | `ghcr.io/bimo-dk/nexus-gateway` Docker image | yes |
| `nexus-host-template` | platform | `ghcr.io/bimo-dk/nexus-host` Docker image | yes |
| `nexus-portal` | platform | `ghcr.io/bimo-dk/nexus-portal` Docker image | yes |
| `nexus-registry` | platform | `ghcr.io/bimo-dk/nexus-registry` Docker image | yes |
| `nexus-remote-templat` | platform | scaffold via `bnx generate remote` | yes |
| `nexus-proxy` | platform | dev-time `npm` script | yes |
| `nexus-base-image` | platform | `ghcr.io/bimo-dk/nexus-base` Docker image | yes |
| `nexus-packages` | platform | npm `@bimo-dk/nexus-*` × 7 | yes |
| `nexus-example` | platform | demo orchestrator | yes |

A product team creates **one repo per remote**, scaffolded from `nexus-remote-templat`.

## What you do NOT have to do

- Hand-edit `federation.config.json` — `@bimo-dk/nexus-build` generates it from decorators.
- Stand up your own WebSocket transport — `RegistryWebSocket` is shipped.
- Reinvent the host layout — bootstrap with `provideNexusHost(...)`.
- Wire up auth headers/correlation IDs — interceptors are bundled in `@bimo-dk/nexus-runtime`.
- Restart anything to deploy a remote update — gateway, host and registry are unaware of remote container restarts.
- Hand-edit nginx config to add a new remote — gateway discovers remotes from the registry automatically and reloads routing without downtime.
- Set environment variables listing your remotes — name your Docker services whatever you want; the remote announces itself to the registry at startup.

Read on with [installation](installation.md).
