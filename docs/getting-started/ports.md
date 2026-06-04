---
id: ports
title: Ports & URLs
sidebar_position: 5
description: Port assignments for all Nexus services in production and dev mode. URL contract behind the gateway — which prefix routes to which service, and why the cache rules matter for zero-downtime deploys.
---

# Ports & URLs

## Production stack (docker-compose.yml)

| Service | Container port | Host port | Visible to browser? |
|---|---|---|---|
| `gateway` | 80 | **8668** | yes — the public entry |
| `portal` | 80 | **8669** | yes — admin |
| `registry` | 3000 | — | no |
| `host` | 80 | — | no |
| `remote-*` | 80 | — | no |

Remotes in the NexusShop example: `remote-catalog`, `remote-cart`, `remote-product`, `remote-checkout`, `remote-account`.

The browser only ever talks to `:8668` (app) and `:8669` (admin). Everything else is reached via gateway's reverse proxy.

## Dev stack (docker-compose.dev.yml)

The dev compose file only starts `registry`, but exposes it on `:3000` for direct CLI access while you run Angular dev servers on your host:

| Service | Host port |
|---|---|
| `registry` | 3000 |

The Angular dev-server ports below are not in compose; they are started by `npm start` in each repo's checkout. They are the conventional ports the templates use:

| Repo | `npm start` port |
|---|---|
| `nexus-gateway` | 8668 |
| `nexus-host-template` | 8667 |
| `nexus-portal` | 8669 |
| `nexus-remote-templat` | 8700 (placeholder — pick per remote) |
| Example `remote-catalog` | 8701 |
| Example `remote-cart` | 8702 |
| Example `remote-product` | 8703 |
| Example `remote-checkout` | 8704 |
| Example `remote-account` | 8705 |
| `nexus-proxy` (dev proxy) | 9000 |

## URL contract behind the gateway

These are the URL prefixes the gateway exposes. **Browser code must use these exactly** — host, portal and remotes never reference the upstream container names.

| URL prefix | Routed to | Cache policy |
|---|---|---|
| `/api/*` | `registry:3000/api/*` | passthrough |
| `/ws` | `registry:3000/ws` (websocket upgrade) | long-lived |
| `/host/*` | `host:80/*` (prefix stripped) | per remoteEntry rules |
| `/remotes/catalog/*` | `remote-catalog:80/*` | per remoteEntry rules |
| `/remotes/cart/*` | `remote-cart:80/*` | per remoteEntry rules |
| `/remotes/<name>/*` | the remote's `UPSTREAM_URL` (from registry) | per remoteEntry rules |
| `*remoteEntry.{js,json}` | local SPA assets | `no-store` |
| `*chunk-*.js` | local SPA assets | `no-store` |
| Other `.css/.js/.woff2/...` | local SPA assets | `immutable, max-age=31536000` |
| Everything else | `index.html` (SPA fallback) | default |

This contract is enforced in [`nexus-gateway/nginx.conf`](../services/gateway.md#nginx-configuration).

## Why the cache rules matter

Native Federation works by reading `remoteEntry.json` at runtime. If the browser caches a stale entry, it will continue to load the *old* chunks. `no-store` on `remoteEntry.json` and `chunk-*.js` means a deploy is visible the instant a tab is opened — no SW cache busting, no version pinning, no manual reload.

Everything else (regular Angular bundles for the gateway's own SPA) is content-hashed by Angular's build, so it can be cached for a year.
