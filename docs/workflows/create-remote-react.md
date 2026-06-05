---
id: create-remote-react
title: Create a React remote
sidebar_position: 3
description: Step-by-step workflow to scaffold, build, and register a new React 18 micro frontend with a Nexus stack.
keywords:
  - React micro frontend
  - create React remote
  - micro frontend scaffold
  - bnx generate
---

# Create a React remote

The procedural recipe. For a runnable five-minute version see [quick-start-react](../getting-started/quick-start-react.md); for the deep-dive guide see [guide-react-remote](../guides/guide-react-remote.md).

## 1. Scaffold

```bash
bnx generate remote
? Remote name (camelCase): checkout
? Route path (kebab-case): checkout
? Framework: react
```

## 2. Install

```bash
cd checkout
npm install     # or pnpm install / yarn install
```

## 3. Edit the entry component

`src/entry.tsx`:

```tsx
import React from 'react';

export default function RemoteEntry(): React.ReactElement {
  return <section><h1>Checkout</h1></section>;
}
```

## 4. Verify vite.config.ts

```ts
import { nexusVite } from '@bimo-dk/nexus-build/vite';

export default defineConfig({
  plugins: [
    react(),
    nexusVite({ name: 'checkout', exposes: { RemoteEntry: './src/entry.tsx' } }),
  ],
});
```

## 5. Build

```bash
npm run build
```

## 6. Containerize

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t checkout-react .
```

## 7. Run with self-registration

```bash
docker run --rm -p 8702:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://checkout-react:80 \
  --network nexus_default \
  checkout-react
```

## 8. Verify

```bash
bnx status
# Remotes
#   checkout (global)   enabled   /remotes/checkout/*
```

## 9. Wire into a host

React host:

```tsx
import { createNexusRoute } from '@bimo-dk/nexus-runtime-react';

const Checkout = createNexusRoute({ remote: 'checkout', expose: 'RemoteEntry' });

<Route path="/checkout/*" element={<Checkout />} />
```

Angular or Vue host — same registry, use the respective adapter helpers.

## Next

- [Workflows: zero-downtime](zero-downtime.md)
- [Guide: React remote](../guides/guide-react-remote.md)
- [Guide: mixed-stack](../guides/guide-mixed-stack.md) — load this remote inside an Angular host.
