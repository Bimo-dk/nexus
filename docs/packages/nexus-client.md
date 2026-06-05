---
id: nexus-client
title: '@bimo-dk/nexus-client'
sidebar_position: 3
description: HTTP and WebSocket client for the Nexus registry. Runs in Node and the browser. Auto-reconnect with exponential backoff.
keywords:
  - nexus-client
  - micro frontend registry client
  - WebSocket client
  - Node.js
---

# @bimo-dk/nexus-client

HTTP + WebSocket client for the Nexus registry. Works in Node and all modern browsers. Re-exports types from `@bimo-dk/nexus-core` so you only need one import.

## Install

```bash
npm install @bimo-dk/nexus-client
# pnpm add @bimo-dk/nexus-client
# yarn add @bimo-dk/nexus-client
```

## RegistryClient

```ts
import { RegistryClient } from '@bimo-dk/nexus-client';

const client = new RegistryClient({
  registryUrl: 'http://localhost:8670',
  token: process.env.NEXUS_TOKEN!,
});

// Remotes
const remotes = await client.getRemotes();
await client.addRemote({ name: 'orders', url: '/remotes/orders/remoteEntry.json', routePath: 'orders' });
await client.updateRemote('orders', { enabled: false });
await client.toggleRemote('orders');
await client.deleteRemote('orders');

// Hosts
const hosts = await client.getHosts();
const host = await client.createHost({
  name: 'storefront',
  url: 'http://host-angular:80',
  framework: 'angular',
  remoteEntry: '/remoteEntry.json',
  exposedModule: './AppShell',
});

// Gates
const gates = await client.getGates();
await client.createGate({ name: 'storefront-prod', domain: 'shop.example.com', hostId: host.id });

// Health
const health = await client.checkHealth('http://remote-orders/health');
```

Every method:

- Adds `X-Nexus-Token` automatically.
- Generates `X-Request-ID` (ULID) for correlation.
- Throws `RegistryError` on non-2xx with the registry's correlation id attached.

## RegistryWebSocket

```ts
import { RegistryWebSocket } from '@bimo-dk/nexus-client';

const ws = new RegistryWebSocket({
  registryUrl: 'http://localhost:8670',
  token: process.env.NEXUS_TOKEN!,
});

ws.onMessage((msg) => {
  switch (msg.type) {
    case 'welcome':           console.log('connected, reconnect policy', msg.reconnect_policy); break;
    case 'remotes_changed':   console.log('remotes', msg.remotes); break;
    case 'host_changed':      console.log('host', msg.host); break;
    case 'gate_changed':      console.log('gate', msg.gate); break;
    case 'config_changed':    console.log('config', msg.section, msg.value); break;
    case 'registry_shutting_down': console.log('drain in', msg.resume_in_ms, 'ms'); break;
  }
});

ws.connect();

// Later
ws.disconnect();
```

Auto-reconnect parameters come from the `welcome` frame's `reconnect_policy` — set them once in the portal and every connected client honors the same backoff. Local override is possible via the constructor options.

## Re-exports

All types and constants from `@bimo-dk/nexus-core` are re-exported:

```ts
import { RegistryClient, RemoteConfig, NEXUS_DEFAULTS } from '@bimo-dk/nexus-client';
```

## Use cases

- The portal uses `RegistryClient` for every page action.
- `bnx publish` / `bnx status` use it server-side.
- Custom Node scripts (CI hooks, drift detectors, scheduled audits) use it.
- The Angular runtime, Vue plugin, and React provider all use it under the hood through `runtime-core`.

## Next

- [`@bimo-dk/nexus-runtime-core`](nexus-runtime-core.md) — the layer that wraps this for framework adapters.
- [Infra: registry](../infrastructure/infra-registry.md) — the API surface this client targets.
