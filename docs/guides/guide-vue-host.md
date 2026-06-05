---
id: guide-vue-host
title: Guide — Vue host in depth
sidebar_position: 6
description: Build a Vue 3 host shell that loads federated remotes from Nexus. createNexusPlugin, nexusRoute, NexusComponent, useNexusRemote composable.
keywords:
  - Vue host
  - Vue micro frontend host
  - Vue 3 federation
  - createNexusPlugin
  - useNexusRemote
---

# Vue host in depth

A host is the application that loads remotes. This guide builds a Vue 3 host that loads remotes (Angular, Vue, or React) from a Nexus registry.

## Prerequisites

- A running Nexus stack with at least one remote registered.
- Node.js 22+, npm 10+.

## Install the packages

```bash
mkdir storefront-host && cd storefront-host
npm init -y
npm install vue vue-router
npm install @bimo-dk/nexus-runtime-vue @bimo-dk/nexus-client @bimo-dk/nexus-core
npm install -D vite @vitejs/plugin-vue typescript vue-tsc
```

## Bootstrap with one plugin

```ts
// src/main.ts
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

`createNexusPlugin` reads the registry at startup, opens the WebSocket, and re-adds routes whenever `remotes_changed` fires.

## Load remotes as routes

```ts
// src/routes.ts
import type { RouteRecordRaw } from 'vue-router';
import { nexusRoute } from '@bimo-dk/nexus-runtime-vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/catalog' },
  nexusRoute({ path: '/checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

`nexusRoute()` returns a vue-router route whose component is a `defineAsyncComponent` that resolves through the federation runtime. The component is cached and re-resolved on `remotes_changed`.

## Load remotes as drop-in components

```vue
<template>
  <NexusComponent
    remote="catalog"
    expose="ProductGrid"
    :inputs="{ category: 'electronics', limit: 12 }"
  />
</template>

<script setup lang="ts">
import { NexusComponent } from '@bimo-dk/nexus-runtime-vue';
</script>
```

The component handles loading and error states. It re-renders automatically when the registry broadcasts a change for its remote.

## Composables

```vue
<script setup lang="ts">
import { useNexusHost, useNexusRemote } from '@bimo-dk/nexus-runtime-vue';

const host = useNexusHost();
// host.online, host.remotes, host.refresh()

const checkout = useNexusRemote('checkout');
// checkout.component (async), checkout.loading, checkout.error
</script>

<template>
  <p v-if="!host.online">Registry unreachable</p>
  <component :is="checkout.component" v-if="checkout.component" />
</template>
```

`useNexusHost()` exposes the global host state. `useNexusRemote(name)` returns a reactive object for a single remote.

## Loading non-Vue remotes

A host can load Angular and React remotes too — but you need to render them outside Vue's reconciler. The pattern:

```vue
<template>
  <div ref="container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useNexusHost } from '@bimo-dk/nexus-runtime-vue';
import { loadRemoteModule } from '@softarc/native-federation-runtime';

const container = ref<HTMLElement | null>(null);
let detach: (() => void) | undefined;

onMounted(async () => {
  const mod = await loadRemoteModule({
    remoteEntry: '/remotes/orders/remoteEntry.json',
    exposedModule: './RemoteEntry',
  });
  // For a React remote, the default export is a React component:
  const ReactDOM = await import('react-dom/client');
  const React = await import('react');
  const root = ReactDOM.createRoot(container.value!);
  root.render(React.createElement(mod.default, { customerId: '42' }));
  detach = () => root.unmount();
});

onBeforeUnmount(() => detach?.());
</script>
```

For a typical cross-framework setup, prefer routing remotes by URL instead of inline mounting — each remote owns its own framework runtime and they coexist as separate React/Angular roots on the page.

## Common pitfalls

- **`useNexusHost is not a function`.** You imported from the wrong package. The Vue exports live under `@bimo-dk/nexus-runtime-vue`, not `@bimo-dk/nexus-runtime`.
- **Routes added twice.** `createNexusPlugin` deduplicates by remote name. If you also call `router.addRoute()` manually for the same remote, you'll see a warning.
- **Vue 3 reactivity inside a remote that came from Vue 2.** Don't try. Pin all remotes loaded into a Vue 3 host to Vue 3.

## Next

- [Guide: mixed-stack host](guide-mixed-stack.md)
- [Workflows: loading patterns](../workflows/loading-patterns.md)
- [Packages: nexus-runtime-vue](../packages/nexus-runtime-vue.md)
