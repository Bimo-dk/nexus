---
id: nexus-client
title: '@bimo-dk/nexus-client'
sidebar_position: 3
description: "@bimo-dk/nexus-client — Node.js client for the Nexus registry API. Publish remotes from CI, toggle features, trigger redeployments. The engine behind bnx publish and bnx toggle."
keywords: [nexus-client Node.js, Nexus registry API client, micro frontend CI publish, bnx publish Node]
---

# @bimo-dk/nexus-client

HTTP + WebSocket client for the Bimo-Nexus registry. Used in the host, the portal, the CLI, and any custom Node script that needs to talk to the registry.

```bash
npm install @bimo-dk/nexus-client
```

## RegistryClient (HTTP)

```ts
import { RegistryClient } from '@bimo-dk/nexus-client';

const client = new RegistryClient({
  registryUrl: 'http://localhost:3000',
  token: process.env.NEXUS_TOKEN!,
});
```

### Read

```ts
const all = await client.getRemotes();
const one = await client.getRemote('checkout');
```

### Write

```ts
await client.addRemote({
  name: 'checkout',
  url: '/remotes/checkout/remoteEntry.json',
  routePath: 'checkout',
  exposedModule: './RemoteEntry',   // default
  enabled: true,                    // default
});

await client.updateRemote('checkout', { url: 'https://cdn.example.com/checkout/remoteEntry.json' });
await client.toggleRemote('checkout');
await client.deleteRemote('checkout');
```

### Health

```ts
const remoteHealth = await client.checkHealth('http://remote-catalog/health');
// { status: 'healthy' | 'degraded' | 'down' | 'unknown', latencyMs: 12 }

const systemHealth = await client.getSystemHealth();
const metrics      = await client.getMetrics();
const config       = await client.getConfig();
```

Every method throws `RegistryError` (re-exported from `core`) on non-2xx responses, with `statusCode` and `correlationId` populated from the response body.

## RegistryWebSocket

```ts
import { RegistryWebSocket } from '@bimo-dk/nexus-client';

const ws = new RegistryWebSocket({
  registryUrl: 'http://localhost:3000',
  token: process.env.NEXUS_TOKEN!,
});

ws.onMessage((msg) => {
  switch (msg.type) {
    case 'remotes_changed':  redraw(msg.remotes);    break;
    case 'system_health':    updateGauges(msg.snapshot); break;
    case 'log':              appendLog(msg.entry);   break;
    case 'welcome':          console.log('connected'); break;
  }
});

ws.connect();
// later:
ws.disconnect();
```

### Reconnect

Auto-reconnect with exponential backoff: `1s → 2s → 4s → ... → 30s` max. The client raises `onReconnect` between attempts so the UI can show "offline" / "reconnecting".

```ts
ws.onReconnect((attempt, nextDelayMs) => {
  console.log(`Reconnecting (attempt ${attempt}, next try in ${nextDelayMs}ms)`);
});

ws.onOpen(() => updateStatus('online'));
ws.onClose(() => updateStatus('offline'));
```

### Log subscription

```ts
ws.subscribeLogs();    // send { type: 'subscribe', subscribe: 'logs' }
ws.unsubscribeLogs();  // send the matching unsubscribe
```

The portal's log viewer uses exactly this.

## Re-exports

All types and constants from `@bimo-dk/nexus-core` are re-exported, so a consumer only needs one import:

```ts
import { RegistryClient, NEXUS_DEFAULTS, type RemoteConfig } from '@bimo-dk/nexus-client';
```

## Runtime environments

Works in:

- **Node ≥ 22** — uses global `fetch` and `WebSocket`. No `node-fetch` or `ws` required.
- **Modern browsers** — bundles cleanly via any tree-shaking bundler.

If you target older Node (≤ 20) you must polyfill `fetch` and `WebSocket` yourself.

## Use in Angular

You almost never instantiate this directly in an Angular app — `@bimo-dk/nexus-runtime` does it for you and provides:

- `RegistryService` — wraps `RegistryClient` + caching + fallback chain
- `RegistryWebSocketService` — wraps `RegistryWebSocket` + signal-based status

Inject those instead.

## Use in Node tooling

```ts
import 'dotenv/config';
import { RegistryClient } from '@bimo-dk/nexus-client';

const client = new RegistryClient({
  registryUrl: process.env.REGISTRY_URL!,
  token: process.env.NEXUS_TOKEN!,
});

const remotes = await client.getRemotes();
console.table(remotes);
```

This is exactly what `bnx status` does — see `@bimo-dk/nexus-cli`.
