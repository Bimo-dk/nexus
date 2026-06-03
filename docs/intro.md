---
id: intro
title: Nexus
slug: /
sidebar_position: 1
---

# Bimo-Nexus

**Bimo-Nexus** is an Angular 19 micro frontend platform built on top of [Native Federation](https://www.npmjs.com/package/@angular-architects/native-federation). It gives a complete production stack — gateway, host shell, registry, admin portal, dev proxy and a polished package ecosystem — so a team can ship independent remotes with zero downtime.

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
                |   portal    |  :8669  (admin UI)
                +-------------+
```

## What's in the platform

| Piece | What it is | Where it lives |
|---|---|---|
| **Gateway** | Public entry point, nginx reverse-proxy + minimal Angular shell | [`nexus-gateway`](services/gateway.md) |
| **Host** | Layout shell that federates remotes at runtime | [`nexus-host-template`](services/host.md) |
| **Registry** | Source of truth for the remote configuration — Node/Express + WebSocket broadcast | [`nexus-registry`](services/registry.md) |
| **Portal** | Admin Angular app: dashboard, system metrics, remote CRUD | [`nexus-portal`](services/portal.md) |
| **Remote template** | Starter app cloned by `bnx generate remote` | [`nexus-remote-templat`](services/remotes.md) |
| **Dev proxy** | Local hot-reload proxy that lets you run one remote against staging | [`nexus-proxy`](services/proxy.md) |
| **Base image** | Shared Docker base for all services | [`nexus-base-image`](services/base-image.md) |
| **Packages** | 7 published `@bimo-dk/*` packages (core, client, build, runtime, ui, testing, cli) | [`nexus-packages`](packages/overview.md) |
| **Example** | Editable playground that composes the whole stack | [`nexus-example`](workflows/example-playground.md) |

## When you should use it

- You have one product that several teams contribute to.
- Teams must be able to ship their feature **independently** (own pipeline, own Docker image).
- The user should never see a deployment break — remotes are loaded by URL at runtime.
- A team can spin up locally and work on **only their remote** while everything else runs in shared staging.

## What's next

- [Setup & install](getting-started/installation.md) — get everything running locally.
- [Architecture deep dive](getting-started/architecture.md) — request flow, deploy flow, security model.
- [Create a new remote](workflows/create-remote.md) — end-to-end with `bnx`.
- [Packages overview](packages/overview.md) — what each `@bimo-dk/*` library does.
