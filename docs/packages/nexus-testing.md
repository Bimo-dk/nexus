---
id: nexus-testing
title: '@bimo-dk/nexus-testing'
sidebar_position: 7
description: "@bimo-dk/nexus-testing — test utilities for Angular micro frontend remotes. Mock registry, fake federation loader, and test providers for DynamicNexusService. Write unit tests for remotes without a running stack."
keywords: [Angular micro frontend testing, nexus-testing Angular, mock federation Angular, test micro frontend Angular]
---

# @bimo-dk/nexus-testing

Mock factories, an in-memory `MockRegistryServer`, and Angular `TestBed` helpers.

```bash
npm install -D @bimo-dk/nexus-testing
```

:::warning devDependency only
This package must never be a runtime dependency. The `MockRegistryServer` pulls in `express` and starts a server on `process.exit` cleanup hooks — fine for tests, ungood in production.
:::

## Mock factories

Quick objects that satisfy the type and are good enough for most tests:

```ts
import { createMockRemoteConfig, createMockRegistryResponse } from '@bimo-dk/nexus-testing';

const remote = createMockRemoteConfig({ name: 'checkout' });
// { name: 'checkout', url: '/remotes/checkout/remoteEntry.json', routePath: 'checkout',
//   exposedModule: './RemoteEntry', enabled: true, addedAt: '2026-01-01T00:00:00.000Z' }

const response = createMockRegistryResponse(5);
// 5 unique mock remotes wrapped in the standard RegistryResponse shape
```

Every factory takes a `Partial<T>` so you can override only what your test cares about.

## MockRegistryServer (integration tests)

Spins up a real Express server on a random port that implements the full registry HTTP + WS API. No Docker, no test container.

```ts
import { MockRegistryServer } from '@bimo-dk/nexus-testing';
import { RegistryClient } from '@bimo-dk/nexus-client';

let server: MockRegistryServer;
let client: RegistryClient;

beforeAll(async () => {
  server = new MockRegistryServer({ token: 'test-token' });
  const port = await server.start();
  client = new RegistryClient({
    registryUrl: `http://localhost:${port}`,
    token: 'test-token',
  });
});

afterAll(() => server.stop());

it('round-trips a remote', async () => {
  await client.addRemote({ name: 'foo', url: '/foo/remoteEntry.json', routePath: 'foo' });
  const list = await client.getRemotes();
  expect(list.some((r) => r.name === 'foo')).toBe(true);
});
```

The mock implements every endpoint that the real registry implements, including:

- HTTP CRUD on `/api/remotes`
- WebSocket broadcast on every mutation
- `/health` (no token), `/api/system/{health,config,metrics,logs}` (token)
- 401 on a bad token, 400 on validation, 409 on conflict

It does **not** persist anything — the in-memory store resets on every `start()`.

## createMockRegistryClient (unit tests)

When you don't need a real HTTP server — just inject a stub:

```ts
import { createMockRegistryClient, createMockRemoteConfig } from '@bimo-dk/nexus-testing';

const mockClient = createMockRegistryClient([
  createMockRemoteConfig({ name: 'checkout' }),
  createMockRemoteConfig({ name: 'orders' }),
]);

const remotes = await mockClient.getRemotes();
expect(remotes).toHaveLength(2);
```

Implements every method of `RegistryClient` against an in-memory `Map`.

## Angular `TestBed` integration

For testing components that inject `RegistryClient` (or `RegistryService`):

```ts
import { provideMockRegistry } from '@bimo-dk/nexus-testing/angular';
import { RegistryClient } from '@bimo-dk/nexus-client';

TestBed.configureTestingModule({
  providers: [
    provideMockRegistry(RegistryClient, [
      createMockRemoteConfig({ name: 'checkout' }),
    ]),
  ],
});
```

`provideMockRegistry` returns the same providers `provideNexusHost` would, but with a `createMockRegistryClient` substituted for the real one.

## Picking the right helper

| You want to | Use |
|---|---|
| Test a pure function that takes a `RemoteConfig` | `createMockRemoteConfig({...})` |
| Test a service that calls `RegistryClient.getRemotes()` | `createMockRegistryClient([...])` |
| Test the *whole* host flow (HTTP + WS) | `MockRegistryServer` |
| Test an Angular component that injects registry services | `provideMockRegistry(...)` in `TestBed` |
