---
id: portal
title: nexus-portal
sidebar_position: 3
description: The nexus-portal repository — Angular 19 admin UI with a Node/Express BFF for authentication, role-based access, and registry proxying.
keywords:
  - micro frontend portal
  - nexus-portal
  - Angular admin
  - admin dashboard
  - authentication
  - role-based access
---

# nexus-portal

The `nexus-portal` repository ships the Angular 19 admin application together with a small Node/Express backend (BFF) that handles authentication, role-based access control, and proxying to the registry. This page is the per-repo build / run / deploy reference. For the page-by-page tour, see [Infra: portal](../infrastructure/infra-portal.md).

## Repository layout

```
nexus-portal/
├── server/              # Express BFF (auth, users, registry proxy)
│   ├── index.ts
│   ├── auth.ts
│   ├── users.ts
│   ├── db.ts            # Knex schema + queries (SQLite, Postgres, MySQL, MariaDB)
│   ├── middleware.ts
│   ├── registry-proxy.ts
│   ├── federation-proxy.ts
│   └── static.ts
├── src/                 # Angular standalone app
│   ├── app/
│   ├── styles/
│   ├── main.ts
│   └── index.html
├── angular.json
├── tsconfig.server.json
├── package.json
├── Dockerfile           # multi-stage: builds Angular + server, runs Node
└── .npmrc
```

## Authentication and roles

The portal is gated by username/password login backed by a relational database. SQLite is the default (file at `/data/portal.db` inside the container); see the [Database](#database) section below to switch to PostgreSQL or MySQL/MariaDB. There are two built-in roles:

- **admin** — sees everything, can edit remotes/hosts/gates/settings, manages users.
- **developer** — sees the remote list and component catalog only, read-only.

The role list is a database table (`roles`), so adding a third role is a data change, not a schema migration.

### First-run

There are no default credentials. The portal will refuse to start against an empty `users` table unless `NEXUS_INITIAL_PASSWORD` is set; if set, it seeds an `admin` user with that password and forces a password change at first login. After that first login, `NEXUS_INITIAL_PASSWORD` is ignored and can be unset.

### Sessions

Login issues an httpOnly signed cookie (`nexus_session`, `SameSite=Lax`, `Secure` in production). The corresponding session row lives in the database, so logout invalidates server-side. The signing secret comes from `SESSION_SECRET`; rotating it invalidates all active sessions on next portal restart (planned logout-all model).

### Registry token

`NEXUS_TOKEN` is now strictly server-side. The browser never sees it. The BFF attaches `X-Nexus-Token` to every outbound registry request. Rotate by updating the env-var and restarting the portal container.

## Database

The portal's database stores users, roles, and sessions. Configure it with `DATABASE_URL`:

| Engine | URL format | Notes |
|---|---|---|
| SQLite (default) | `sqlite:/data/portal.db` | Mount a named volume at `/data` to persist across restarts. |
| PostgreSQL | `postgres://user:pass@host:5432/dbname` | Recommended for production multi-replica setups. |
| MySQL | `mysql://user:pass@host:3306/dbname` | |
| MariaDB | `mariadb://user:pass@host:3306/dbname` | |

Schema migrations run automatically on startup — there is nothing to run manually.

## Build

```bash
cd nexus-portal
npm install
npm run build
```

This produces both the Angular bundle (`dist/manager/browser`) and the compiled server (`dist/server`).

Docker:

```bash
docker build -t ghcr.io/bimo-dk/nexus-portal:dev .
```

The `@bimo-dk/*` packages are on public npmjs.com — no token or `.npmrc` auth is needed for the build.

## Run

```bash
docker run --rm -p 8669:80 \
  -v nexus-portal-data:/data \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e NEXUS_INITIAL_PASSWORD=changeme-on-first-login \
  -e REGISTRY_URL=http://registry:8670 \
  -e GATEWAY_URL=http://gateway:80 \
  --network nexus_default \
  ghcr.io/bimo-dk/nexus-portal:dev
```

| Env var | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | Cookie signing secret. Random ≥32 bytes. Rotating invalidates all sessions. |
| `NEXUS_TOKEN` | yes | Registry token used by the BFF when proxying. Never sent to the browser. |
| `NEXUS_INITIAL_PASSWORD` | first run only | Seed password for the initial admin user. Required when the `users` table is empty. |
| `DATABASE_URL` | no | Default `sqlite:/data/portal.db`. Accepts `postgres://`, `mysql://`, or `mariadb://` URLs. |
| `REGISTRY_URL` | no | Default `http://registry:8670`. |
| `GATEWAY_URL` | no | Default `http://gateway:80`. Used for federation asset proxying. |
| `SESSION_TTL_SECONDS` | no | Default 43200 (12 h). |
| `PORT`, `HOST` | no | Default 80 / 0.0.0.0. |

For SQLite, mount a named volume at `/data` so users and sessions survive container restarts. For Postgres or MySQL, point `DATABASE_URL` at your existing database instance.

## Health

```bash
curl http://localhost:8669/health
# {"status":"ok","service":"nexus-portal"}
```

The endpoint is unauthenticated by design — orchestrators, compose healthchecks, and `bnx health` all depend on it.

## Dev mode

```bash
npm install      # one-time — compiles bcrypt and native bindings
npm run dev      # boots BFF + Angular dev server in one terminal
```

`npm run dev` runs both processes under `concurrently` with safe dev defaults:

| Service | URL | Notes |
|---|---|---|
| Angular dev server | http://localhost:8669 | HMR, this is what you open in the browser |
| Express BFF | http://localhost:8080 | Proxied via `/api` from the Angular dev server |
| SQLite | `./.data/portal.db` | Auto-created on first run |

First login: `admin` / `devpass1`. The portal forces a password change immediately.

To start over (wipe users and sessions): `npm run dev:reset`.

Override any default via env-var before `npm run dev` — e.g. `NEXUS_INITIAL_PASSWORD=hunter2 npm run dev`.

The dev BFF connects to `http://127.0.0.1:8670` (registry) and `http://127.0.0.1:8668` (gateway). If those aren't running, the login flow still works (it only touches the database), but pages that depend on registry data will be empty until you boot the full stack via `nexus-test/start.ps1`.

## Deploy

The compose snippet in `nexus/docker-compose.yml`:

```yaml
portal:
  image: ghcr.io/bimo-dk/nexus-portal:1.0
  environment:
    NEXUS_TOKEN: ${NEXUS_TOKEN}
    SESSION_SECRET: ${PORTAL_SESSION_SECRET}
    NEXUS_INITIAL_PASSWORD: ${PORTAL_INITIAL_PASSWORD:-}
    DATABASE_URL: ${DATABASE_URL:-sqlite:/data/portal.db}
  volumes:
    - portal-data:/data
  ports:
    - "8669:80"
  restart: unless-stopped
```

## Next

- [Infra: portal](../infrastructure/infra-portal.md) — every page.
- [Packages: nexus-ui](../packages/nexus-ui.md) — shared components.
- [Reference: api-reference](../reference/api-reference.md) — endpoints the BFF calls upstream.
