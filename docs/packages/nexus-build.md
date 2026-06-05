---
id: nexus-build
title: '@bimo-dk/nexus-build'
sidebar_position: 8
description: Build-time helpers for Nexus. NexusRemote and NexusComponent decorators for Angular, nexusVite plugin for Vue and React, nexus-build CLI.
keywords:
  - nexus-build
  - NexusRemote decorator
  - NexusComponent decorator
  - nexusVite plugin
  - federation config
---

# @bimo-dk/nexus-build

Build-time helpers for every framework Nexus supports. The package has three entry points:

- **Decorators** (`@NexusRemote`, `@NexusComponent`) — Angular.
- **Vite plugin** (`nexusVite`) — Vue and React.
- **CLI** (`nexus-build`) — runs the Angular scan/generation step.

It is browser-safe at the root entry; the Node-only parts (scanner, generator) live behind sub-entries.

## Install

```bash
npm install -D @bimo-dk/nexus-build
# pnpm add -D @bimo-dk/nexus-build
# yarn add -D @bimo-dk/nexus-build
```

## Angular decorators

```ts
import { NexusRemote, NexusComponent } from '@bimo-dk/nexus-build';

@NexusRemote()
@NexusComponent({
  title: 'Checkout',
  category: 'commerce',
  tags: ['checkout', 'cart'],
  inputs: {
    customerId: { type: 'string', required: true },
    showRecommendations: { type: 'boolean', default: true },
  },
})
@Component({ /* ... */ })
export default class CheckoutComponent {}
```

`@NexusRemote()` is read by the `nexus-build` CLI to generate `federation.config.json`. Resolution order for the remote name:

1. Explicit option: `@NexusRemote({ name: 'checkout' })`.
2. `package.json#name` (camelCase or `@scope/checkout`).
3. Class name minus `Component` / `Entry` suffix → camelCase.

The `route` is derived from the name (`checkoutPage` → `checkout-page`) unless `route` is set.

`@NexusComponent()` emits a catalog entry that shows up in the portal `/catalog` page.

| Decorator | Read at | Output |
|---|---|---|
| `@NexusRemote()` | build time (CLI) | `federation.config.json` |
| `@NexusRemote()` | runtime (Angular adapter) | self-registration payload |
| `@NexusComponent()` | build time | `catalog.json` entry |
| `@NexusComponent()` | runtime | `CatalogService` aggregation |

## Vite plugin (Vue / React)

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nexusVite } from '@bimo-dk/nexus-build/vite';

export default defineConfig({
  plugins: [
    vue(),
    nexusVite({
      name: 'checkout',
      exposes: { RemoteEntry: './src/entry.vue' },
      catalog: [
        {
          expose: 'RemoteEntry',
          title: 'Checkout',
          category: 'commerce',
          tags: ['checkout', 'cart'],
          inputs: {
            customerId: { type: 'string', required: true },
          },
        },
      ],
    }),
  ],
});
```

What the plugin does:

| Phase | What |
|---|---|
| `config()` | Defines `__NEXUS_REMOTE_NAME__`, `__NEXUS_EXPOSES__`, `__NEXUS_TOKEN__`, `__NEXUS_REGISTRY_URL__`. |
| `configureServer()` | Serves `/remoteEntry.json` in dev mode so a host can load you while iterating. |
| `generateBundle()` | Emits `remoteEntry.json` next to the built assets in `dist/`. |
| `closeBundle()` | Emits `catalog.json` when `catalog` entries were provided. |

The plugin works identically with `@vitejs/plugin-react`.

## CLI (`nexus-build`)

```bash
nexus-build                  # scan src/**/*.ts, write federation.config.json
nexus-build --dry-run        # print resolved config without writing
nexus-build scan             # list discovered remotes as JSON (no write)
nexus-build --root ./apps/checkout --src src
```

Typical wire-up:

```json
{
  "scripts": {
    "prebuild": "nexus-build",
    "build": "ng build"
  }
}
```

## Programmatic API

```ts
import { scanForRemotes, writeFederationConfig } from '@bimo-dk/nexus-build/scanner';

const remotes = await scanForRemotes({ projectRoot: process.cwd() });
const result = await writeFederationConfig(remotes, process.cwd(), {
  shared: { '@angular/core': { singleton: true, requiredVersion: 'auto' } },
});
console.log(result.config);
```

The `scanner` entry imports Node-only modules (`fs`, `path`, `typescript`). Don't import it from browser code.

## defineNexusConfig

A small helper for typed runtime config files used by the Vue and React templates.

```ts
import { defineNexusConfig } from '@bimo-dk/nexus-build';

export default defineNexusConfig({
  registryUrl: '/api',
  wsUrl: '/ws',
  staticBackupUrl: '/registry-backup.json',
});
```

## Conflict handling (Angular)

- Same `exposeAs` from two files → error. Set distinct `exposeAs` values.
- Two decorators with different names but same `exposeAs` → error.
- `shared` block already in `federation.config.json` → preserved unless you pass a `shared` override.

## Next

- [`@bimo-dk/nexus-cli`](nexus-cli.md) — `bnx` uses the scanner under the hood.
- [Guide: Angular remote](../guides/guide-angular-remote.md)
- [Guide: Vue remote](../guides/guide-vue-remote.md)
- [Guide: React remote](../guides/guide-react-remote.md)
