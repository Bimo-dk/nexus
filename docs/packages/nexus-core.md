---
id: nexus-core
title: '@bimo-dk/nexus-core'
sidebar_position: 2
description: "@bimo-dk/nexus-core — shared TypeScript types and interfaces for the entire Nexus platform. RemoteConfig, HealthSnapshot, LogEntry and more. Used by every service and package in the stack."
keywords: [nexus-core TypeScript types, Angular micro frontend types, RemoteConfig interface, Nexus platform types]
---

# @bimo-dk/nexus-core

The single source of truth for types, constants, validators and errors across every Bimo-Nexus service. Zero runtime dependencies — pure TypeScript.

```bash
npm install @bimo-dk/nexus-core
```

## What's exported

### Types

```ts
import type {
  RemoteConfig,
  AddRemoteRequest,
  UpdateRemoteRequest,
  RegistryResponse,
  HealthStatus,
  RemoteHealthStatus,
  WebSocketMessage,
} from '@bimo-dk/nexus-core';
```

`RemoteConfig` is the schema for a single remote — used by registry, host, portal and CLI alike.

```ts
interface RemoteConfig {
  name: string;          // camelCase
  url: string;           // http(s) URL or absolute path
  exposedModule: string; // './RemoteEntry'
  routePath: string;     // kebab-case
  enabled: boolean;
  addedAt: string;       // ISO 8601
}
```

### Constants

```ts
import { NEXUS_DEFAULTS } from '@bimo-dk/nexus-core';

NEXUS_DEFAULTS.TOKEN_HEADER       // 'X-Nexus-Token'
NEXUS_DEFAULTS.CORRELATION_HEADER // 'X-Request-ID'
NEXUS_DEFAULTS.REGISTRY_PORT      // 3000
NEXUS_DEFAULTS.GATEWAY_PORT       // 8668
NEXUS_DEFAULTS.PORTAL_PORT        // 8669
```

The object is `Object.freeze`'d so importers cannot mutate it.

### Validators

```ts
import {
  isValidRemoteName,
  isValidRoutePath,
  isValidUrl,
  isValidUrlOrPath,
} from '@bimo-dk/nexus-core';

isValidRemoteName('myRemote');   // true
isValidRemoteName('my-remote');  // false (must be camelCase)
isValidRoutePath('my-remote');   // true
isValidRoutePath('myRemote');    // false (must be kebab-case)
isValidUrlOrPath('/foo/bar');    // true (absolute path allowed)
isValidUrlOrPath('http://x');    // true
isValidUrlOrPath('x.y');         // false
```

The registry uses these to validate `POST /api/remotes` bodies — pull them in if you build a different ingress for the registry.

### Errors

```ts
import { RegistryError } from '@bimo-dk/nexus-core';

throw new RegistryError({
  message: 'Remote not found',
  statusCode: 404,
  correlationId: req.headers['x-request-id'],
});
```

A typed exception with `statusCode` + `correlationId`. The registry middleware turns it into the standard JSON error response.

## Why it has zero runtime deps

Every other `@bimo-dk/*` package depends on this one. If `core` pulled in even a small util library, that library would be loaded twice (once by Angular host, once by the registry's Node process), and version mismatches would become very expensive. Zero deps means zero churn.

## Versioning rule

Anything `core` exports is part of the public Bimo-Nexus contract. A breaking change in `core` requires a major bump on `core` *and* a coordinated bump on every consumer.

Use Changesets to express this: when you change a type that consumers will care about, mark `nexus-core` as a `major` and explicitly list every dependent that needs an update in the changeset description.
