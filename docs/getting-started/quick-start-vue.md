---
id: quick-start-vue
title: Quick start — Vue remote
sidebar_position: 7
description: Build, register, and load a Vue 3 micro frontend with Nexus in five minutes. Includes the nexusVite plugin, registration, and verification.
keywords:
  - Vue micro frontend
  - Vue 3 micro frontend
  - micro frontend quick start
  - Nexus Vue
  - Vite micro frontend
---

# Quick start — Vue remote

Five minutes from `bnx generate remote` to a running Vue 3 micro frontend registered with a Nexus stack.

## Prerequisites

- A running Nexus stack (see [Installation](installation.md)).
- `@bimo-dk/nexus-cli` installed globally — `npm install -g @bimo-dk/nexus-cli`.
- `NEXUS_TOKEN` and `REGISTRY_URL` exported in your shell (or stored in `.env`).

## 1. Scaffold

```bash
bnx generate remote
? Remote name (camelCase): checkout
? Route path (kebab-case): checkout
? Framework: vue
```

This clones `nexus-remote-templat-vue` into `./checkout` and pre-fills your name and route.

## 2. Install and bootstrap

```bash
cd checkout
npm install
# pnpm equivalent: pnpm install
# yarn equivalent: yarn install
```

The scaffold ships three files you will actually edit:

```
src/
├── app.vue          # your local shell (only used when running standalone)
├── entry.vue        # your micro frontend's root — exposed as ./RemoteEntry
└── main.ts          # bootstrap
```

The entry component:

```vue
<!-- src/entry.vue -->
<template>
  <section class="checkout">
    <h1>Checkout</h1>
    <p>Items in cart: {{ count }}</p>
    <button @click="count++">Add item</button>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>
```

The bootstrap registers the remote with Nexus and mounts the standalone shell:

```ts
// src/main.ts
import { createApp } from 'vue';
import { registerNexusRemote } from '@bimo-dk/nexus-runtime-vue';
import App from './app.vue';

declare const __NEXUS_REMOTE_NAME__: string;
declare const __NEXUS_TOKEN__: string;
declare const __NEXUS_REGISTRY_URL__: string;

registerNexusRemote({
  name: __NEXUS_REMOTE_NAME__,
  url: `${window.location.origin}/remoteEntry.json`,
  exposedModule: './RemoteEntry',
  routePath: 'checkout',
  registryUrl: __NEXUS_REGISTRY_URL__,
  token: __NEXUS_TOKEN__,
});

createApp(App).mount('#app');
```

`registerNexusRemote()` posts the remote to the registry at startup. The four `__NEXUS_*__` globals are substituted at build time by the `nexusVite` plugin (see `vite.config.ts`).

## 3. The Vite config

```ts
// vite.config.ts
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
          description: 'Cart review and payment.',
          category: 'commerce',
          tags: ['checkout', 'cart', 'payment'],
        },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      input: { index: './index.html', RemoteEntry: './src/entry.vue' },
    },
  },
});
```

The `nexusVite` plugin:

- Defines `__NEXUS_*__` build-time constants.
- Serves `/remoteEntry.json` in dev mode so a host can load you while you're iterating.
- Emits `remoteEntry.json` in `dist/` at build time.
- Emits `catalog.json` if you supplied catalog entries.

## 4. Build

```bash
npm run build
```

You should see Vite produce `dist/index.html`, `dist/assets/*`, `dist/remoteEntry.json`, and `dist/catalog.json`.

## 5. Run and register

```bash
docker build -t checkout-remote-vue --secret id=npmrc,src=$HOME/.npmrc .
docker run --rm -p 8701:80 \
  -e REGISTRY_INTERNAL_URL=http://host.docker.internal:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://host.docker.internal:8701 \
  checkout-remote-vue
```

In your Nexus stack's logs you should see:

```
[registry] POST /api/remotes        201 Created  remote=checkout
[registry] broadcast remotes_changed trigger=add:checkout
[gateway] route table updated       added=/remotes/checkout/*
```

## 6. Verify

```bash
bnx status
# Remotes
#   checkout (global)      enabled   /remotes/checkout/*  http://host.docker.internal:8701
```

Open the gateway URL — the new route is live at `/checkout`.

## Use the remote from any host

In a Vue host:

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime-vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    nexusRoute({ path: '/checkout', remote: 'checkout', expose: 'RemoteEntry' }),
  ],
});
```

In an Angular host (yes — cross-framework):

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes = [
  nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

In a React host:

```tsx
import { createNexusRoute } from '@bimo-dk/nexus-runtime-react';
const CheckoutRoute = createNexusRoute({ remote: 'checkout', expose: 'RemoteEntry' });
```

The remote does not know or care which host loads it.

## Next

- [Guide: Vue remote in depth](../guides/guide-vue-remote.md)
- [Guide: mixed-stack host](../guides/guide-mixed-stack.md)
- [Packages: nexus-runtime-vue](../packages/nexus-runtime-vue.md)
