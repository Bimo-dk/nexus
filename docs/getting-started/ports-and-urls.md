---
id: ports-and-urls
title: Ports and URLs
sidebar_position: 5
description: Port assignments for every Nexus service in production and dev. The URL contract behind the gateway, the cache policy table, and how dev-server ports map to scaffolded remotes.
keywords:
  - micro frontend ports
  - micro frontend URL contract
  - micro frontend gateway
  - micro frontend cache strategy
  - zero downtime deployment
---

# Ports and URLs

## Production stack (docker-compose.yml)

| Service | Container port | Host port | Visible to browser |
|---|---|---|---|
| `gateway` | 8668 | **8668** | yes — the public entry |
| `portal` | 80 | **8669** | yes — admin |
| `registry` | 8670 | — | no |
| `host-*` | 80 | — | no |
| `remote-*` | 80 | — | no |

The browser only ever talks to `:8668` (application) and `:8669` (admin portal). Every other service is reached through the gateway's reverse proxy.

## Dev stack (docker-compose.dev.yml)

The dev compose file starts the registry (and optionally the portal) with their internal ports exposed to your host so you can run dev servers natively:

| Service | Host port |
|---|---|
| `registry` | 8670 |
| `portal` | 8669 |

Dev-server ports below are conventions used by the framework templates — they live in each template's `package.json` and `vite.config.ts`.

| Template | `npm run dev` port |
|---|---|
| `nexus-host-template` (Angular) | 8667 |
| `nexus-host-template-vue` (Vue) | 8667 |
| `nexus-portal` | 8669 |
| `nexus-remote-templat` (Angular) | 8700 |
| `nexus-remote-templat-vue` (Vue) | 8701 |
| `nexus-remote-templat-react` (React) | 8702 |
| `nexus-proxy` (dev hot-reload proxy) | 9000 |

When you scaffold a remote, override the port to avoid collisions with other remotes you might run concurrently.

## URL contract behind the gateway

These are the URL prefixes the gateway exposes. **Browser code must use them exactly.** Host, portal, and remotes never reference upstream container names.

| URL prefix | Routed to | Cache policy |
|---|---|---|
| `/api/*` | `registry:8670/api/*` | passthrough |
| `/ws` | `registry:8670/ws` (WebSocket upgrade) | long-lived |
| `/` | host upstream (gate-resolved) | per host rules |
| `/remotes/<name>/*` | remote upstream (looked up from registry) | per remote rules |
| `*remoteEntry.{js,json}` | upstream | `no-store` |
| `*chunk-*.js` | upstream | `no-store` |
| `*.css`, `*.woff2`, hashed bundles | upstream | `immutable, max-age=31536000` |

The gateway enforces the cache policy when the upstream does not set its own `Cache-Control`. If you serve `remoteEntry.json` with a real cache header upstream, the gateway preserves it.

## Multi-domain (gates)

A gateway can serve many gates. Routing is determined by the `Host` header.

| Gate (domain) | Resolves to host | Available remotes |
|---|---|---|
| `shop.example.com` | `storefront` (Angular) | catalog, orders, checkout, partners |
| `admin.example.com` | `admin` (Vue) | catalog, orders, users |
| `partner.example.com` | `storefront` (Angular) | catalog, orders, checkout, partners |

`shop.example.com` and `partner.example.com` share the same host application but are public surfaces under different brands. Add a per-gate response header to differentiate the rendered shell — that header is part of the gate config and is hot-applied.

Set up gates in [workflows: multi-domain-setup](../workflows/multi-domain-setup.md).

## Why the cache rules matter

Native Federation works by reading `remoteEntry.json` at runtime. If the browser caches a stale entry, it continues to load the old chunks even after a deploy. `no-store` on `remoteEntry.json` and `chunk-*.js` means a new deploy is visible the instant a tab is opened — no service-worker cache busting, no version pinning, no manual reload.

Everything else (the framework's hashed bundles) is content-addressed by its build pipeline, so it can be cached for a year.

## Next

- [Architecture](architecture.md) — what happens behind the cache policy.
- [Infra: gateway](../infrastructure/infra-gateway.md) — protection settings.
- [Workflows: multi-domain-setup](../workflows/multi-domain-setup.md) — add a gate.
