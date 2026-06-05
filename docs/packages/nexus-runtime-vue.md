---
id: nexus-runtime-vue
title: '@bimo-dk/nexus-runtime-vue'
sidebar_position: 6
description: Vue 3 adapter for Nexus. createNexusPlugin, useNexusHost, useNexusRemote, NexusComponent, nexusRoute, VueNexusRemotePlugin.
keywords:
  - nexus-runtime-vue
  - Vue micro frontend
  - Vue 3
  - createNexusPlugin
  - useNexusRemote
---

# @bimo-dk/nexus-runtime-vue

The Vue 3 adapter. Wraps `@bimo-dk/nexus-runtime-core` with Vue ergonomics: a Vue plugin, composables, a `<NexusComponent>` component, and a vue-router helper.

## Install

```bash
npm install @bimo-dk/nexus-runtime-vue
# pnpm add @bimo-dk/nexus-runtime-vue
# yarn add @bimo-dk/nexus-runtime-vue
```

Peer dependency: `vue ^3.0.0`.

## Host bootstrap

```ts
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createNexusPlugin } from '@bimo-dk/nexus-runtime-vue';
import App from './App.vue';
import { routes } from './routes';

const router = createRouter({ history: createWebHistory(), routes });

const app = createApp(App);
app.use(router);
app.use(createNexusPlugin({
  registryUrl: '/api',
  wsUrl: '/ws',
  token: import.meta.env.VITE_NEXUS_TOKEN ?? '',
  staticBackupUrl: '/registry-backup.json',
}));
app.mount('#app');
```

`createNexusPlugin` fetches `/api/remotes`, opens the WebSocket, and re-adds routes when the registry broadcasts changes.

## Remote bootstrap

```ts
import { createApp } from 'vue';
import { registerNexusRemote } from '@bimo-dk/nexus-runtime-vue';
import App from './app.vue';

registerNexusRemote({
  name: 'checkout',
  url: '/remoteEntry.json',
  exposedModule: './RemoteEntry',
  routePath: 'checkout',
  registryUrl: '/api',
  token: process.env.NEXUS_TOKEN ?? '',
});

createApp(App).mount('#app');
```

`registerNexusRemote` is the Vue-flavored wrapper around `SelfRegistrationService`. The first call posts the remote to the registry with retries.

There is also `VueNexusRemotePlugin` for the plugin pattern:

```ts
app.use(VueNexusRemotePlugin, { name, url, exposedModule, routePath, ... });
```

## Route helper

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime-vue';
import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  nexusRoute({ path: '/checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

Returns a vue-router record whose component is a `defineAsyncComponent` that resolves through the federation runtime.

## Composables

```ts
import { useNexusHost, useNexusRemote } from '@bimo-dk/nexus-runtime-vue';

const host = useNexusHost();
// host.online, host.remotes, host.refresh()

const checkout = useNexusRemote('checkout');
// checkout.component (reactive component ref), checkout.loading, checkout.error
```

`useNexusHost()` exposes the global host state. `useNexusRemote(name)` returns reactive references for a single remote.

## NexusComponent

```vue
<template>
  <NexusComponent
    remote="catalog"
    expose="ProductGrid"
    :inputs="{ category: 'electronics' }"
  />
</template>

<script setup lang="ts">
import { NexusComponent } from '@bimo-dk/nexus-runtime-vue';
</script>
```

Handles loading and error states. Re-resolves on `remotes_changed`.

## Exports

| Export | Purpose |
|---|---|
| `createNexusPlugin(options)` | Vue plugin for host bootstrap. |
| `NexusPluginOptions` | Options type. |
| `NexusPluginState` | Reactive state shape exposed via the plugin. |
| `registerNexusRemote(options)` | Convenience function for remote self-registration. |
| `VueNexusRemotePlugin` | Vue plugin equivalent of `registerNexusRemote`. |
| `useNexusHost()` | Composable — global host state. |
| `useNexusRemote(name)` | Composable — single remote state. |
| `NexusHostComposable` | Return type of `useNexusHost`. |
| `NexusComponent` | Drop-in component. |
| `nexusRoute(options)` | vue-router helper. |
| `NexusRouteOptions` | Options type. |

## Next

- [Guide: Vue remote in depth](../guides/guide-vue-remote.md)
- [Guide: Vue host in depth](../guides/guide-vue-host.md)
- [`@bimo-dk/nexus-build`](nexus-build.md) — `nexusVite` plugin for the build side.
