---
id: nexus-runtime
title: '@bimo-dk/nexus-runtime'
sidebar_position: 5
description: Angular 19 adapter for Nexus. provideNexusHost, provideNexusRemote, nexusRoute, NexusComponent, ComponentLoaderService, CatalogService.
keywords:
  - nexus-runtime
  - Angular micro frontend
  - Angular 19
  - provideNexusHost
  - nexusRoute
---

# @bimo-dk/nexus-runtime

The Angular 19 adapter. Wraps `@bimo-dk/nexus-runtime-core` with Angular ergonomics: providers, DI tokens, interceptors, route helpers, and a drop-in `<nexus-component>` tag.

## Install

```bash
npm install @bimo-dk/nexus-runtime
# pnpm add @bimo-dk/nexus-runtime
# yarn add @bimo-dk/nexus-runtime
```

Peer dependencies: `@angular/core`, `@angular/common`, `@angular/router`, `@angular-architects/native-federation`, `rxjs`.

## Provider for a remote

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNexusRemote } from '@bimo-dk/nexus-runtime';
import RemoteEntry from './app/remote-entry/entry.component';

bootstrapApplication(RemoteEntry, {
  providers: [
    provideNexusRemote({
      entry: RemoteEntry,
      configDefaults: { registryUrl: '/api' },
    }),
  ],
});
```

`provideNexusRemote()` registers an `APP_INITIALIZER` that runs `SelfRegisterService.register()`. It reads metadata from the `@NexusRemote()` decorator on the `entry` class.

## Provider for a host

```ts
import { provideNexusHost } from '@bimo-dk/nexus-runtime';

bootstrapApplication(AppShell, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationIdInterceptor, nexusAuthInterceptor])),
    provideNexusHost({
      configDefaults: {
        registryUrl: '/api',
        wsUrl: '/ws',
        staticBackupUrl: '/assets/registry-backup.json',
      },
    }),
  ],
});
```

`provideNexusHost()` fetches the remote list, opens the WebSocket, and updates routes on every `remotes_changed` broadcast.

## Route helpers

```ts
import { nexusRoute, nexusRoutes } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),
  ...nexusRoutes({ exclude: ['admin'] }),
];
```

`nexusRoute` returns a standard Angular `Route` with `loadComponent` that resolves through `ComponentLoaderService`. `nexusRoutes` returns one route per enabled remote (filtered by `exclude` / `include`).

## Drop-in tag

```ts
import { NexusComponent } from '@bimo-dk/nexus-runtime';

@Component({
  standalone: true,
  imports: [NexusComponent],
  template: `
    <nexus-component
      remote="catalog"
      expose="ProductGrid"
      [inputs]="{ category: 'electronics' }"
    />
  `,
})
export class HomePage {}
```

## Services

| Service | Purpose |
|---|---|
| `DynamicNexusService` | High-level host orchestration — `refresh()`, current remote snapshot. |
| `RegistryService` | HTTP client for remotes/hosts/gates from the host's perspective. |
| `RegistryWebSocketService` | RxJS-friendly WebSocket — `messages$: Observable<WebSocketMessage>`. |
| `HealthService` | Background health check loop with backoff. |
| `ComponentLoaderService` | Loads a single federated component on demand. Caches. |
| `CatalogService` | Aggregates `@NexusComponent` metadata across registered remotes. |
| `SelfRegisterService` | Used by `provideNexusRemote` — POSTs the remote to the registry. |

## Interceptors

| Interceptor | Use |
|---|---|
| `correlationIdInterceptor` | Adds `X-Request-ID` (ULID) to every outgoing HTTP request. |
| `nexusAuthInterceptor` | Adds `X-Nexus-Token` from `NEXUS_CONFIG`. |
| `bearerTokenInterceptor` | Adds `Authorization: Bearer <token>` for app-level auth (separate from the registry token). |

## DI tokens

| Token | Provides |
|---|---|
| `NEXUS_CONFIG` | The merged config object. |
| `USER_CONTEXT` | Optional user identity signal. |
| `NEXUS_AUTH` | Optional `NexusAuthService` your application provides. |

## Auth helpers (optional)

```ts
import { requireRole, requireAuth } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  { path: 'admin', canActivate: [requireRole('admin')], loadChildren: () => import('./admin') },
];
```

## Next

- [Guide: Angular remote in depth](../guides/guide-angular-remote.md)
- [Guide: Angular host in depth](../guides/guide-angular-host.md)
- [`@bimo-dk/nexus-build`](nexus-build.md) — decorators that this runtime reads.
