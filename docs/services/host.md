---
id: host
title: Host templates
sidebar_position: 4
description: The nexus-host-template (Angular) and nexus-host-template-vue repositories. Build, run, configure, and customize a Nexus host shell.
keywords:
  - micro frontend host
  - nexus host template
  - Angular host
  - Vue host
  - host shell
---

# Host templates

Two host templates ship today; a React host template is on the roadmap. Both are reference implementations — clone, rename, ship.

| Template | Repo | Framework |
|---|---|---|
| Angular host | `nexus-host-template` | Angular 19 |
| Vue host | `nexus-host-template-vue` | Vue 3 |
| React host | (use the React quick start to bootstrap manually) | React 18 |

For the depth-first guides, see [Angular host](../guides/guide-angular-host.md), [Vue host](../guides/guide-vue-host.md), and [React host](../guides/guide-react-host.md).

## Angular host (`nexus-host-template`)

```
nexus-host-template/
├── src/
│   ├── app/
│   │   ├── app.shell.ts
│   │   ├── routes.ts
│   │   └── ...
│   ├── main.ts
│   └── index.html
├── federation.config.js
├── angular.json
├── package.json
├── Dockerfile
├── nginx.conf
├── docker-entrypoint.sh
└── .npmrc
```

### Build

```bash
npm install
npm run build
```

### Run via Docker

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t my-host .
docker run --rm -p 8667:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  my-host
```

### Customize

Add your nav, pages, and any non-remote routes in `src/app/`. Federation is wired through `provideNexusHost()` in `main.ts`; routes are added with `nexusRoute()` in `routes.ts`. You should not need to touch `federation.config.js` unless you want to *expose* something from the host itself.

## Vue host (`nexus-host-template-vue`)

```
nexus-host-template-vue/
├── src/
│   ├── App.vue
│   ├── Dashboard.vue
│   ├── nexus.ts        # registry wiring
│   ├── main.ts
│   └── env.d.ts
├── vite.config.ts
├── package.json
├── Dockerfile
├── nginx.conf
├── docker-entrypoint.sh
└── .npmrc
```

### Build

```bash
npm install
npm run build
```

### Run via Docker

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t my-host-vue .
docker run --rm -p 8667:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  my-host-vue
```

### Customize

`src/nexus.ts` wires the host to the registry using `RegistryClient` and `RegistryWebSocket` from `@bimo-dk/nexus-client`, plus `loadRemoteModule` from `@softarc/native-federation-runtime`. Edit `App.vue` and your pages; `nexus.ts` should stay as-is unless you want different fallback behavior.

## Environment variables

Both templates honor:

| Env var | Default | Purpose |
|---|---|---|
| `REGISTRY_INTERNAL_URL` | `http://registry:8670` | how the host reaches the registry from inside the network |
| `NEXUS_TOKEN` | — | required for any registry call |
| `STATIC_BACKUP_URL` | `/assets/registry-backup.json` | fallback if registry is unreachable |
| `WS_URL` | `/ws` | WebSocket path |

## Host registration

When the host container starts, it registers itself with the registry (the Angular host via `provideNexusHost(... selfRegister: true)` and the Vue host via the bootstrap in `nexus.ts`). Provide:

```yaml
environment:
  HOST_NAME: storefront
  HOST_FRAMEWORK: angular
  HOST_PUBLIC_URL: http://host:80
  HOST_REMOTE_ENTRY: /remoteEntry.json
  HOST_EXPOSED_MODULE: ./AppShell
```

You can also register hosts manually in the portal or via `bnx hosts create`.

## Next

- [Quick start: Angular](../getting-started/quick-start-angular.md)
- [Quick start: Vue](../getting-started/quick-start-vue.md)
- [Quick start: React](../getting-started/quick-start-react.md)
- [Guide: mixed-stack](../guides/guide-mixed-stack.md)
