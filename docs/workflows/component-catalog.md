---
id: component-catalog
title: Component catalog
sidebar_position: 10
description: Publish, discover, and use cross-team components with the Nexus catalog. NexusComponent decorator for Angular, catalog field on nexusVite for Vue and React.
keywords:
  - micro frontend catalog
  - component federation
  - NexusComponent decorator
  - cross-team components
---

# Component catalog

The catalog is the discoverable inventory of what every remote exposes. It populates automatically — no central registry to update, no Storybook deployment to maintain. Components show up the moment a remote container starts.

## How it gets populated

### Angular

```ts
import { NexusComponent } from '@bimo-dk/nexus-build';

@NexusComponent({
  title: 'Order Table',
  description: 'Sortable, paginated table of orders.',
  category: 'data-display',
  tags: ['orders', 'commerce'],
  inputs: {
    filter: { type: 'string', default: 'pending' },
    pageSize: { type: 'number', default: 25 },
  },
})
@Component({ /* ... */ })
export default class OrderTableComponent {}
```

`nexus-build` reads this decorator at build time and writes `catalog.json` next to `remoteEntry.json`. The portal's `/catalog` page aggregates all such files from all registered remotes.

### Vue / React

```ts
nexusVite({
  name: 'orders',
  exposes: { OrderTable: './src/order-table.vue' },
  catalog: [
    {
      expose: 'OrderTable',
      title: 'Order Table',
      description: 'Sortable, paginated table of orders.',
      category: 'data-display',
      tags: ['orders', 'commerce'],
      inputs: {
        filter: { type: 'string', default: 'pending' },
        pageSize: { type: 'number', default: 25 },
      },
    },
  ],
})
```

The `nexusVite` plugin writes `catalog.json` at `closeBundle()`.

## How it's discovered

The portal's Catalog page fetches `catalog.json` from every enabled remote. Each entry shows:

- Title, description, category, tags.
- Source remote and exposed module.
- Input schema (types, required, defaults).
- A copy-to-clipboard snippet for the consumer framework you pick.

Click "Copy as Angular":

```html
<nexus-component remote="orders" expose="OrderTable" [inputs]="{ filter: 'pending', pageSize: 25 }" />
```

Click "Copy as Vue":

```vue
<NexusComponent remote="orders" expose="OrderTable" :inputs="{ filter: 'pending', pageSize: 25 }" />
```

Click "Copy as React":

```tsx
<NexusComponent remote="orders" expose="OrderTable" props={{ filter: 'pending', pageSize: 25 }} />
```

## How it's used programmatically

```ts
import { inject } from '@angular/core';
import { CatalogService } from '@bimo-dk/nexus-runtime';

const catalog = inject(CatalogService);

const all = await catalog.list();
const dataDisplays = await catalog.list({ category: 'data-display' });
const orderEntries = await catalog.list({ tag: 'orders' });
```

Vue / React equivalents read the catalog through the same client — `RegistryClient.getCatalog()`.

## Input shape conventions

| Field | Use |
|---|---|
| `type` | `string` / `number` / `boolean` / `object` / `array` |
| `description` | Single-line description for the catalog UI. |
| `default` | Default value used when the consumer omits the input. |
| `required` | If true, the catalog UI flags missing inputs. |

The catalog is metadata; the actual props pass straight through to your component at runtime. The framework adapter does not validate input shapes — your component should defensively handle missing or wrong-typed inputs.

## Cross-framework catalog

A Vue catalog entry can be consumed from an Angular host, and vice versa. The catalog is purely descriptive; the actual mount path goes through the framework adapter and produces a native component on the consumer side.

That said: passing complex objects (functions, observables, Promises) across the framework boundary is fragile. Stick to plain serializable inputs.

## Curation

Use categories and tags consistently across your remotes. A reasonable taxonomy:

| Category | Examples |
|---|---|
| `data-display` | tables, lists, cards |
| `data-input` | forms, pickers, editors |
| `navigation` | breadcrumbs, sidebars |
| `feedback` | toasts, modals, banners |
| `commerce` | cart, checkout, product |
| `auth` | login, profile, role guards |

Tags should be the *thing the component is about* (`orders`, `users`, `payment`), not its type (`table`, `form`).

## Next

- [Workflows: loading-patterns](loading-patterns.md) — how to actually use a discovered component.
- [Packages: nexus-runtime](../packages/nexus-runtime.md) — `CatalogService` (Angular).
- [Infra: portal](../infrastructure/infra-portal.md) — the Catalog page.
