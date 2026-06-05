---
id: nexus-core
title: '@bimo-dk/nexus-core'
sidebar_position: 2
description: TypeScript types, constants, and validators shared by every Nexus client and adapter. Zero runtime dependencies.
keywords:
  - nexus-core
  - micro frontend types
  - TypeScript SDK
---

# @bimo-dk/nexus-core

Types, constants, and validators for the Nexus platform. Zero runtime dependencies. Imported by every other `@bimo-dk/*` package.

## Install

```bash
npm install @bimo-dk/nexus-core
# pnpm add @bimo-dk/nexus-core
# yarn add @bimo-dk/nexus-core
```

Usually a transitive dependency — you install it directly only when writing types-only utilities.

## Usage

```ts
import {
  RemoteConfig,
  RegistryResponse,
  Host,
  Gate,
  NEXUS_DEFAULTS,
  RegistryError,
  isValidRemoteName,
  isValidRoutePath,
  isValidUrl,
} from '@bimo-dk/nexus-core';

if (isValidRemoteName('myRemote')) {
  // safe to send to the registry
}

console.log(NEXUS_DEFAULTS.TOKEN_HEADER); // 'X-Nexus-Token'
```

## Exports

### Types

| Name | Purpose |
|---|---|
| `RemoteConfig` | Shape of a registered remote (name, url, exposedModule, routePath, enabled, visibility, health). |
| `Host` | Shape of a registered host (name, url, framework, remoteEntry, exposedModule). |
| `Gate` | Shape of a gate (name, domain, hostId, enabled). |
| `RegistryResponse` | `{ remotes, total, enabled }` returned from `GET /api/remotes`. |
| `HealthStatus` | `'healthy' \| 'degraded' \| 'down' \| 'unknown'`. |
| `WebSocketMessage` | Discriminated union of every server-pushed message type. |
| `AddRemoteRequest`, `UpdateRemoteRequest` | Body shapes for write endpoints. |
| `CreateHostRequest`, `UpdateHostRequest` | Body shapes for host endpoints. |
| `CreateGateRequest`, `UpdateGateRequest` | Body shapes for gate endpoints. |

### Constants

| Name | Value |
|---|---|
| `NEXUS_DEFAULTS.REGISTRY_PORT` | `8670` |
| `NEXUS_DEFAULTS.GATEWAY_PORT` | `8668` |
| `NEXUS_DEFAULTS.PORTAL_PORT` | `8669` |
| `NEXUS_DEFAULTS.TOKEN_HEADER` | `'X-Nexus-Token'` |
| `NEXUS_DEFAULTS.CORRELATION_HEADER` | `'X-Request-ID'` |
| `NEXUS_DEFAULTS.WS_PATH` | `'/ws'` |

### Errors

`RegistryError` — typed exception with `statusCode`, `correlationId`, optional `code`.

### Validators

`isValidRemoteName(s: string): boolean` — camelCase starting with a lowercase letter.
`isValidRoutePath(s: string): boolean` — kebab-case starting with a lowercase letter.
`isValidUrl(s: string): boolean` — must be `https://` or `http://`.
`isValidUrlOrPath(s: string): boolean` — same as `isValidUrl`, or an absolute path starting with `/`.

## Next

- [`@bimo-dk/nexus-client`](nexus-client.md) — uses these types.
- [Reference: api-reference](../reference/api-reference.md) — the API these shapes describe.
