---
id: guide-angular-host
title: Guide — Angular host in depth
sidebar_position: 5
description: Build an Angular 19 host shell that loads federated remotes from Nexus. provideNexusHost, nexusRoute, NexusComponent tag, dynamic loading patterns.
keywords:
  - Angular host
  - Angular micro frontend host
  - Native Federation host
  - nexusRoute
  - provideNexusHost
---

# Angular host in depth

A host is the application that loads remotes. This guide builds an Angular 19 host that loads remotes (of any framework) from a Nexus registry.

## Prerequisites

- A running Nexus stack with at least one remote registered.
- Node.js 22+, npm 10+.

## Install the packages

```bash
mkdir storefront-host && cd storefront-host
npm init -y
npm install @angular/core @angular/common @angular/router @angular/platform-browser \
            @angular-architects/native-federation rxjs
npm install @bimo-dk/nexus-runtime @bimo-dk/nexus-client @bimo-dk/nexus-core
npm install -D @angular/cli @angular/compiler-cli typescript
```

## Bootstrap with one provider

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideNexusHost,
  correlationIdInterceptor,
  nexusAuthInterceptor,
} from '@bimo-dk/nexus-runtime';

import { AppShell } from './app/app.shell';
import { routes } from './app/routes';

bootstrapApplication(AppShell, {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([correlationIdInterceptor, nexusAuthInterceptor]),
    ),
    provideNexusHost({
      configDefaults: {
        registryUrl: '/api',
        wsUrl: '/ws',
        retryAttempts: 5,
        staticBackupUrl: '/assets/registry-backup.json',
      },
    }),
  ],
}).catch((err) => console.error(err));
```

`provideNexusHost()` registers an `APP_INITIALIZER` that:

1. Fetches `/api/remotes` from the registry.
2. Opens a WebSocket on `/ws` and subscribes to `remotes_changed`.
3. Caches the result in `sessionStorage` as a fallback layer.
4. Falls back to `staticBackupUrl` if the registry is down.

By the time your `AppShell` renders, the registry state is loaded.

## Load remotes as routes

```ts
// src/app/routes.ts
import { Routes } from '@angular/router';
import { nexusRoute, nexusRoutes } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  { path: '', redirectTo: 'catalog', pathMatch: 'full' },

  // Single explicit route
  nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),

  // Many at once, derived from the registry
  ...nexusRoutes({ exclude: ['checkout'] }),
];
```

`nexusRoute()` returns a standard Angular `Route` whose `loadComponent` calls `ComponentLoaderService`, which uses `loadRemoteModule` from `@angular-architects/native-federation`. The component is lazy-loaded, cached, and re-resolved on `remotes_changed`.

`nexusRoutes()` returns a `Route` for every enabled remote, derived from the registry list at startup. Use it when you want every remote auto-mounted.

## Load remotes as drop-in components

```html
<!-- in any template -->
<nexus-component
  remote="catalog"
  expose="ProductGrid"
  [inputs]="{ category: 'electronics', limit: 12 }"
/>
```

Import the `NexusComponent` selector once in the standalone component or module:

```ts
import { Component } from '@angular/core';
import { NexusComponent } from '@bimo-dk/nexus-runtime';

@Component({
  standalone: true,
  imports: [NexusComponent],
  template: `<nexus-component remote="catalog" expose="ProductGrid" />`,
})
export class HomePage {}
```

The tag handles loading, error, and `remotes_changed` re-render automatically.

## Programmatic loading

```ts
import { Component, inject } from '@angular/core';
import { DynamicNexusService, ComponentLoaderService } from '@bimo-dk/nexus-runtime';

@Component({ standalone: true, template: `` })
export class SomePage {
  private loader = inject(ComponentLoaderService);
  private dynamic = inject(DynamicNexusService);

  async openCheckout() {
    const cmp = await this.loader.loadComponent({ remote: 'checkout', expose: 'RemoteEntry' });
    // Render `cmp` into a ViewContainerRef of your choosing.
  }

  async reloadAll() {
    await this.dynamic.refresh();
  }
}
```

## React to changes

```ts
import { inject } from '@angular/core';
import { RegistryWebSocketService } from '@bimo-dk/nexus-runtime';

const ws = inject(RegistryWebSocketService);

ws.messages$.subscribe((msg) => {
  if (msg.type === 'remotes_changed') {
    console.log('Registry updated', msg.remotes);
  }
});
```

The host re-renders routes automatically; subscribe only when you need custom behavior on top.

## Browse the catalog

```ts
import { inject } from '@angular/core';
import { CatalogService } from '@bimo-dk/nexus-runtime';

const catalog = inject(CatalogService);

const entries = await catalog.list();
// [{ remote: 'checkout', expose: 'RemoteEntry', title: 'Checkout', tags: [...], inputs: {...} }, ...]
```

The portal's `/catalog` page is built on this same service.

## Federation config

The host has its own federation manifest — like a remote, but with no `exposes`:

```js
// federation.config.js
module.exports = {
  name: 'host',
  exposes: {},
  shared: {
    '@angular/core': { singleton: true, requiredVersion: 'auto' },
    '@angular/common': { singleton: true, requiredVersion: 'auto' },
    '@angular/router': { singleton: true, requiredVersion: 'auto' },
  },
};
```

`singleton: true` ensures Angular runtime is shared between host and remotes — critical for `inject()` and DI to work across federation boundaries.

## Common pitfalls

- **`No provider for ApplicationRef`.** The remote was bundled with its own Angular instance. Make sure `@angular/core` is `singleton: true` in both host and remote.
- **Route mounted but blank.** The remote's `default` export does not match the component the `exposes` block points to. Check `federation.config.json`.
- **`remotes_changed` ignored.** `provideNexusHost()` was not called — the APP_INITIALIZER never ran. Verify it's in the providers list.
- **Static backup never used.** The browser sees a CORS error on `/api/remotes`. The fallback chain only fires for HTTP errors, not CORS rejection.

## Next

- [Guide: mixed-stack host](guide-mixed-stack.md) — Angular host loading Vue and React remotes.
- [Workflows: loading patterns](../workflows/loading-patterns.md)
- [Packages: nexus-runtime](../packages/nexus-runtime.md)
