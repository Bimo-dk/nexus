---
id: quick-start-react
title: Quick start — React remote
sidebar_position: 8
description: Build, register, and load a React 18 micro frontend with Nexus in five minutes. Includes the nexusVite plugin, registration, and verification.
keywords:
  - React micro frontend
  - React 18 micro frontend
  - micro frontend quick start
  - Nexus React
  - Vite micro frontend
---

# Quick start — React remote

Five minutes from `bnx generate remote` to a running React 18 micro frontend registered with a Nexus stack.

## Prerequisites

- A running Nexus stack (see [Installation](installation.md)).
- `@bimo-dk/nexus-cli` installed globally — `npm install -g @bimo-dk/nexus-cli`.
- `NEXUS_TOKEN` and `REGISTRY_URL` exported in your shell (or stored in `.env`).

## 1. Scaffold

```bash
bnx generate remote
? Remote name (camelCase): checkout
? Route path (kebab-case): checkout
? Framework: react
```

This clones `nexus-remote-templat-react` into `./checkout` and pre-fills your name and route.

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
├── app.tsx          # your local shell (only used when running standalone)
├── entry.tsx        # your micro frontend's root — exposed as ./RemoteEntry
└── main.tsx         # bootstrap
```

The entry component:

```tsx
// src/entry.tsx
import React, { useState } from 'react';

export default function RemoteEntry(): React.ReactElement {
  const [count, setCount] = useState(0);
  return (
    <section className="checkout">
      <h1>Checkout</h1>
      <p>Items in cart: {count}</p>
      <button onClick={() => setCount((n) => n + 1)}>Add item</button>
    </section>
  );
}
```

The bootstrap registers the remote and mounts the standalone shell:

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerNexusRemote } from '@bimo-dk/nexus-runtime-react';
import App from './app.js';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

## 3. The Vite config

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nexusVite } from '@bimo-dk/nexus-build/vite';

export default defineConfig({
  plugins: [
    react(),
    nexusVite({
      name: 'checkout',
      exposes: { RemoteEntry: './src/entry.tsx' },
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
      input: { index: './index.html', RemoteEntry: './src/entry.tsx' },
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

Vite produces `dist/index.html`, `dist/assets/*`, `dist/remoteEntry.json`, and `dist/catalog.json`.

## 5. Run and register

```bash
docker build -t checkout-remote-react --secret id=npmrc,src=$HOME/.npmrc .
docker run --rm -p 8702:80 \
  -e REGISTRY_INTERNAL_URL=http://host.docker.internal:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://host.docker.internal:8702 \
  checkout-remote-react
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
#   checkout (global)      enabled   /remotes/checkout/*  http://host.docker.internal:8702
```

Open the gateway URL — the new route is live at `/checkout`.

## Use the remote from any host

In a React host:

```tsx
import { createNexusRoute } from '@bimo-dk/nexus-runtime-react';

const CheckoutRoute = createNexusRoute({ remote: 'checkout', expose: 'RemoteEntry' });
```

In an Angular host:

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes = [
  nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

In a Vue host:

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime-vue';
// register in createRouter()
```

## Next

- [Guide: React remote in depth](../guides/guide-react-remote.md)
- [Guide: mixed-stack host](../guides/guide-mixed-stack.md)
- [Packages: nexus-runtime-react](../packages/nexus-runtime-react.md)
