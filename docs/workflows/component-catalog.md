---
id: component-catalog
title: Component catalog
sidebar_position: 6
---

# Component catalog

The catalog is Nexus's answer to **"what components do the other teams expose, and how do I use them?"** — without standing up a separate Storybook deployment or wiring up a shared design-system repo.

You tag a component with `@NexusComponent({...})`. At build time the metadata is collected into `catalog.json` and published next to `remoteEntry.json`. The portal's `/catalog` page aggregates every registered remote's `catalog.json` into a searchable index.

```
src/                                  build           served at
├── orders/                            │                │
│   ├── order-table.component.ts ──────┤                │
│   │   @NexusComponent({...})         │                │
│   ├── order-detail.component.ts ─────┤                │
│   │   @NexusComponent({...})         │                │
└── ...                                ▼                ▼
                              public/catalog.json  /remotes/orders/catalog.json
                                                        │
                                                        ▼
                                               portal /catalog page
                                               ┌──────────────────────┐
                                               │ search, filter,      │
                                               │ by category, tag,    │
                                               │ remote, inputs spec  │
                                               └──────────────────────┘
```

---

## Annotate a component

```ts
import { Component } from '@angular/core';
import { NexusRemote, NexusComponent } from '@bimo-dk/nexus-build';

@NexusRemote({ exposeAs: 'OrderTable' })
@NexusComponent({
  title: 'Order Table',
  description: 'Paginated table of orders with status filter',
  category: 'data-display',
  tags: ['orders', 'commerce', 'table'],
  icon: 'shopping_cart',
  inputs: {
    filter:   { type: 'string',  default: 'all',    description: 'Status filter', enum: ['all', 'open', 'closed'] },
    pageSize: { type: 'number',  default: 25,       description: 'Rows per page' },
    readonly: { type: 'boolean', default: false },
  },
})
@Component({ /* ... */ })
export default class OrderTableComponent {}
```

`@NexusRemote()` and `@NexusComponent()` stack — they serve different purposes:

| Decorator | Produces | Read by |
|---|---|---|
| `@NexusRemote()` | `federation.config.json` entry under `exposes` | Native Federation at build time |
| `@NexusComponent({...})` | `catalog.json` entry | Portal `/catalog`, `CatalogService`, IDEs |

You can use either independently. Most catalog entries also need to be federated, so stacking both is the common case.

---

## Options

```ts
interface NexusComponentOptions {
  title: string;                                   // required — display name
  description?: string;                            // shown under the title
  category?: string;                               // free-form, used for grouping
  tags?: string[];                                 // free-form, used for filter/search
  icon?: string;                                   // Material icon name or single emoji
  inputs?: Record<string, NexusInputSpec>;         // @Input() schema
  experimental?: boolean;                          // hidden from default catalog view
}

type NexusInputType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface NexusInputSpec {
  type: NexusInputType;
  default?: unknown;
  description?: string;
  required?: boolean;
  enum?: string[];          // for string inputs
}
```

The conventional `category` set is `data-display | input | navigation | layout | feedback | chart` — but it is free-form. Pick what fits your domain.

---

## How `catalog.json` is generated

`nexus-build` (the `prebuild` step in every remote) scans `src/**/*.ts` for both decorators on the same class. Output:

```jsonc
// public/catalog.json — written alongside federation.config.json
{
  "remote": "orders",
  "generatedAt": "2026-06-03T10:15:00.000Z",
  "entries": [
    {
      "expose": "OrderTable",
      "className": "OrderTableComponent",
      "title": "Order Table",
      "description": "Paginated table of orders with status filter",
      "category": "data-display",
      "tags": ["orders", "commerce", "table"],
      "icon": "shopping_cart",
      "inputs": {
        "filter":   { "type": "string",  "default": "all", "enum": ["all","open","closed"] },
        "pageSize": { "type": "number",  "default": 25 },
        "readonly": { "type": "boolean", "default": false }
      },
      "experimental": false
    }
  ]
}
```

The file lives in `public/` so the remote's nginx serves it from `/catalog.json`. The gateway routes `/remotes/<name>/catalog.json` to the right remote.

Override the path with `nexus-build --catalog-path dist/catalog.json` if your build copies `public/` differently.

---

## The portal catalog page

Open http://localhost:8669/catalog. You see one card per discovered entry, with:

- Icon + title + remote/expose path
- Tags + category pills
- `experimental` warning if set
- Input schema in a collapsible details table — types, defaults, descriptions, required marker

Filters:

- **Search** — title, tags, expose, description
- **Category** — populated from every entry's `category`
- **Remote** — only show one remote's entries
- **Tag** — populated from every entry's `tags`

Refresh button re-fetches every `catalog.json`. Errors (one remote down, malformed JSON) are reported per-remote so the rest of the catalog keeps working.

---

## Reading the catalog programmatically

In any host or remote, inject `CatalogService`:

```ts
import { CatalogService } from '@bimo-dk/nexus-runtime';

@Component({ /* ... */ })
export class MyComponentPicker {
  readonly catalog = inject(CatalogService);

  async ngOnInit() {
    await this.catalog.refresh();
    const tables = this.catalog.filter({ category: 'data-display', tag: 'table' });
    console.log(tables);
  }
}
```

`CatalogService` exposes signals:

```ts
catalog.entries()     // signal<CatalogEntry[]>
catalog.loading()     // signal<boolean>
catalog.errors()      // signal<Map<remoteName, errorMessage>>
catalog.categories()  // computed<string[]>  (unique, sorted)
catalog.tags()        // computed<string[]>  (unique, sorted)

catalog.filter({ query, category, tag, remote })  // CatalogEntry[]
```

Use this for in-app component pickers, admin tooling, or to wire a dashboard that lets a user drop catalog entries into a layout.

---

## End-to-end: catalog → drop into your app

```ts
// 1. Tag the component in the remote
@NexusRemote({ exposeAs: 'PriceChart' })
@NexusComponent({
  title: 'Price chart',
  category: 'chart',
  tags: ['finance', 'chart'],
  inputs: { ticker: { type: 'string', required: true } },
})
@Component({ /* ... */ })
export default class PriceChartComponent { ... }

// 2. Build + deploy — federation.config.json AND catalog.json are written
// 3. Register the remote (auto via provideNexusRemote, or manual)
// 4. In any consuming app:
```

```html
<nexus-component remote="finance" expose="PriceChart" [inputs]="{ ticker: 'BIMO' }" />
```

That's the whole loop. The chart is fetched once, cached, and renders inside the host. See [loading patterns](loading-patterns.md) for the other ways to mount it.

---

## Discoverability across teams

The biggest payoff is social, not technical:

- A PM browses `/catalog` and finds a `CartSummary` she did not know existed.
- A new hire reads `/catalog` instead of asking five team leads what is reusable.
- A `tags: ['design-system']` filter shows everything an org has agreed is canonical.
- An `experimental: true` flag lets teams ship work-in-progress components without polluting the default view.

The catalog is the closest thing in Nexus to a design system — without forcing one onto teams that do not want it.

---

## Related

- [`@NexusComponent` reference](../packages/nexus-build.md#nexuscomponent--catalog-metadata)
- [`<nexus-component>` tag](../packages/nexus-runtime.md#nexus-component--drop-in-federated-tag)
- [`nexusRoute()` helper](../packages/nexus-runtime.md#nexusroute--lazy-route-from-a-remote)
- [`CatalogService`](../packages/nexus-runtime.md#catalogservice)
- [Loading patterns](loading-patterns.md) — three ways to consume catalog entries.
