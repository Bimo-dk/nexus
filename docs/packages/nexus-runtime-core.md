---
id: nexus-runtime-core
title: '@bimo-dk/nexus-runtime-core'
sidebar_position: 4
description: Framework-agnostic loading and registration engine for Nexus remotes. Used by every framework adapter (Angular, Vue, React).
keywords:
  - nexus-runtime-core
  - micro frontend loader
  - module federation runtime
  - native federation
---

# @bimo-dk/nexus-runtime-core

The framework-agnostic engine that every Nexus framework adapter is built on. If you're writing the Angular, Vue, or React app, you don't use this package directly — but you do use it transitively, and if you want to add support for a fourth framework (Svelte, Solid, …) you'd build on top of this surface.

## Install

```bash
npm install @bimo-dk/nexus-runtime-core
# pnpm add @bimo-dk/nexus-runtime-core
# yarn add @bimo-dk/nexus-runtime-core
```

Usually transitive via `@bimo-dk/nexus-runtime`, `@bimo-dk/nexus-runtime-vue`, or `@bimo-dk/nexus-runtime-react`.

## Exports

| Export | Purpose |
|---|---|
| `NexusLoader` | Resolves federation manifests, loads exposed modules, caches by `(remote, expose)`. |
| `PreloadSpec` | Type — pre-warms specific remotes at host startup. |
| `SelfRegistrationService` | Posts a remote to the registry at startup with configurable retries. |
| `RegisterOptions` | Options for `SelfRegistrationService.register()`. |
| `FallbackChain` | Three-layer chain: live registry → sessionStorage cache → static backup URL. |
| `ReconnectManager` | WebSocket reconnect with policy from the `welcome` frame. |
| `GatewayConfigReader` | Reads `window.__NEXUS_GATEWAY_CONFIG__` injected by the gateway's SPA at runtime. |

## Loader

```ts
import { NexusLoader } from '@bimo-dk/nexus-runtime-core';

const loader = new NexusLoader();

const Component = await loader.load({
  remote: 'checkout',
  expose: 'RemoteEntry',
  remotes: registryRemoteList,    // current snapshot
});
```

`NexusLoader.load()` looks up the remote by name in the snapshot, resolves the federation manifest, calls `loadRemoteModule`, and returns whatever the exposed module's `default` export is. The framework adapter renders it.

The loader caches by `(remote, expose)`. When the registry broadcasts `remotes_changed`, the framework adapter clears the cache for affected remotes.

## Self-registration

```ts
import { SelfRegistrationService } from '@bimo-dk/nexus-runtime-core';

const svc = new SelfRegistrationService({
  registryUrl: '/api',
  token: '...',
});

await svc.register({
  name: 'checkout',
  url: '/remotes/checkout/remoteEntry.json',
  exposedModule: './RemoteEntry',
  routePath: 'checkout',
  visibility: 'global',
  upstreamUrl: 'http://checkout-container:80',
});
```

Retries with exponential backoff on transient errors. The adapter packages wrap this in their bootstrap helpers (`provideNexusRemote`, `registerNexusRemote`).

## Fallback chain

```ts
import { FallbackChain } from '@bimo-dk/nexus-runtime-core';

const chain = new FallbackChain({
  registryUrl: '/api',
  token: '...',
  staticBackupUrl: '/registry-backup.json',
});

const remotes = await chain.fetchRemotes();
// 1. live registry. 2. sessionStorage cache. 3. static backup.
```

Returns the first successful layer. Stores successful live fetches into `sessionStorage` for the next page.

## Reconnect manager

```ts
import { ReconnectManager } from '@bimo-dk/nexus-runtime-core';

const mgr = new ReconnectManager({
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 250,
  maxAttempts: 0,
});

mgr.scheduleReconnect(() => ws.connect());
```

The framework adapters wire the WebSocket `welcome.reconnect_policy` into this manager so a policy change in the portal hot-applies to every client.

## Adding a fourth framework

If you wanted a Svelte adapter:

1. Use `NexusLoader` to resolve components.
2. Use `SelfRegistrationService` for remote bootstrap.
3. Use `FallbackChain` for host bootstrap.
4. Wrap with Svelte-idiomatic ergonomics (a Svelte store + a `<NexusComponent>` Svelte component).
5. Publish as `@bimo-dk/nexus-runtime-svelte` (or vendor-local).

The Angular, Vue, and React adapters are between 200 and 400 lines each — most of the work is in `runtime-core`.

## Next

- [`@bimo-dk/nexus-runtime`](nexus-runtime.md) — Angular adapter.
- [`@bimo-dk/nexus-runtime-vue`](nexus-runtime-vue.md) — Vue adapter.
- [`@bimo-dk/nexus-runtime-react`](nexus-runtime-react.md) — React adapter.
