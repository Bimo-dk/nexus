---
id: nexus-runtime
title: '@bimo-dk/nexus-runtime'
sidebar_position: 5
---

# @bimo-dk/nexus-runtime

Angular providers that bundle everything a host or remote needs at runtime — config loading, self-registration, HTTP interceptors, dynamic federation, registry state. Two providers, two lines of code.

```bash
npm install @bimo-dk/nexus-runtime @bimo-dk/nexus-build
```

Peer dependencies (must exist in your app):

- `@angular/core`, `@angular/common`, `@angular/router` (^19)
- `@angular-architects/native-federation` (^19) — host only
- `rxjs` (^7.8)

## Remote (5-line bootstrap)

```ts
// src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNexusRemote } from '@bimo-dk/nexus-runtime';
import EntryComponent from './app/remote-entry/entry.component';

bootstrapApplication(EntryComponent, {
  providers: [
    provideNexusRemote({
      entry: EntryComponent,
      configDefaults: {
        registryUrl: 'http://localhost:3000',
        nexusToken: 'dev-token',
      },
    }),
  ],
});
```

At bootstrap, `provideNexusRemote(...)`:

1. Fetches `/assets/config.json` and merges over `configDefaults`.
2. `SelfRegisterService` runs — POSTs (or PUTs) the remote to `${registryUrl}/api/remotes`.
3. Reads `name`, `route` and `exposedModule` from the `@NexusRemote` decorator metadata on `entry`.
4. URL is derived from `window.location` unless `publicUrl` is set in runtime config.

The remote is now visible in the registry and the host's WebSocket subscription fires immediately.

## Host (1 provider, full dynamic federation)

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNexusHost } from '@bimo-dk/nexus-runtime';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([]),     // start empty — nexus fills in routes
    provideNexusHost({
      configDefaults: {
        registryUrl: '/api',
        nexusToken: 'dev-token',
        staticBackupUrl: '/assets/registry-backup/remotes.json',
      },
    }),
  ],
};
```

`provideNexusHost(...)`:

1. Fetches remotes via the fallback chain (registry → cache → static backup).
2. Opens a `/ws` WebSocket.
3. For each enabled remote, calls `loadRemoteModule(...)` and registers a route.
4. Subscribes to `remotes_changed` broadcasts → add/remove routes without reload.

## Reading state from the shell

```ts
import { Component, inject } from '@angular/core';
import { DynamicNexusService } from '@bimo-dk/nexus-runtime';

@Component({ ... })
export class AppShell {
  readonly nexus = inject(DynamicNexusService);

  // signals:
  // nexus.loadedRemotes()  - signal<RemoteConfig[]>
  // nexus.failedRemotes()  - signal<Map<string, string>>  (name → error message)
  // nexus.registryOnline() - computed signal
}
```

These are signals, so template bindings re-render automatically.

## Runtime config — `/assets/config.json`

Both providers fetch this file at bootstrap. Typical template (substituted by nginx entrypoint at container start):

```json
{
  "registryUrl": "${REGISTRY_URL}",
  "nexusToken": "${NEXUS_TOKEN}",
  "publicUrl": "${PUBLIC_URL}"
}
```

`NexusRuntimeConfig` fields:

| Field | Description |
|---|---|
| `registryUrl` | Base URL of the registry API |
| `nexusToken` | Token for `X-Nexus-Token` header |
| `configAssetPath` | Override `/assets/config.json` path (defaults to that) |
| `publicUrl` | Override the URL a remote announces to the registry |
| `staticBackupUrl` | Host-only: path to the backup remotes JSON |

## What's bundled

Both providers register the same baseline:

- `NEXUS_CONFIG` injection token, populated from runtime config + `configDefaults`
- `provideHttpClient(withInterceptors([nexusAuthInterceptor, correlationIdInterceptor]))`

Then they add role-specific pieces:

- **Remote** — `SelfRegisterService` (runs once at bootstrap)
- **Host** — `RegistryService`, `RegistryWebSocketService`, `DynamicNexusService`

## Interceptors

| Interceptor | Adds | Scope |
|---|---|---|
| `nexusAuthInterceptor` | `X-Nexus-Token: <nexusToken>` | requests to the registry origin |
| `correlationIdInterceptor` | `X-Request-ID: <uuid v4>` | every request |

Both are exported individually if you need to register them on a custom `HttpClient` instance.

## Manual wiring (escape hatch)

If you need more control, every building block is exported:

```ts
import {
  NEXUS_CONFIG,
  provideNexusConfig,
  SelfRegisterService,
  DynamicNexusService,
  RegistryService,
  RegistryWebSocketService,
  nexusAuthInterceptor,
  correlationIdInterceptor,
} from '@bimo-dk/nexus-runtime';
```

The use case is rare — typically Angular Universal or testing — and `provideNexusHost` / `provideNexusRemote` is what you want 99% of the time.
