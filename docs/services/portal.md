---
id: portal
title: nexus-portal
sidebar_position: 3
description: The nexus-portal repository — Angular 19 admin UI for Nexus. Build, run, configure, deploy.
keywords:
  - micro frontend portal
  - nexus-portal
  - Angular admin
  - admin dashboard
---

# nexus-portal

The `nexus-portal` repository ships the Angular 19 admin application. This page is the per-repo build / run / deploy reference. For the page-by-page tour, see [Infra: portal](../infrastructure/infra-portal.md).

## Repository layout

```
nexus-portal/
├── src/
│   ├── app/             # standalone components
│   ├── styles/          # SCSS, theme tokens
│   ├── main.ts
│   └── index.html
├── angular.json
├── package.json
├── Dockerfile           # build + nginx final stage
├── nginx.conf
├── docker-entrypoint.sh # substitutes runtime config
└── .npmrc
```

## Build

```bash
cd nexus-portal
npm install
npm run build
```

Equivalent for pnpm: `pnpm install && pnpm build`. For yarn: `yarn && yarn build`.

Docker:

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t ghcr.io/bimo-dk/nexus-portal:dev .
```

## Run

```bash
docker run --rm -p 8669:80 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e REGISTRY_URL=http://registry:8670 \
  --network nexus_default \
  ghcr.io/bimo-dk/nexus-portal:dev
```

The portal serves over nginx and is configured at startup by `docker-entrypoint.sh`, which substitutes `NEXUS_TOKEN`, `REGISTRY_URL`, and `WS_URL` into `assets/config.json` before nginx starts.

| Env var | Purpose |
|---|---|
| `NEXUS_TOKEN` | optional default — user can override in the UI |
| `REGISTRY_URL` | base URL the portal talks to (default `/api`) |
| `WS_URL` | WebSocket URL (default `/ws`) |

In a normal deployment, the gateway proxies `/api` and `/ws` to the registry, so the portal just calls relative URLs.

## Health

The portal serves a static SPA. The container's healthcheck hits nginx's own status:

```bash
curl http://localhost:8669/
```

## Dev mode

```bash
npm run start
# vite-style dev server on port 8669 with HMR
```

Set `VITE_REGISTRY_URL=http://localhost:8670` to point at a local registry.

## Theming

The portal supports light and dark themes. The default is `system` (respects `prefers-color-scheme`); a manual toggle persists to `localStorage`. Theme tokens live in `src/styles/` and follow the same palette as the docs site.

## Deploy

```yaml
portal:
  image: ghcr.io/bimo-dk/nexus-portal:1.0
  environment:
    REGISTRY_URL: /api
    WS_URL: /ws
  ports:
    - "8669:80"
  restart: unless-stopped
```

Behind the gateway, set `REGISTRY_URL` and `WS_URL` to relative paths so all browser traffic stays on the same origin.

## Next

- [Infra: portal](../infrastructure/infra-portal.md) — every page.
- [Packages: nexus-ui](../packages/nexus-ui.md) — shared components.
- [Reference: api-reference](../reference/api-reference.md) — endpoints the portal calls.
