---
id: loading-patterns
title: Loading patterns
sidebar_position: 7
description: Patterns for loading Angular micro frontend remotes — route-based lazy loading with nexusRoute, inline embedding with NexusComponent, and programmatic loading via ComponentLoaderService. Choose the right pattern for your use case.
keywords: [Angular federation loading patterns, nexusRoute Angular, NexusComponent inline loading, Angular micro frontend lazy loading]
---

# Loading patterns

Three ways to mount a federated component. Pick by use-case; they all share the same `ComponentLoaderService` cache underneath, so the same `remote/expose` pair is fetched once per browser session no matter how many call sites use it.

| Pattern | Use when |
|---|---|
| **`nexusRoute()`** | The component **is** the page — URL → component. |
| **`<nexus-component>` tag** | The component lives **inside** another page (a card in a dashboard, a tab in a settings panel). |
| **`ComponentLoaderService` programmatic** | You need to load components dynamically — grids driven by config, button-triggered dialogs, catalog-driven layouts. |

---

## Pattern 1: route-based

The component is a top-level page.

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { nexusRoute, nexusRoutes } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  nexusRoute({ path: 'orders',         remote: 'orders',   expose: 'OrderList' }),
  nexusRoute({ path: 'orders/:id',     remote: 'orders',   expose: 'OrderDetail' }),
  nexusRoute({ path: 'checkout',       remote: 'checkout', expose: 'CartPage' }),
];
```

`nexusRoute()` returns a standard Angular `Route` with `loadComponent` filled in. Use it inline with hand-written routes, child routes, guards — anything Angular's router supports.

### Bulk version

When you want to drive routes from config or the catalog:

```ts
import { nexusRoutes } from '@bimo-dk/nexus-runtime';

export const routes: Routes = nexusRoutes([
  { path: 'orders',     remote: 'orders',   expose: 'OrderList' },
  { path: 'checkout',   remote: 'checkout', expose: 'CartPage' },
  { path: 'inventory',  remote: 'inventory', expose: 'StockGrid', data: { permission: 'inventory.read' } },
]);
```

### What you get for free

- Lazy load — the bundle is only fetched on navigation.
- Cache — second visit is instant.
- Auto-registration with the registry — `provideNexusHost(...)` adds the route based on `/api/remotes`. Hand-rolled `nexusRoute()` is for **additional** routes (e.g. detail pages under a remote's namespace).

---

## Pattern 2: drop-in `<nexus-component>` tag

The component lives inside another page.

```html
<!-- a dashboard composed of three federated cards -->
<div class="grid">
  <nexus-component remote="finance"  expose="PriceTicker" [inputs]="{ ticker: 'BIMO' }" />
  <nexus-component remote="ops"      expose="HealthBoard" />
  <nexus-component remote="checkout" expose="CartSummary" [inputs]="{ compact: true }" />
</div>
```

Import the standalone component:

```ts
import { NexusComponent } from '@bimo-dk/nexus-runtime';

@Component({
  standalone: true,
  imports: [NexusComponent],
  template: ` ... `,
})
export class Dashboard {}
```

### Inputs flow through

`[inputs]` is a plain `Record<string, unknown>` that is forwarded to the loaded component via `NgComponentOutlet`. Use it for any `@Input()` on the remote component.

```html
<nexus-component
  remote="orders"
  expose="OrderTable"
  [inputs]="{ filter: status, pageSize: 50, readonly: true }" />
```

If the inputs signal changes, the outlet is updated — no remount.

### Built-in loading/error states

```ts
@switch (state()) {                                       // 'loading' | 'loaded' | 'error'
  @case ('loaded') { <ng-container *ngComponentOutlet="..." /> }
  @case ('error')  { <div class="nx-error">Failed: ...</div> }
  @default         { <div class="nx-loading">Loading ...</div> }
}
```

The default error/loading templates are minimal. Wrap in your own component when you want bespoke shells.

### Catalog-driven UI

Combined with `CatalogService`, you can build a "drop any component here" picker:

```ts
@Component({ /* ... */ })
export class Slot {
  readonly catalog = inject(CatalogService);
  readonly selected = signal<{ remote: string; expose: string } | null>(null);

  async ngOnInit() { await this.catalog.refresh(); }
}
```

```html
<select (change)="select($event)">
  @for (e of catalog.entries(); track e.remote + ':' + e.expose) {
    <option [value]="e.remote + ':' + e.expose">{{ e.title }}</option>
  }
</select>

@if (selected(); as s) {
  <nexus-component [remote]="s.remote" [expose]="s.expose" />
}
```

---

## Pattern 3: programmatic via `ComponentLoaderService`

For the cases where the tag is not enough — preloading a grid, driving the loader from imperative code, wrapping with additional logic.

```ts
import { Component, inject, signal, Type } from '@angular/core';
import { ComponentLoaderService } from '@bimo-dk/nexus-runtime';
import { NgComponentOutlet } from '@angular/common';

@Component({
  standalone: true,
  imports: [NgComponentOutlet],
  template: `
    @if (cmp(); as c) {
      <ng-container *ngComponentOutlet="c; inputs: { /* ... */ }" />
    }
    <button (click)="open('analytics', 'TopMovers')">Show top movers</button>
  `,
})
export class TriggerDemo {
  private readonly loader = inject(ComponentLoaderService);
  readonly cmp = signal<Type<unknown> | null>(null);

  async open(remote: string, expose: string) {
    this.cmp.set(await this.loader.loadComponent(remote, expose));
  }
}
```

### Preload many in parallel

```ts
await this.loader.preloadAll([
  { remote: 'finance', expose: 'PriceTicker' },
  { remote: 'finance', expose: 'TopMovers' },
  { remote: 'ops',     expose: 'HealthBoard' },
]);
```

Useful when you know the user is about to open a heavy dashboard and want every chunk fetched in parallel ahead of paint.

### Cache semantics

`ComponentLoaderService` keeps a per-`<remote>::<expose>` promise cache. Multiple call sites for the same target share one fetch. The cache lives for the lifetime of the host process (browser tab), so a remote redeploy still requires a tab reload for now — `remoteEntry.json` is `no-store` but the resolved module is held in memory.

---

## Choosing between patterns

| Question | Pattern |
|---|---|
| "This URL maps to this component" | `nexusRoute()` |
| "I'm composing a static layout from federated parts" | `<nexus-component>` |
| "I'm building a generic slot, host picks at runtime" | `<nexus-component>` with dynamic `[remote]`/`[expose]` |
| "I need to imperatively load + cache + reuse" | `ComponentLoaderService` |
| "I want to preload N components in parallel" | `loader.preloadAll([...])` |
| "I'm building a route table from catalog entries" | `nexusRoutes(catalog.entries().map(toSpec))` |

All three patterns rely on the remote being **registered** in the registry — `provideNexusHost(...)` keeps `DynamicNexusService.loadedRemotes()` up to date over WebSocket. The loader uses that signal to resolve the remote URL.

---

## Errors

| Error | Cause | Fix |
|---|---|---|
| `Remote "X" not loaded (not in registry?)` | The remote is not registered. | Add it via `bnx publish`, portal, or check the registry's `/api/remotes`. |
| `Module "./Y" on "X" exposed nothing usable` | The remote's `exposes` block does not declare `./Y`. | Verify the `@NexusRemote({ exposeAs: 'Y' })` matches, rebuild the remote. |
| 404 on `/catalog.json` | The remote was built without `@NexusComponent` decorators. | Add at least one, or update the catalog UI to ignore that remote. |
| Hot reload doesn't pick up the new component | The host caches resolved modules in memory. | Reload the host tab. |

---

## Related

- [Component catalog](component-catalog.md) — `@NexusComponent` + portal `/catalog`.
- [`@bimo-dk/nexus-runtime` reference](../packages/nexus-runtime.md) — provider + service API surface.
- [`@bimo-dk/nexus-build`](../packages/nexus-build.md) — `@NexusRemote` and `@NexusComponent` decorators.
