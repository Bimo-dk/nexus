---
id: nexus-build
title: '@bimo-dk/nexus-build'
sidebar_position: 4
description: "@bimo-dk/nexus-build — the @NexusRemote() decorator and federation config generator. Scans your Angular source for decorated components and auto-generates federation.config.json — no manual federation wiring."
keywords: [NexusRemote decorator Angular, Angular federation config generator, nexus-build Angular, @NexusRemote Angular decorator]
---

# @bimo-dk/nexus-build

Generates `federation.config.json` from `@NexusRemote` decorators so you never have to hand-edit it again. Provides a class decorator, a CLI (`nexus-build`), and a small programmatic API.

```bash
npm install -D @bimo-dk/nexus-build
```

## The 30-second pitch

Before:

```jsonc
// federation.config.json — hand-edited, error-prone
{
  "name": "checkout",
  "exposes": { "./RemoteEntry": "./src/app/remote-entry/entry.component.ts" },
  "shared": { /* 30 lines of singleton: true blocks */ }
}
```

After:

```ts
// src/app/remote-entry/entry.component.ts
import { NexusRemote } from '@bimo-dk/nexus-build';

@NexusRemote()
@Component({ template: '...' })
export default class EntryComponent {}
```

`nexus-build` runs as a `prebuild` step, scans `src/**/*.ts` for `@NexusRemote`, and writes `federation.config.json` for you.

## Setup

### 1. Add to npm scripts

```json
{
  "scripts": {
    "prebuild": "nexus-build",
    "build": "ng build"
  }
}
```

### 2. Annotate your entry component

**Default export — `exposeAs` inferred as `'RemoteEntry'`:**

```ts
import { Component } from '@angular/core';
import { NexusRemote } from '@bimo-dk/nexus-build';

@NexusRemote()
@Component({
  selector: 'app-checkout',
  template: `<h1>Checkout</h1>`,
})
export default class CheckoutComponent {}
```

This generates `{ "./RemoteEntry": "./src/app/remote-entry/entry.component.ts" }` and the remote self-registers with `exposedModule: './RemoteEntry'`. This matches the scaffold default — nothing to configure.

**Named export — set `exposeAs` to match your federation key:**

```ts
import { Component } from '@angular/core';
import { NexusRemote } from '@bimo-dk/nexus-build';

@NexusRemote({ exposeAs: 'CheckoutPage' })
@Component({
  selector: 'app-checkout',
  template: `<h1>Checkout</h1>`,
})
export class CheckoutPageComponent {}
```

This generates `{ "./CheckoutPage": "..." }`. The remote self-registers with `exposedModule: './CheckoutPage'`. Use this whenever you expose the module under a key other than `./RemoteEntry` — for example when one remote exposes multiple components (`CartPage`, `MiniCart`).

:::important
`exposeAs` in the decorator must match the key in `federation.config.json`'s `exposes` block. If they diverge, the host loads the correct federation module but the registry stores the wrong `exposedModule`, and navigation will fail.
:::

## How auto-detection works

When `@NexusRemote()` has no options, identity is resolved in this order:

1. **Explicit option** — `@NexusRemote({ name: 'checkout' })` wins.
2. **`package.json#name`** — if it is valid camelCase. `@bimo-dk/checkout` becomes `checkout`.
3. **Class name** — `CheckoutComponent` → strip suffix `Component` / `Entry` → camelCase → `checkout`.

Route is derived from the name (camelCase → kebab-case): `checkoutPage` → `checkout-page`. Override with `@NexusRemote({ route: 'pay/checkout' })`.

## Decorator options

| Option | Type | Default | Notes |
|---|---|---|---|
| `name` | `string` | inferred | Remote name (camelCase) |
| `route` | `string` | inferred from `name` | Route path (kebab-case) |
| `exposeAs` | `string` | `'RemoteEntry'` | Key under `exposes` in `federation.config.json`. Must match the key the host uses to load the component. Set this whenever you deviate from the scaffold default (`./RemoteEntry`). |

The decorator returns the class untouched at runtime — it only stores metadata read by the CLI at build time.

## CLI

```bash
nexus-build                  # scan + write federation.config.json
nexus-build --dry-run        # print resolved config, do not write
nexus-build scan             # JSON of discovered remotes (for tooling)
nexus-build --root ./apps/checkout --src src
```

| Flag | Default | Description |
|---|---|---|
| `--root <dir>` | `cwd` | Project root |
| `--src <dir>` | `src` | Subfolder to scan |
| `--dry-run` | off | Do not write — print to stdout |

Exit codes are `0` on success, `1` on resolution error (duplicate `exposeAs`, missing class name, ...).

## Programmatic API

```ts
import { scanForRemotes, writeFederationConfig } from '@bimo-dk/nexus-build';

const remotes = await scanForRemotes({ projectRoot: process.cwd() });
const result = await writeFederationConfig(remotes, process.cwd(), {
  shared: { '@angular/core': { singleton: true, requiredVersion: 'auto' } },
});

console.log(result.config);
console.log(result.diff);   // before/after, useful in CI
```

## Conflict handling

- Same `exposeAs` declared by two files → error. Distinguish with `exposeAs`.
- Two decorators with different names but same `exposeAs` → error.
- `shared` already present in `federation.config.json` → preserved unless overridden via the API call's options.

## `@NexusComponent` — catalog metadata

A second decorator that ships in the same package. Stack it on the same class as `@NexusRemote()`:

```ts
import { NexusRemote, NexusComponent } from '@bimo-dk/nexus-build';

@NexusRemote({ exposeAs: 'OrderTable' })
@NexusComponent({
  title: 'Order Table',
  description: 'Paginated table of orders with status filter',
  category: 'data-display',
  tags: ['orders', 'commerce', 'table'],
  icon: 'shopping_cart',
  inputs: {
    filter:   { type: 'string',  default: 'all',    enum: ['all','open','closed'] },
    pageSize: { type: 'number',  default: 25 },
    readonly: { type: 'boolean', default: false },
  },
  experimental: false,
})
@Component({ /* ... */ })
export default class OrderTableComponent {}
```

The two decorators serve different purposes:

| Decorator | Produces | Read by |
|---|---|---|
| `@NexusRemote()` | `federation.config.json` entry under `exposes` | Native Federation at build time |
| `@NexusComponent({...})` | `catalog.json` entry | Portal `/catalog` page, `CatalogService`, IDEs |

You can use either independently — `@NexusComponent` without `@NexusRemote` produces a catalog entry but no federation exposure (useful for non-federated documentation), and vice versa.

### `NexusComponentOptions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | yes | Display name in the catalog UI |
| `description` | `string` | no | One-line description |
| `category` | `string` | no | Free-form grouping. Convention: `data-display`, `input`, `navigation`, `layout`, `feedback`, `chart` |
| `tags` | `string[]` | no | Free-form, used for filter/search |
| `icon` | `string` | no | Material icon name or single emoji |
| `inputs` | `Record<string, NexusInputSpec>` | no | Schema of `@Input()` the component accepts |
| `experimental` | `boolean` | no | If true, hidden from the default catalog view |

### `NexusInputSpec`

```ts
interface NexusInputSpec {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  default?: unknown;
  description?: string;
  required?: boolean;
  enum?: string[];          // for string inputs
}
```

### Generated `catalog.json`

```jsonc
// public/catalog.json — written next to federation.config.json
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
      "inputs": { /* spec mirror */ },
      "experimental": false
    }
  ]
}
```

The file is placed in `public/` so the remote's nginx serves it from `/catalog.json`. Override the path with `nexus-build --catalog-path <path>` if your build copies `public/` differently.

### Reading the metadata at runtime

```ts
import { getNexusComponentMetadata } from '@bimo-dk/nexus-build';

const meta = getNexusComponentMetadata(OrderTableComponent);
// { title: 'Order Table', tags: [...], inputs: {...}, ... }
```

The decorator stores the options via `Symbol.for('nexus.component')` so other packages can introspect a component class at runtime without re-importing the scanner.

See [component catalog](../workflows/component-catalog.md) for the full end-to-end story.

## Why `federation.config.js` stays

`federation.config.js` is Native Federation library convention. The CLI does not rewrite it; it rewrites the JSON the JS file requires:

```js
// federation.config.js — left alone
const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');
module.exports = withNativeFederation({
  ...require('./federation.config.json'),  // ← regenerated by nexus-build
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
});
```

This lets you keep using any Native Federation tooling that expects `federation.config.js` while still letting `nexus-build` own the source of truth.
