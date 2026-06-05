---
id: guide-vue-remote
title: Guide — Vue remote in depth
sidebar_position: 3
description: Build a Vue 3 micro frontend with Nexus from scratch. nexusVite plugin, the VueNexusRemotePlugin, the full Docker build, and the production deploy.
keywords:
  - Vue micro frontend
  - Vue 3 micro frontend
  - Vite micro frontend
  - module federation Vue
  - micro frontend platform
---

# Vue remote in depth

This guide takes you from an empty directory to a production-ready Vue 3 micro frontend registered with Nexus. The [quick start](../getting-started/quick-start-vue.md) is the five-minute version; this one shows every file and explains the moving parts.

## Prerequisites

- Node.js 22+, npm 10+, Docker with BuildKit.
- A running Nexus stack — `docker compose up` from the `nexus` repo.
- A GitHub PAT with `read:packages` scope, saved in `~/.npmrc`.

## Install the packages

```bash
mkdir checkout && cd checkout
npm init -y
npm install vue
npm install @bimo-dk/nexus-runtime-vue @bimo-dk/nexus-build
npm install -D vite @vitejs/plugin-vue typescript vue-tsc @types/node
```

Equivalent for pnpm and yarn: swap `npm install` for `pnpm add` / `yarn add` (and `-D` becomes `--save-dev` / `-D`).

## Expose your entry component

```vue
<!-- src/entry.vue -->
<template>
  <section class="checkout">
    <h1>Checkout</h1>
    <p>Items in cart: {{ count }}</p>
    <button @click="add">Add item</button>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ customerId: string; showRecommendations?: boolean }>();
const count = ref(0);
const add = () => count.value++;
</script>
```

This file is what gets exposed as `./RemoteEntry`. A host loads it and renders it as a normal Vue component, passing `customerId` and `showRecommendations` as props.

## Bootstrap

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

`registerNexusRemote()` is exported from `@bimo-dk/nexus-runtime-vue` but is framework-agnostic underneath. The Vue package wraps the runtime-core's `SelfRegistrationService`.

The `__NEXUS_*__` constants are substituted by the `nexusVite` plugin at build time. Defining them at the top with `declare const` keeps TypeScript happy.

## The Vite config

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
          tags: ['checkout', 'cart'],
          inputs: {
            customerId: { type: 'string', required: true },
            showRecommendations: { type: 'boolean', default: true },
          },
        },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        index: './index.html',
        RemoteEntry: './src/entry.vue',
      },
    },
  },
  server: { port: 8701, host: '0.0.0.0' },
});
```

The plugin:

| Hook | What it does |
|---|---|
| `config()` | Defines `__NEXUS_REMOTE_NAME__`, `__NEXUS_EXPOSES__`, `__NEXUS_TOKEN__`, `__NEXUS_REGISTRY_URL__`. |
| `configureServer()` | Serves `/remoteEntry.json` in `vite dev` so a host can load the in-progress remote. |
| `generateBundle()` | Emits `remoteEntry.json` next to the built assets in `dist/`. |
| `closeBundle()` | Emits `catalog.json` when `catalog` entries are provided. |

## index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Checkout (standalone)</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

This file is only used when you run the remote standalone (`npm run dev`). A host bypasses it entirely and loads `remoteEntry.json` directly.

## Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.6
FROM ghcr.io/bimo-dk/nexus-base:latest AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --prefer-offline
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

The same BuildKit secret pattern as Angular — the `.npmrc` is never persisted in image layers.

## Run and verify

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t checkout-vue .
docker run --rm -p 8701:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://checkout-vue:80 \
  --network nexus_default \
  checkout-vue

bnx status
# Remotes
#   checkout (global)      enabled   /remotes/checkout/*
```

## Using composables in a Vue host

```ts
import { useNexusRemote } from '@bimo-dk/nexus-runtime-vue';

const remote = useNexusRemote('checkout');
// remote.loading, remote.component, remote.error
```

```vue
<template>
  <component v-if="remote.component" :is="remote.component" :customerId="user.id" />
  <p v-else-if="remote.loading">Loading…</p>
  <p v-else-if="remote.error">Failed to load checkout</p>
</template>
```

`useNexusRemote()` resolves the federation entry through `runtime-core`, returns a reactive component reference, and re-resolves automatically when the registry broadcasts a change.

## Common pitfalls

- **`@vitejs/plugin-vue` not installed.** Vite refuses to handle `.vue` files. Install it.
- **`createApp` runs twice.** When mounted by a host, your remote's `main.ts` does not run — only `entry.vue` is loaded. Side-effects in `main.ts` are skipped on purpose.
- **Pinia / Vue Router conflicts across remotes.** Each remote ships its own Vue instance. Share state through the host, not through globals.
- **CORS on `/remoteEntry.json`.** The gateway serves it from your domain; if you bypass the gateway in dev, ensure your dev server allows the host's origin.

## Next

- [Guide: Vue host](guide-vue-host.md) — load this remote.
- [Guide: mixed-stack](guide-mixed-stack.md) — load this remote inside an Angular host.
- [Packages: nexus-runtime-vue](../packages/nexus-runtime-vue.md)
