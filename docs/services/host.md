---
id: host
title: Host
sidebar_position: 4
---

# Host

Repo: [`nexus-host-template`](https://github.com/Bimo-dk/nexus-host-template) — Image: `ghcr.io/bimo-dk/nexus-host`

The **host** is the layout shell of the application. It is the only piece that knows what the global UI chrome looks like — header, sidebar, footer — and it federates remotes at runtime into its `<router-outlet>`.

## How the host bootstraps

```ts
// nexus-host-template/src/app/app.config.ts
import { provideNexusHost } from '@bimo-dk/nexus-runtime';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideNexusHost({
      configDefaults: {
        registryUrl: '/api',
        nexusToken: 'dev-token',
        staticBackupUrl: '/assets/registry-backup/remotes.json',
      },
    }),
  ],
};
```

`provideNexusHost(...)` from [`@bimo-dk/nexus-runtime`](../packages/nexus-runtime.md) bundles:

- `NEXUS_CONFIG` injection token (filled from `/assets/config.json` ⤴ `configDefaults`)
- `HttpClient` with `nexusAuthInterceptor` + `correlationIdInterceptor`
- `RegistryService` — HTTP client for `/api/remotes`
- `RegistryWebSocketService` — `/ws` connection with exponential reconnect
- `DynamicNexusService` — calls `loadRemoteModule()` for each remote and registers a route

You write **nothing** federation-specific yourself.

## What you see in the UI

`app.component.ts` is the layout the user sees once federation has loaded a remote:

- Top bar — brand, top-level nav, registry online/offline pill
- Sidebar — list of loaded remotes, click to navigate; "failed remotes" subsection if any
- Main — `<router-outlet>` where the remote renders
- Bottom bar — remote count

Health status next to each remote (green/yellow/red dot) is driven by `HealthService`, which reads the cached registry health snapshot every 10s.

## Reading host state from a remote

Once a remote is loaded inside the host, it can inject the same services:

```ts
import { inject } from '@angular/core';
import { DynamicNexusService, NEXUS_CONFIG } from '@bimo-dk/nexus-runtime';

@Component({ ... })
export class MyRemote {
  readonly nexus = inject(DynamicNexusService);
  readonly config = inject(NEXUS_CONFIG);

  // nexus.loadedRemotes()  - signal<RemoteConfig[]>
  // nexus.failedRemotes()  - signal<Map<string, string>>
  // nexus.registryOnline() - computed signal
}
```

## Fallback chain

When the host bootstraps, `RegistryService` tries three sources in order:

1. **Live registry** — `GET /api/remotes` with token
2. **Browser cache** — `sessionStorage["nexus.lastRemotes"]` (written on every successful fetch)
3. **Static backup file** — `staticBackupUrl` (typically `/assets/registry-backup/remotes.json` baked at build time)

If all three fail, the host shows the offline banner and renders the dashboard view only. The banner cites which source the data came from:

> ⚠ **Registry offline** — showing data from `cache` (cache or static backup). New remotes cannot be registered until the connection is restored.

## Federation config

`federation.config.js`:

```js
module.exports = withNativeFederation({
  name: 'host',
  exposes: { './AppShell': './src/app/app.component.ts' },
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],
});
```

The host exposes one module — its `AppShell` — which is what the gateway loads. Everything else is consumed.

## When to fork the template

The `nexus-host-template` repo is exactly what its name says — a template. You fork (or copy) it when you want to:

- Change the top-bar branding, sidebar layout or footer
- Add globally-shared UI like a help panel or theme switcher
- Bake in a static backup file that points at your prod remotes

The federation, registry and routing logic come from `@bimo-dk/nexus-runtime` and you should not touch them.

## Docker build

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
COPY package*.json .npmrc ./
RUN --mount=type=secret,id=node_auth_token,required=true \
    NODE_AUTH_TOKEN=$(cat /run/secrets/node_auth_token) \
    npm install --legacy-peer-deps

ARG NEXUS_TOKEN=dev-token-change-in-production
COPY tsconfig*.json angular.json federation.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build:prod

FROM nginx:alpine
COPY --from=builder /app/dist/host/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

Note the BuildKit secret for `NODE_AUTH_TOKEN` — required to fetch `@bimo-dk/*` from GitHub Packages. **Never** pass this token via `ARG` (it would persist in image layers).

## Healthcheck

```bash
GET http://localhost:8667/health
{"status":"ok","service":"host"}
```
