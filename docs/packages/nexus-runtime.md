---
id: nexus-runtime
title: '@bimo-dk/nexus-runtime'
sidebar_position: 5
description: "@bimo-dk/nexus-runtime — Angular 19 providers for host and remote federation. provideNexusHost, provideNexusRemote, DynamicNexusService, nexusRoute and NexusComponent. Zero-boilerplate federation wiring."
keywords: [provideNexusHost Angular, provideNexusRemote Angular, DynamicNexusService, Angular micro frontend runtime providers]
---

# @bimo-dk/nexus-runtime

Angular providers that bundle everything a host or remote needs at runtime — config loading, self-registration, HTTP interceptors, dynamic federation, registry state, and a drop-in tag for federated components. Two providers, two lines of code.

```bash
npm install @bimo-dk/nexus-runtime @bimo-dk/nexus-build
```

Peer dependencies (must exist in your app):

- `@angular/core`, `@angular/common`, `@angular/router` (^19)
- `@angular-architects/native-federation` (^19) — host only
- `rxjs` (^7.8)

## Remote (5-line bootstrap)

```ts
// src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNexusRemote } from '@bimo-dk/nexus-runtime';
import EntryComponent from './app/remote-entry/entry.component';

bootstrapApplication(EntryComponent, {
  providers: [
    provideNexusRemote({
      entry: EntryComponent,
      configDefaults: {
        registryUrl: 'http://localhost:3000',
        nexusToken: 'dev-token',
      },
    }),
  ],
});
```

At bootstrap, `provideNexusRemote(...)`:

1. Fetches `/assets/config.json` and merges over `configDefaults`.
2. `SelfRegisterService` runs — POSTs (or PUTs) the remote to `${registryUrl}/api/remotes`.
3. Reads `name`, `route` and `exposedModule` from the `@NexusRemote` decorator metadata on `entry`.
4. URL is derived from `window.location` unless `publicUrl` is set in runtime config.

The remote is now visible in the registry and the host's WebSocket subscription fires immediately.

## Host (1 provider, full dynamic federation)

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNexusHost } from '@bimo-dk/nexus-runtime';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([]),     // start empty — nexus fills in routes
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

`provideNexusHost(...)`:

1. Fetches remotes via the fallback chain (registry → cache → static backup).
2. Opens a `/ws` WebSocket.
3. For each enabled remote, calls `loadRemoteModule(...)` and registers a route.
4. Subscribes to `remotes_changed` broadcasts → add/remove routes without reload.

## Reading state from the shell

```ts
import { Component, inject } from '@angular/core';
import { DynamicNexusService } from '@bimo-dk/nexus-runtime';

@Component({ ... })
export class AppShell {
  readonly nexus = inject(DynamicNexusService);

  // signals:
  // nexus.loadedRemotes()  - signal<RemoteConfig[]>
  // nexus.failedRemotes()  - signal<Map<string, string>>  (name → error message)
  // nexus.registryOnline() - computed signal
}
```

These are signals, so template bindings re-render automatically.

---

## `<nexus-component>` — drop-in federated tag

The single biggest convenience for consuming remotes. Loads + caches + renders any federated component by name.

```ts
import { NexusComponent } from '@bimo-dk/nexus-runtime';

@Component({
  standalone: true,
  imports: [NexusComponent],
  template: `
    <nexus-component remote="checkout" expose="CartPage" />

    <nexus-component
      remote="orders"
      expose="OrderTable"
      [inputs]="{ filter: 'pending', pageSize: 25 }" />
  `,
})
export class Dashboard {}
```

| Input | Type | Required | Description |
|---|---|---|---|
| `remote` | `string` | yes | Name of a registered remote |
| `expose` | `string` | yes | Module name (with or without `./`) |
| `inputs` | `Record<string, unknown>` | no | Forwarded to the loaded component via `NgComponentOutlet` |

Built-in states:

- **loading** — `<div class="nx-loading">Loading <expose>…</div>`
- **error** — `<div class="nx-error">Failed to load <remote>/<expose>: <reason></div>`
- **loaded** — `<ng-container *ngComponentOutlet="cmp; inputs: inputs" />`

The remote must already be registered (`DynamicNexusService.loadedRemotes()`). If not, the error state shows `Remote "X" not loaded (not in registry?)`.

See [loading patterns](../workflows/loading-patterns.md#pattern-2-drop-in-nexus-component-tag) for full examples.

---

## `nexusRoute()` — lazy route from a remote

Build an Angular `Route` whose `loadComponent` resolves to a federated component.

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { nexusRoute, nexusRoutes } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  nexusRoute({ path: 'checkout',    remote: 'checkout', expose: 'CartPage' }),
  nexusRoute({ path: 'orders/:id',  remote: 'orders',   expose: 'OrderDetail' }),
];
```

`NexusRouteSpec`:

| Field | Type | Description |
|---|---|---|
| `path` | `string` | URL path, no leading slash |
| `remote` | `string` | Remote name (registered) |
| `expose` | `string` | Exposed module name (with or without `./`) |
| `data` | `Record<string, unknown>` | Forwarded as `Route.data` (guards, breadcrumbs, …) |

`nexusRoutes([...])` is the bulk version — useful for catalog-driven routing.

The host's auto-route-registration (`provideNexusHost`) is for the **primary** route of each registered remote. Use `nexusRoute()` when you want extra routes from the same remote, or when you want to bypass the registry's `routePath`.

---

## `ComponentLoaderService` — programmatic loader

Inject when you need to load a federated component imperatively.

```ts
import { ComponentLoaderService } from '@bimo-dk/nexus-runtime';

@Component({ /* ... */ })
export class DialogTrigger {
  private readonly loader = inject(ComponentLoaderService);

  async openConfirm() {
    const Confirm = await this.loader.loadComponent('shared', 'ConfirmDialog');
    // hand it to MatDialog or a custom outlet
  }
}
```

API:

| Method | Returns | Notes |
|---|---|---|
| `loadComponent(remote, expose)` | `Promise<Type<unknown>>` | Cached per `<remote>::<expose>` pair |
| `preloadAll([{ remote, expose }, …])` | `Promise<Type<unknown>[]>` | Parallel — useful for eager grids |

`expose` accepts both `'CartPage'` and `'./CartPage'`. The cache is process-lifetime; a remote redeploy still requires a tab reload to pick up new module code.

Underneath, this is what `<nexus-component>`, `nexusRoute()` and `CatalogService` all use.

---

## `CatalogService`

Aggregates `catalog.json` from every registered remote into one searchable signal. Populated by `@NexusComponent({...})` decorators at build time.

```ts
import { CatalogService } from '@bimo-dk/nexus-runtime';

@Component({ /* ... */ })
export class Picker {
  readonly catalog = inject(CatalogService);

  async ngOnInit() {
    await this.catalog.refresh();
  }

  readonly tables = computed(() =>
    this.catalog.filter({ category: 'data-display', tag: 'table' })
  );
}
```

State (all signals):

| Property | Type | Description |
|---|---|---|
| `entries` | `signal<CatalogEntry[]>` | All discovered entries across all remotes |
| `loading` | `signal<boolean>` | True while a refresh is in flight |
| `errors` | `signal<Map<string, string>>` | Per-remote fetch errors |
| `categories` | `computed<string[]>` | Unique, sorted |
| `tags` | `computed<string[]>` | Unique, sorted |

Methods:

| Method | Returns | Notes |
|---|---|---|
| `refresh()` | `Promise<void>` | Re-fetches every remote's `catalog.json` in parallel |
| `filter({ query, category, tag, remote })` | `CatalogEntry[]` | Free-text + faceted |

`CatalogEntry`:

```ts
interface CatalogEntry {
  remote: string;
  expose: string;
  className: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  icon?: string;
  inputs: Record<string, NexusInputSpec>;
  experimental: boolean;
}
```

See [component catalog workflow](../workflows/component-catalog.md) for the end-to-end story.

---

## Runtime config — `/assets/config.json`

Both providers fetch this file at bootstrap. Typical template (substituted by nginx entrypoint at container start):

```json
{
  "registryUrl": "${REGISTRY_URL}",
  "nexusToken": "${NEXUS_TOKEN}",
  "publicUrl": "${PUBLIC_URL}"
}
```

`NexusRuntimeConfig` fields:

| Field | Description |
|---|---|
| `registryUrl` | Base URL of the registry API |
| `nexusToken` | Token for `X-Nexus-Token` header |
| `configAssetPath` | Override `/assets/config.json` path (defaults to that) |
| `publicUrl` | Override the URL a remote announces to the registry |
| `staticBackupUrl` | Host-only: path to the backup remotes JSON |

## What's bundled

Both providers register the same baseline:

- `NEXUS_CONFIG` injection token, populated from runtime config + `configDefaults`
- `provideHttpClient(withInterceptors([nexusAuthInterceptor, correlationIdInterceptor]))`

Then they add role-specific pieces:

- **Remote** — `SelfRegisterService` (runs once at bootstrap)
- **Host** — `RegistryService`, `RegistryWebSocketService`, `DynamicNexusService`, `ComponentLoaderService`, `CatalogService`

## Interceptors

| Interceptor | Adds | Scope |
|---|---|---|
| `nexusAuthInterceptor` | `X-Nexus-Token: <nexusToken>` | requests to the registry origin |
| `correlationIdInterceptor` | `X-Request-ID: <uuid v4>` | every request |

Both are exported individually if you need to register them on a custom `HttpClient` instance.

## Manual wiring (escape hatch)

Every building block is exported so you can wire your own stack:

```ts
import {
  NEXUS_CONFIG,
  provideNexusConfig,
  SelfRegisterService,
  DynamicNexusService,
  RegistryService,
  RegistryWebSocketService,
  ComponentLoaderService,
  CatalogService,
  NexusComponent,
  nexusRoute,
  nexusRoutes,
  loadFromRemote,
  nexusAuthInterceptor,
  correlationIdInterceptor,
  loadRuntimeConfig,
  readRemoteMetadata,
  deriveRouteFromName,
} from '@bimo-dk/nexus-runtime';
```

Use cases are rare — typically Angular Universal or testing — and `provideNexusHost` / `provideNexusRemote` is what you want 99% of the time.
