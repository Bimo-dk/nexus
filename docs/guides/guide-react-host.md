---
id: guide-react-host
title: Guide — React host in depth
sidebar_position: 7
description: Build a React 18 host shell that loads federated remotes from Nexus. NexusProvider, useNexusComponent, useNexusHost, createNexusRoute.
keywords:
  - React host
  - React micro frontend host
  - React 18 federation
  - NexusProvider
  - useNexusComponent
---

# React host in depth

A host is the application that loads remotes. This guide builds a React 18 host that loads remotes (Angular, Vue, or React) from a Nexus registry.

## Prerequisites

- A running Nexus stack with at least one remote registered.
- Node.js 22+, npm 10+.

## Install the packages

```bash
mkdir storefront-host && cd storefront-host
npm init -y
npm install react react-dom react-router-dom
npm install @bimo-dk/nexus-runtime-react @bimo-dk/nexus-client @bimo-dk/nexus-core
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

## Bootstrap with the provider

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { NexusProvider } from '@bimo-dk/nexus-runtime-react';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NexusProvider
      registryUrl="/api"
      wsUrl="/ws"
      token={import.meta.env.VITE_NEXUS_TOKEN ?? ''}
      staticBackupUrl="/registry-backup.json"
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </NexusProvider>
  </React.StrictMode>,
);
```

`NexusProvider`:

- Fetches `/api/remotes` once at mount.
- Subscribes to `/ws` for live updates.
- Caches results to `sessionStorage` as fallback.
- Falls back to `staticBackupUrl` if both fail.

It provides everything underneath via context.

## Read host state

```tsx
import { useNexusHost } from '@bimo-dk/nexus-runtime-react';

export function StatusBar() {
  const { online, remotes, refresh } = useNexusHost();
  return (
    <header>
      {online ? 'Registry online' : 'Registry offline'} — {remotes.length} remotes
      <button onClick={refresh}>Refresh</button>
    </header>
  );
}
```

## Load a remote as a route

```tsx
// src/App.tsx
import { Route, Routes } from 'react-router-dom';
import { createNexusRoute } from '@bimo-dk/nexus-runtime-react';
import { Home } from './Home.js';

const CheckoutRoute = createNexusRoute({ remote: 'checkout', expose: 'RemoteEntry' });

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/checkout/*" element={<CheckoutRoute customerId="42" />} />
    </Routes>
  );
}
```

`createNexusRoute` returns a React component that resolves the remote on first render, caches it, and re-resolves on `remotes_changed`. Props are forwarded to the loaded component.

## Load a remote as a drop-in component

```tsx
import { NexusComponent } from '@bimo-dk/nexus-runtime-react';

export function HomePage() {
  return (
    <NexusComponent
      remote="catalog"
      expose="ProductGrid"
      props={{ category: 'electronics', limit: 12 }}
      fallback={<p>Loading catalog…</p>}
      onError={(err) => console.error('catalog failed', err)}
    />
  );
}
```

## Programmatic hook

```tsx
import { useNexusComponent } from '@bimo-dk/nexus-runtime-react';

export function CheckoutPage() {
  const { Component, loading, error } = useNexusComponent({
    remote: 'checkout',
    expose: 'RemoteEntry',
  });

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Failed: {error.message}</p>;
  return <Component customerId="42" />;
}
```

## Loading non-React remotes

A React host can load Angular and Vue remotes — but you need to render them outside React's reconciler:

```tsx
import { useEffect, useRef } from 'react';
import { useNexusRemote } from '@bimo-dk/nexus-runtime-react';

export function OrdersWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const remote = useNexusRemote('orders');

  useEffect(() => {
    if (!remote.module || !containerRef.current) return;
    // Vue remote: createApp(remote.module.default).mount(containerRef.current);
    // Angular remote: createApplication({ providers: [...] }).then(...)
    return () => { /* unmount */ };
  }, [remote.module]);

  return <div ref={containerRef} />;
}
```

For most setups, route-based federation keeps each framework in its own container and avoids this complexity.

## Sharing state across remotes

Use the host's React context for shared session state (user, locale, theme). Cross-framework remotes can pick it up by reading a `window`-level event-emitter that the host exposes — see [workflows: loading patterns](../workflows/loading-patterns.md).

## Common pitfalls

- **Two React instances.** A React remote loaded into a React host needs to share React 18. Mark `react` and `react-dom` as externals in the remote's Vite config and provide them from the host.
- **`useNexusHost is not a function`.** You forgot to wrap your app in `<NexusProvider>`, or imported from the wrong package.
- **Component never re-renders on `remotes_changed`.** `createNexusRoute` and `useNexusComponent` handle this; manual `useNexusRemote` usage requires you to react to the version in the returned object.

## Next

- [Guide: mixed-stack host](guide-mixed-stack.md)
- [Workflows: loading patterns](../workflows/loading-patterns.md)
- [Packages: nexus-runtime-react](../packages/nexus-runtime-react.md)
