---
id: guide-react-remote
title: Guide — React remote in depth
sidebar_position: 4
description: Build a React 18 micro frontend with Nexus from scratch. nexusVite plugin, registerNexusRemote, the full Docker build, and the production deploy.
keywords:
  - React micro frontend
  - React 18 micro frontend
  - Vite micro frontend
  - module federation React
  - micro frontend platform
---

# React remote in depth

This guide takes you from an empty directory to a production-ready React 18 micro frontend registered with Nexus. The [quick start](../getting-started/quick-start-react.md) is the five-minute version; this one walks through every file.

## Prerequisites

- Node.js 22+, npm 10+, Docker with BuildKit.
- A running Nexus stack — `docker compose up` from the `nexus` repo.
- A GitHub PAT with `read:packages` scope, saved in `~/.npmrc`.

## Install the packages

```bash
mkdir checkout && cd checkout
npm init -y
npm install react react-dom
npm install @bimo-dk/nexus-runtime-react @bimo-dk/nexus-build
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node
```

`pnpm add` and `yarn add` work identically.

## Expose your entry component

```tsx
// src/entry.tsx
import React, { useState } from 'react';

interface CheckoutProps {
  customerId: string;
  showRecommendations?: boolean;
}

export default function RemoteEntry({
  customerId,
  showRecommendations = true,
}: CheckoutProps): React.ReactElement {
  const [count, setCount] = useState(0);
  return (
    <section className="checkout">
      <h1>Checkout for {customerId}</h1>
      <p>Items in cart: {count}</p>
      <button onClick={() => setCount((n) => n + 1)}>Add item</button>
      {showRecommendations && <p>Recommendations…</p>}
    </section>
  );
}
```

The `default` export is what gets exposed as `./RemoteEntry`. Props are passed by the host.

## Bootstrap

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

When the host loads this remote, only `entry.tsx` is evaluated — `main.tsx` and `app.tsx` never run.

## The Vite config

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
        RemoteEntry: './src/entry.tsx',
      },
    },
  },
  server: { port: 8702, host: '0.0.0.0' },
});
```

## index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Checkout (standalone)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

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

## Run and verify

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t checkout-react .
docker run --rm -p 8702:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://checkout-react:80 \
  --network nexus_default \
  checkout-react

bnx status
# Remotes
#   checkout (global)      enabled   /remotes/checkout/*
```

## Using hooks in a React host

```tsx
import { useNexusComponent, useNexusRemote } from '@bimo-dk/nexus-runtime-react';

export function CheckoutPage() {
  const { Component, loading, error } = useNexusComponent({
    remote: 'checkout',
    expose: 'RemoteEntry',
  });

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Failed to load checkout</p>;
  return <Component customerId="42" />;
}
```

`useNexusComponent` resolves the federation entry through `runtime-core`, returns the loaded component, and re-resolves when the registry broadcasts a change.

## Common pitfalls

- **`react` and `react-dom` not deduplicated.** When loaded into a React host, sharing the React copy matters. Vite handles this via its dependency graph; if you see two React instances, check the host's `optimizeDeps` config.
- **Hooks fail with "invalid hook call".** Usually means the remote bundled its own React. Mark `react` and `react-dom` as `external` in the host's rollup config and ensure the host provides them.
- **`useNexusComponent` returns null indefinitely.** The remote isn't registered. Check `bnx status` and the registry logs.

## Next

- [Guide: React host](guide-react-host.md) — load this remote.
- [Guide: mixed-stack](guide-mixed-stack.md) — load this remote inside an Angular host.
- [Packages: nexus-runtime-react](../packages/nexus-runtime-react.md)
