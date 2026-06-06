---
id: infra-portal
title: Portal
sidebar_position: 3
description: The Nexus portal — Angular 19 admin UI inspired by Datadog and Grafana. Manage hosts, gates, remotes, protection, and live configuration with dark and light theme.
keywords:
  - micro frontend admin
  - micro frontend portal
  - Angular admin UI
  - micro frontend dashboard
  - Datadog Grafana style
---

# Portal

The portal is the admin application for a Nexus platform instance. Everything that the registry stores is editable from this UI. Operators use it to add and remove micro frontends; developers use it to inspect health and rotate tokens; SREs use it to tune protection settings under load.

Code: `nexus-portal/`. Stack: Angular 19 standalone components and Angular Material on the browser side; Node 22 + Express + Knex + bcrypt on the BFF side, both shipped in the same container. The Angular bundle and the BFF live in the same repo and the same Docker image.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar           │ Top bar (registry status, theme, user)  │
│                   ├─────────────────────────────────────────┤
│ • Overview        │                                         │
│ • Hosts*          │            Active page                  │
│ • Gates*          │                                         │
│ • Remotes         │                                         │
│ • Catalog         │                                         │
│ • Protection*     │                                         │
│ • Config*         │                                         │
│ • Logs*           │                                         │
│ • System*         │                                         │
│ • Users*          │                                         │
└───────────────────┴─────────────────────────────────────────┘

`*` marks pages that only `admin` users can see.
```

The compact developer-oriented design follows the Datadog / Grafana aesthetic: dense rows, monospace numerals, small typography, sparklines where relevant, no chrome that isn't load-bearing.

## Pages

### Overview

A single-glance status board. Counts (hosts, gates, remotes), registry uptime, WebSocket client count, recent activity feed, top errors.

### Hosts

CRUD for shell applications. Create with name, URL, framework (angular / vue / react), `remoteEntry`, `exposedModule`. Each row shows the number of gates pointing to it. Delete is blocked while any gate references the host.

### Gates

CRUD for public entry points. A gate is `(name, domain, hostId, enabled)`. The portal validates that the domain is reachable from the gateway when you save.

### Remotes

CRUD for micro frontends. Each row shows visibility (`global` or `host:<id>`), enabled state, last health check, current `upstreamUrl`. Toggle a remote off and the gateway hot-removes its route in milliseconds; toggle it on and the route reappears.

### Catalog

Aggregated view of every `@NexusComponent` (Angular) or `catalog` entry (Vue/React `nexusVite`) across every registered remote. Filter by category, tag, framework, or input shape. Click an entry to copy the corresponding `<nexus-component>` or `useNexusComponent` snippet for your host's framework.

### Protection

Live operations dashboard for the gateway's seven protection layers.

- Sparkline of `requests_blocked_total` over the last hour.
- Active bans table with `unban` button.
- Top offenders ranked by violation count, with live HTTP and WS connection counts.
- Inline editors for every protection setting — every change PUTs to `/api/config/gateway/protection` and is hot-applied within milliseconds.

See [infra-protection](infra-protection.md) for the operations playbook.

### Config

Inline editors for the registry's runtime-configurable features:

- Rate limiting (registry's own ingress)
- WebSocket reconnect policy (broadcast to every client)
- Circuit breaker for health checks
- Graceful shutdown timings
- Prometheus metrics

Every change PUTs to `/api/config/*` and the registry validates server-side before applying. The page is admin-only.

### Logs

Live tail of the registry's ring-buffered log. Filter by level (`debug` / `info` / `warn` / `error`) and by since-timestamp. Stream is implemented over the WebSocket `log` channel.

### System

Read-only diagnostic view. Memory, uptime, DB pool stats, WebSocket client count, env-loaded configuration.

## Theming

Dark and light mode. The default is `system` (respects `prefers-color-scheme`), with a manual toggle in the top bar that persists to `localStorage`. The palette matches the docs site — deep blue-black surfaces, electric blue accent, neutral text.

## Authentication

The portal is gated by username/password login backed by a relational database. SQLite is the default (file at `/data/portal.db` in the container); set `DATABASE_URL` to a `postgres://`, `mysql://`, or `mariadb://` URL to use an external database instead. The BFF handles every credential — the browser holds only an httpOnly signed session cookie. The registry token (`NEXUS_TOKEN`) lives in the BFF's environment and is never sent to the browser.

### First-run

There are no default credentials. When the `users` table is empty, the portal will refuse to start unless `NEXUS_INITIAL_PASSWORD` is set. If set, it seeds an `admin` user with that password and forces a password change at first login. After that login, the env-var can be unset.

### Roles

Two built-in roles, stored in a `roles` table (so a third role is a data change, not a schema migration):

| Role | Can see | Can edit |
|---|---|---|
| `admin` | everything | everything |
| `developer` | Remotes (list + detail), Catalog | nothing — read-only |

Route guards (`authGuard`, `adminGuard`) hide non-developer pages from the developer's sidebar entirely. The BFF enforces the same rules server-side: a developer hitting a write endpoint gets `403`, even if the UI somehow allowed the call.

### Sessions

Login issues an httpOnly signed cookie (`nexus_session`, `SameSite=Lax`, `Secure` in production). The session row also lives in SQLite, so logout invalidates server-side and an admin can revoke a user's sessions by deleting them from the Users page. Session lifetime defaults to 12 hours, configurable via `SESSION_TTL_SECONDS`.

### Token rotation

The registry token is no longer something a user rotates from the UI. Update `NEXUS_TOKEN` in the portal container's environment and restart. Rotating the session signing secret (`SESSION_SECRET`) on restart invalidates all active sessions (planned logout-all model).

### Users page

Admin-only. Create users with username, temporary password, and role. Newly created users are forced to change password at first login. Reset password and delete actions live in the same table.

## Real-time updates

The portal opens a WebSocket to `/ws` on bootstrap. Every page that displays platform state subscribes to the relevant message types:

| Page | Subscribes to |
|---|---|
| Overview | all |
| Hosts | `host_changed` |
| Gates | `gate_changed` |
| Remotes | `remotes_changed`, `system_health` |
| Catalog | `remotes_changed` |
| Protection | `system_health`, gateway counters via polling |
| Logs | `log` |

This means a deploy that registers a remote shows up in your portal session within milliseconds — no refresh.

## Reading the code

- App shell: `nexus-portal/src/app/`.
- Service layer: shared via `@bimo-dk/nexus-runtime` and `@bimo-dk/nexus-client`.
- Theme tokens: `nexus-portal/src/styles/`.

## Next

- [Infra: protection](infra-protection.md) — what the Protection page operates.
- [Infra: registry](infra-registry.md) — the endpoints the portal calls.
- [Packages: nexus-ui](../packages/nexus-ui.md) — the shared components.
