---
id: nexus-testing
title: '@bimo-dk/nexus-testing'
sidebar_position: 10
description: Mock factories, MockRegistryServer, and Angular TestBed helpers for Nexus. Test utilities only — never use in production deps.
keywords:
  - nexus-testing
  - micro frontend testing
  - mock registry
  - jest vitest
---

# @bimo-dk/nexus-testing

Mock factories, an in-process `MockRegistryServer`, and Angular TestBed helpers. **devDependency only — never production deps.**

## Install

```bash
npm install -D @bimo-dk/nexus-testing
# pnpm add -D @bimo-dk/nexus-testing
# yarn add -D @bimo-dk/nexus-testing
```

## Mock factories

```ts
import {
  createMockRemoteConfig,
  createMockRegistryResponse,
  createMockHost,
  createMockGate,
} from '@bimo-dk/nexus-testing';

const remote = createMockRemoteConfig({ name: 'checkout' });
const response = createMockRegistryResponse(5);  // 5 mock remotes
const host = createMockHost({ name: 'storefront', framework: 'angular' });
const gate = createMockGate({ domain: 'shop.example.com', hostId: host.id });
```

Every factory accepts a partial override and fills the rest with sensible defaults.

## MockRegistryServer (integration tests)

A real `http.Server` that implements the registry's API surface. Run it on a random port and point a real `RegistryClient` at it.

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

it('roundtrips a remote', async () => {
  await client.addRemote({ name: 'foo', url: '/foo/remoteEntry.json', routePath: 'foo' });
  const list = await client.getRemotes();
  expect(list.some((r) => r.name === 'foo')).toBe(true);
});
```

The mock honors token auth, validation rules, and the WebSocket broadcast — so end-to-end behaviors that depend on real network round-trips work without a docker stack.

## createMockRegistryClient (unit tests)

Returns a `RegistryClient`-shaped object backed by an in-memory store. Faster than `MockRegistryServer` for pure unit tests.

```ts
import { createMockRegistryClient, createMockRemoteConfig } from '@bimo-dk/nexus-testing';

const mockClient = createMockRegistryClient([
  createMockRemoteConfig({ name: 'checkout' }),
]);

const remotes = await mockClient.getRemotes();
expect(remotes).toHaveLength(1);
```

## Angular TestBed integration

```ts
import { provideMockRegistry } from '@bimo-dk/nexus-testing/angular';
import { RegistryClient } from '@bimo-dk/nexus-client';

TestBed.configureTestingModule({
  providers: [
    provideMockRegistry(RegistryClient, [createMockRemoteConfig()]),
  ],
});
```

## Chaos scenarios

The package ships a `verify/` folder of scripted scenarios you can run from CI:

- 30-second registry outage.
- Gateway restart mid-request.
- Token rotation with a grace period.
- Remote container going away mid-render.

Each scenario runs against a real `docker compose` stack and asserts the host's behavior. Wire them into your build to catch HA regressions.

## Next

- [Infra: high-availability](../infrastructure/infra-high-availability.md) — what the chaos scenarios verify.
- [`@bimo-dk/nexus-client`](nexus-client.md) — the client the mocks emulate.
