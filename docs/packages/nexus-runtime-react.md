---
id: nexus-runtime-react
title: '@bimo-dk/nexus-runtime-react'
sidebar_position: 7
description: React 18 adapter for Nexus. NexusProvider, useNexusHost, useNexusRemote, useNexusComponent, NexusComponent, createNexusRoute, registerNexusRemote.
keywords:
  - nexus-runtime-react
  - React micro frontend
  - React 18
  - NexusProvider
  - useNexusComponent
---

# @bimo-dk/nexus-runtime-react

The React 18 adapter. Wraps `@bimo-dk/nexus-runtime-core` with React ergonomics: a provider, hooks, a drop-in component, and a router helper.

## Install

```bash
npm install @bimo-dk/nexus-runtime-react
# pnpm add @bimo-dk/nexus-runtime-react
# yarn add @bimo-dk/nexus-runtime-react
```

Peer dependencies: `react ^18.0.0`, `react-dom ^18.0.0`.

## Host bootstrap

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { NexusProvider } from '@bimo-dk/nexus-runtime-react';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <NexusProvider
    registryUrl="/api"
    wsUrl="/ws"
    token={import.meta.env.VITE_NEXUS_TOKEN ?? ''}
    staticBackupUrl="/registry-backup.json"
  >
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </NexusProvider>,
);
```

`NexusProvider` fetches the registry once, opens the WebSocket, and re-renders consumers on every `remotes_changed`.

## Remote bootstrap

```tsx
import { registerNexusRemote } from '@bimo-dk/nexus-runtime-react';

registerNexusRemote({
  name: 'checkout',
  url: '/remoteEntry.json',
  exposedModule: './RemoteEntry',
  routePath: 'checkout',
  registryUrl: '/api',
  token: process.env.NEXUS_TOKEN ?? '',
});
```

Posts the remote to the registry with retries. Call it once at the top of `main.tsx`.

## Hooks

```tsx
import { useNexusHost, useNexusRemote, useNexusComponent } from '@bimo-dk/nexus-runtime-react';

const { online, remotes, refresh } = useNexusHost();

const remote = useNexusRemote('checkout');
// { module, loading, error, version }

const { Component, loading, error } = useNexusComponent({
  remote: 'checkout',
  expose: 'RemoteEntry',
});
```

`useNexusHost` returns global host state. `useNexusRemote(name)` returns the resolved module. `useNexusComponent` returns a ready-to-render component reference plus async state.

## Route helper

```tsx
import { createNexusRoute } from '@bimo-dk/nexus-runtime-react';

const CheckoutRoute = createNexusRoute({ remote: 'checkout', expose: 'RemoteEntry' });

<Route path="/checkout/*" element={<CheckoutRoute customerId="42" />} />
```

The returned component resolves on first render, caches the resolved component, and re-resolves when the registry broadcasts a change. Props are forwarded.

## NexusComponent

```tsx
import { NexusComponent } from '@bimo-dk/nexus-runtime-react';

<NexusComponent
  remote="catalog"
  expose="ProductGrid"
  props={{ category: 'electronics' }}
  fallback={<p>Loading…</p>}
  onError={(err) => console.error('catalog failed', err)}
/>
```

## Exports

| Export | Purpose |
|---|---|
| `NexusProvider` | Top-level provider for host bootstrap. |
| `NexusProviderProps` | Props type. |
| `NexusContext` | The React context (advanced — usually you use the hooks). |
| `NexusContextValue` | Type of the context value. |
| `useNexusHost()` | Hook — global host state. |
| `useNexusRemote(name)` | Hook — single remote state. |
| `useNexusComponent({remote, expose})` | Hook — resolved component + async state. |
| `NexusHostState` | Type for `useNexusHost`'s return. |
| `NexusComponent` | Drop-in component. |
| `NexusComponentProps` | Props type. |
| `createNexusRoute(options)` | Returns a React component for route-based mounting. |
| `registerNexusRemote(options)` | Self-registration call for remotes. |

## Next

- [Guide: React remote in depth](../guides/guide-react-remote.md)
- [Guide: React host in depth](../guides/guide-react-host.md)
- [`@bimo-dk/nexus-build`](nexus-build.md) — `nexusVite` plugin for the build side.
