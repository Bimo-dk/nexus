---
id: create-remote-vue
title: Create a Vue remote
sidebar_position: 2
description: Step-by-step workflow to scaffold, build, and register a new Vue 3 micro frontend with a Nexus stack.
keywords:
  - Vue micro frontend
  - create Vue remote
  - micro frontend scaffold
  - bnx generate
---

# Create a Vue remote

The procedural recipe. For a runnable five-minute version see [quick-start-vue](../getting-started/quick-start-vue.md); for the deep-dive guide see [guide-vue-remote](../guides/guide-vue-remote.md).

## 1. Scaffold

```bash
bnx generate remote
? Remote name (camelCase): checkout
? Route path (kebab-case): checkout
? Framework: vue
```

## 2. Install

```bash
cd checkout
npm install     # or pnpm install / yarn install
```

## 3. Edit the entry component

`src/entry.vue`:

```vue
<template>
  <section><h1>Checkout</h1></section>
</template>

<script setup lang="ts"></script>
```

## 4. Verify vite.config.ts

```ts
import { nexusVite } from '@bimo-dk/nexus-build/vite';

export default defineConfig({
  plugins: [
    vue(),
    nexusVite({ name: 'checkout', exposes: { RemoteEntry: './src/entry.vue' } }),
  ],
});
```

## 5. Build

```bash
npm run build
```

Vite writes `dist/index.html`, `dist/assets/*`, `dist/remoteEntry.json`, and `dist/catalog.json` (if `catalog` entries were provided).

## 6. Containerize

```bash
docker build -t checkout-vue .
```

## 7. Run with self-registration

```bash
docker run --rm -p 8701:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://checkout-vue:80 \
  --network nexus_default \
  checkout-vue
```

## 8. Verify

```bash
bnx status
# Remotes
#   checkout (global)   enabled   /remotes/checkout/*
```

## 9. Wire into a host

Vue host's `routes.ts`:

```ts
nexusRoute({ path: '/checkout', remote: 'checkout', expose: 'RemoteEntry' })
```

Angular or React host — same registry, just use their respective helpers.

## Next

- [Workflows: zero-downtime](zero-downtime.md)
- [Guide: Vue remote](../guides/guide-vue-remote.md)
- [Guide: mixed-stack](../guides/guide-mixed-stack.md) — load this remote inside an Angular host.
