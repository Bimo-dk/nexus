---
id: loading-patterns
title: Loading patterns
sidebar_position: 11
description: Five patterns for mounting a Nexus remote in a host. Route-based, drop-in tag, programmatic, lazy, and inline cross-framework.
keywords:
  - micro frontend loading patterns
  - nexusRoute
  - NexusComponent
  - dynamic federation
  - cross-framework
---

# Loading patterns

You have five ways to mount a remote inside a host. Pick the one that fits the use case.

## 1. Route-based

The most common pattern. The remote owns a URL path; the host adds a route.

### Angular

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

### Vue

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime-vue';

const routes = [
  nexusRoute({ path: '/checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

### React

```tsx
import { createNexusRoute } from '@bimo-dk/nexus-runtime-react';

const Checkout = createNexusRoute({ remote: 'checkout', expose: 'RemoteEntry' });

<Route path="/checkout/*" element={<Checkout />} />
```

Use when: the remote is a whole page or feature.

## 2. Drop-in tag

A single component, embedded anywhere.

### Angular

```html
<nexus-component
  remote="catalog"
  expose="ProductGrid"
  [inputs]="{ category: 'electronics' }"
/>
```

### Vue

```vue
<NexusComponent remote="catalog" expose="ProductGrid" :inputs="{ category: 'electronics' }" />
```

### React

```tsx
<NexusComponent remote="catalog" expose="ProductGrid" props={{ category: 'electronics' }} />
```

Use when: the remote is a *widget* embedded inside the host's own pages.

## 3. Programmatic load

You want full control over when and where to mount.

### Angular

```ts
import { ComponentLoaderService } from '@bimo-dk/nexus-runtime';

const loader = inject(ComponentLoaderService);

async openModal() {
  const cmp = await loader.loadComponent({ remote: 'checkout', expose: 'RemoteEntry' });
  this.viewContainer.createComponent(cmp);
}
```

### Vue

```ts
import { useNexusRemote } from '@bimo-dk/nexus-runtime-vue';

const remote = useNexusRemote('checkout');
// Render remote.component when ready.
```

### React

```tsx
import { useNexusComponent } from '@bimo-dk/nexus-runtime-react';

const { Component, loading, error } = useNexusComponent({ remote: 'checkout', expose: 'RemoteEntry' });

if (Component) return <Component customerId="42" />;
```

Use when: timing matters — open in a modal, lazy-load on user interaction, render conditionally.

## 4. Bulk auto-mount

Auto-add every enabled remote as a route.

### Angular

```ts
import { nexusRoutes } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  ...nexusRoutes({ exclude: ['admin'] }),
];
```

`nexusRoutes` reads the registry's enabled-remote list at startup and produces one route per remote. Filter with `include` / `exclude`.

Use when: your host's nav is registry-driven and every remote should be a top-level route.

## 5. Inline cross-framework

When you need to embed a Vue or React remote inside a non-matching host *outside* of routing.

```ts
// In an Angular host, mount a Vue remote inside a div.
import { ViewChild, ElementRef, inject } from '@angular/core';
import { ComponentLoaderService } from '@bimo-dk/nexus-runtime';
// ... use the loader to fetch the manifest, then manually call createApp(...).mount(...)
```

Tradeoffs:

- Each remote brings its own framework runtime (Vue 3, React 18) — bundle size cost.
- State sharing across frameworks goes through the host (React Context / Vue provide+inject / Angular DI).
- Hot-reload is per-framework.

Use sparingly. Most cross-framework mounting works best at the route boundary.

## How the host learns of new remotes

All five patterns react to `remotes_changed`:

- `nexusRoute` / `createNexusRoute` re-resolves the component reference.
- `<nexus-component>` re-renders.
- `ComponentLoaderService` / `useNexusComponent` / `useNexusRemote` invalidate their cache.
- `nexusRoutes` adds new routes (and removes routes for disabled remotes).

No host code needs to "know" about the new remote. The runtime adapter handles it.

## Performance tips

- **Preload visible remotes at startup.** `provideNexusHost({ preload: ['catalog', 'orders'] })` warms the federation cache so the first navigation is instant.
- **Cache aggressively at the CDN — except for `remoteEntry.json` and `chunk-*.js`.** The gateway already enforces `no-store` on those; mirror it at the CDN.
- **Share framework runtimes.** When both host and remote are Angular, mark `@angular/core` as `singleton: true` so the runtime is shared.

## Next

- [Workflows: component-catalog](component-catalog.md) — discover what to load.
- [Guide: mixed-stack](../guides/guide-mixed-stack.md) — end-to-end cross-framework example.
- [Packages: nexus-runtime-core](../packages/nexus-runtime-core.md) — the loader under the hood.
