---
id: nexus-ui
title: '@bimo-dk/nexus-ui'
sidebar_position: 11
description: Shared Angular component library used by the Nexus portal and host templates. Standalone components on Angular Material.
keywords:
  - nexus-ui
  - Angular component library
  - micro frontend UI
---

# @bimo-dk/nexus-ui

Angular 19 component library used by the portal and the Angular host template. Standalone components on top of Angular Material.

## Install

```bash
npm install @bimo-dk/nexus-ui @angular/material @angular/cdk
# pnpm add @bimo-dk/nexus-ui @angular/material @angular/cdk
# yarn add @bimo-dk/nexus-ui @angular/material @angular/cdk
```

## Components

### `<bimo-health-badge>`

```ts
import { HealthBadgeComponent } from '@bimo-dk/nexus-ui';

@Component({
  imports: [HealthBadgeComponent],
  template: `<bimo-health-badge [status]="remote.healthStatus" />`,
})
```

Inputs: `status?: 'healthy' | 'degraded' | 'down' | 'unknown'`. Color-coded pill (green / yellow / red / gray).

### `<bimo-offline-banner>`

```html
<bimo-offline-banner [isOffline]="!registryOnline()" />
```

Inputs: `isOffline: boolean`. Renders only when `isOffline = true`.

### `<bimo-loading-spinner>`

```html
<bimo-loading-spinner size="large" />
```

Inputs: `size: 'small' | 'medium' | 'large'` (default `medium`).

### `<bimo-remote-status-card>`

```html
<bimo-remote-status-card
  [remote]="remote"
  (toggle)="onToggle($event)"
  (navigate)="onNavigate($event)"
/>
```

Inputs: `remote: RemoteConfig` (required).
Outputs: `toggle: EventEmitter<RemoteConfig>`, `navigate: EventEmitter<RemoteConfig>`.

## Peer dependencies

| Package | Range |
|---|---|
| `@angular/core` | ^19.0.0 |
| `@angular/common` | ^19.0.0 |
| `@angular/material` | ^19.0.0 |
| `@angular/cdk` | ^19.0.0 |

## Theming

Components consume Angular Material's M3 theme tokens, so they respect the host application's primary/secondary palette automatically. The portal's dark and light themes are both M3-aligned.

## Used where

- The portal's Overview, Hosts, Remotes, Gates pages.
- The Angular host template's default landing page.

## Next

- [Infra: portal](../infrastructure/infra-portal.md) — where these components live in production.
- [`@bimo-dk/nexus-runtime`](nexus-runtime.md) — the Angular DI primitives that feed these components.
