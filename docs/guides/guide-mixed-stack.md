---
id: guide-mixed-stack
title: Guide — Angular host loading Vue and React remotes
sidebar_position: 1
description: End-to-end flagship walkthrough. Build an Angular host that loads a Vue remote and a React remote side by side, registered in one Nexus stack, deployed with docker compose.
keywords:
  - multi-framework micro frontend
  - Angular host Vue remote
  - Angular host React remote
  - cross-framework federation
  - mixed stack micro frontend
  - component federation Angular Vue React
---

# Mixed-stack — Angular host loading Vue and React remotes

This is the flagship example. By the end, you will have a working application where an **Angular 19 host** loads a **Vue 3 remote** at `/orders` and a **React 18 remote** at `/checkout`, all backed by a single Nexus registry and gateway.

You can copy/paste from this page in order. Allow about an hour.

## What you are about to build

```mermaid
graph LR
  subgraph "Browser"
    Page[Angular host shell]
  end
  Page --> R1[Vue remote<br/>/orders]
  Page --> R2[React remote<br/>/checkout]
  Page --> Reg[(Nexus registry)]
```

A user lands on the storefront. The Angular host bootstraps, fetches the remote list from the registry, and registers two routes. The user navigates to `/orders` — a Vue component mounts inside the Angular shell. They click "Pay" and route to `/checkout` — a React component mounts in the same shell. The framework boundary is invisible to the user; the Angular shell stays mounted the whole time.

## Repository layout

```
mixed-stack-demo/
├── docker-compose.yml           # full stack
├── .env                         # NEXUS_TOKEN, NODE_AUTH_TOKEN
├── host-angular/                # Angular host
├── remote-orders-vue/           # Vue remote
└── remote-checkout-react/       # React remote
```

## 1. docker-compose.yml

```yaml
name: mixed-stack-demo

services:
  registry:
    image: ghcr.io/bimo-dk/nexus-registry:1.0
    environment:
      NEXUS_TOKEN: ${NEXUS_TOKEN}
      ALLOWED_ORIGINS: http://localhost:8668
      DATABASE_URL: sqlite:/data/registry.db
    volumes:
      - registry-data:/data

  gateway:
    image: ghcr.io/bimo-dk/nexus-gateway:1.0
    environment:
      REGISTRY_URL: http://registry:8670
      NEXUS_TOKEN: ${NEXUS_TOKEN}
    ports:
      - "8668:8668"
    depends_on:
      - registry

  portal:
    image: ghcr.io/bimo-dk/nexus-portal:1.0
    environment:
      NEXUS_TOKEN: ${NEXUS_TOKEN}
      REGISTRY_URL: http://registry:8670
    ports:
      - "8669:80"
    depends_on:
      - registry

  host-angular:
    build:
      context: ./host-angular
      secrets: [npmrc]
    environment:
      REGISTRY_INTERNAL_URL: http://registry:8670
      NEXUS_TOKEN: ${NEXUS_TOKEN}
    depends_on:
      - registry

  remote-orders-vue:
    build:
      context: ./remote-orders-vue
      secrets: [npmrc]
    environment:
      REGISTRY_INTERNAL_URL: http://registry:8670
      NEXUS_TOKEN: ${NEXUS_TOKEN}
      PUBLIC_URL: /remotes/orders/remoteEntry.json
      UPSTREAM_URL: http://remote-orders-vue:80
    depends_on:
      - registry

  remote-checkout-react:
    build:
      context: ./remote-checkout-react
      secrets: [npmrc]
    environment:
      REGISTRY_INTERNAL_URL: http://registry:8670
      NEXUS_TOKEN: ${NEXUS_TOKEN}
      PUBLIC_URL: /remotes/checkout/remoteEntry.json
      UPSTREAM_URL: http://remote-checkout-react:80
    depends_on:
      - registry

  # In real life this is created from the portal. For the demo we seed it.
  seed:
    image: alpine/curl:latest
    depends_on:
      - registry
    entrypoint:
      - sh
      - -c
      - |
        sleep 5
        curl -sf -X POST http://registry:8670/api/hosts \
          -H "X-Nexus-Token: $$NEXUS_TOKEN" -H "content-type: application/json" \
          -d '{"name":"storefront","url":"http://host-angular:80","framework":"angular","remoteEntry":"/remoteEntry.json","exposedModule":"./AppShell"}' \
          | tee /tmp/host.json
        HOST_ID=$$(grep -oE '"id":"[^"]+"' /tmp/host.json | head -n1 | cut -d'"' -f4)
        curl -sf -X POST http://registry:8670/api/gates \
          -H "X-Nexus-Token: $$NEXUS_TOKEN" -H "content-type: application/json" \
          -d "{\"name\":\"storefront-local\",\"domain\":\"localhost:8668\",\"hostId\":\"$$HOST_ID\"}"
    environment:
      NEXUS_TOKEN: ${NEXUS_TOKEN}

volumes:
  registry-data:

secrets:
  npmrc:
    file: ~/.npmrc
```

The `seed` service registers the host and a gate the first time you boot. After that it exits cleanly.

## 2. .env

```ini
NEXUS_TOKEN=replace-with-a-long-random-string
NODE_AUTH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 3. Angular host

```
host-angular/
├── src/
│   ├── app/
│   │   ├── app.shell.ts
│   │   └── routes.ts
│   ├── main.ts
│   └── index.html
├── federation.config.js
├── angular.json
├── package.json
├── Dockerfile
└── nginx.conf
```

```ts
// host-angular/src/app/app.shell.ts
import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [RouterModule, RouterOutlet],
  template: `
    <header style="padding:1rem;border-bottom:1px solid #eee;">
      <strong>Storefront</strong> &nbsp;
      <a routerLink="/orders">Orders (Vue)</a> &nbsp;
      <a routerLink="/checkout">Checkout (React)</a>
    </header>
    <main style="padding:1rem;"><router-outlet /></main>
  `,
})
export class AppShell {}
```

```ts
// host-angular/src/app/routes.ts
import { Routes } from '@angular/router';
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  nexusRoute({ path: 'orders',   remote: 'orders',   expose: 'RemoteEntry' }),
  nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

```ts
// host-angular/src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideNexusHost,
  correlationIdInterceptor,
  nexusAuthInterceptor,
} from '@bimo-dk/nexus-runtime';
import { AppShell } from './app/app.shell';
import { routes } from './app/routes';

bootstrapApplication(AppShell, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationIdInterceptor, nexusAuthInterceptor])),
    provideNexusHost({
      configDefaults: {
        registryUrl: '/api',
        wsUrl: '/ws',
      },
    }),
  ],
});
```

`federation.config.js`:

```js
module.exports = {
  name: 'storefront',
  exposes: { './AppShell': './src/app/app.shell.ts' },
  shared: {
    '@angular/core':   { singleton: true, requiredVersion: 'auto' },
    '@angular/common': { singleton: true, requiredVersion: 'auto' },
    '@angular/router': { singleton: true, requiredVersion: 'auto' },
  },
};
```

Why no `shared: vue`? Each non-Angular remote ships its own framework runtime in its bundle. Angular is shared because the host's own UI uses it; Vue and React only live inside their respective remotes.

## 4. Vue orders remote

```
remote-orders-vue/
├── src/
│   ├── app.vue
│   ├── entry.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── package.json
└── Dockerfile
```

```vue
<!-- remote-orders-vue/src/entry.vue -->
<template>
  <section>
    <h2>Orders (Vue)</h2>
    <ul>
      <li v-for="o in orders" :key="o.id">{{ o.label }} — ${{ o.total }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const orders = [
  { id: 1, label: 'Headphones', total: 89 },
  { id: 2, label: 'USB-C hub',  total: 39 },
];
</script>
```

```ts
// remote-orders-vue/src/main.ts
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
  routePath: 'orders',
  registryUrl: __NEXUS_REGISTRY_URL__,
  token: __NEXUS_TOKEN__,
});

createApp(App).mount('#app');
```

```ts
// remote-orders-vue/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nexusVite } from '@bimo-dk/nexus-build/vite';

export default defineConfig({
  plugins: [
    vue(),
    nexusVite({ name: 'orders', exposes: { RemoteEntry: './src/entry.vue' } }),
  ],
  build: {
    rollupOptions: { input: { index: './index.html', RemoteEntry: './src/entry.vue' } },
  },
});
```

## 5. React checkout remote

```
remote-checkout-react/
├── src/
│   ├── app.tsx
│   ├── entry.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── package.json
└── Dockerfile
```

```tsx
// remote-checkout-react/src/entry.tsx
import React, { useState } from 'react';

export default function RemoteEntry(): React.ReactElement {
  const [total, setTotal] = useState(128);
  return (
    <section>
      <h2>Checkout (React)</h2>
      <p>Order total: <strong>${total}</strong></p>
      <button onClick={() => setTotal((t) => t + 10)}>Add tip</button>
    </section>
  );
}
```

```tsx
// remote-checkout-react/src/main.tsx
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

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

```ts
// remote-checkout-react/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nexusVite } from '@bimo-dk/nexus-build/vite';

export default defineConfig({
  plugins: [
    react(),
    nexusVite({ name: 'checkout', exposes: { RemoteEntry: './src/entry.tsx' } }),
  ],
  build: {
    rollupOptions: { input: { index: './index.html', RemoteEntry: './src/entry.tsx' } },
  },
});
```

## 6. Boot the stack

```bash
docker compose --env-file .env up --build
```

After about a minute:

- `http://localhost:8668/orders` — Angular shell, Vue remote.
- `http://localhost:8668/checkout` — Angular shell, React remote.
- `http://localhost:8669` — portal. You should see one host (`storefront`), one gate (`storefront-local`), and two remotes (`orders`, `checkout`).

## 7. Trace the request

Open browser DevTools → Network:

1. `GET /` — Angular host shell HTML.
2. `GET /remoteEntry.json` — host's federation manifest.
3. `GET /api/remotes` — registry list.
4. `GET /ws` — WebSocket upgrade.
5. Click "Orders": `GET /remotes/orders/remoteEntry.json`, then the Vue runtime + entry chunk.
6. Click "Checkout": `GET /remotes/checkout/remoteEntry.json`, then the React runtime + entry chunk.

The Angular shell never reloads.

## 8. Watch a live update

```bash
# In another shell — disable the Vue remote.
curl -X POST http://localhost:8668/api/remotes/orders/toggle \
  -H "X-Nexus-Token: $NEXUS_TOKEN"
```

The registry broadcasts `remotes_changed`. The gateway removes `/remotes/orders/*` from its route table. The Angular host removes the route. The user clicking "Orders" now sees a 404. Re-enable the remote and the route comes back — no restart.

## What you learned

- A host can be a different framework than its remotes.
- Federation is route-based by default; each remote mounts in its own root.
- Catalog and registry remain framework-agnostic — the same `bnx status` shows all three.
- Multi-framework adds no special steps for the operator. The platform treats Angular, Vue, and React identically.

## Next

- [Workflows: multi-domain setup](../workflows/multi-domain-setup.md) — multiple gates pointing to this host.
- [Workflows: zero-downtime](../workflows/zero-downtime.md) — how the cache rules keep this working under deploys.
- [Infrastructure: registry](../infrastructure/infra-registry.md) — every endpoint the seed step touched.
