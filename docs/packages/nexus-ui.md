---
id: nexus-ui
title: '@bimo-dk/nexus-ui'
sidebar_position: 6
description: "@bimo-dk/nexus-ui — shared Angular UI component library for Nexus-based applications. Status indicators, registry health widgets and platform-consistent design tokens shared across host and remotes."
keywords: [nexus-ui Angular components, micro frontend shared UI, Angular component library federation, Nexus design system]
---

# @bimo-dk/nexus-ui

Angular 19 standalone component library with Angular Material under the hood. Used by the portal and the host template; consumable from any remote that wants a consistent look.

```bash
npm install @bimo-dk/nexus-ui @angular/material @angular/cdk
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

**Inputs**: `status?: 'healthy' | 'degraded' | 'down' | 'unknown'`.
Color-coded pill: green / yellow / red / gray.

### `<bimo-offline-banner>`

```ts
template: `<bimo-offline-banner [isOffline]="!registryOnline()" />`
```

**Inputs**: `isOffline: boolean`. Only renders when `true`.

The host template uses this to show the "Registry offline — showing cached data" banner.

### `<bimo-loading-spinner>`

```ts
template: `<bimo-loading-spinner size="large" />`
```

**Inputs**: `size: 'small' | 'medium' | 'large'` (default `'medium'`).

### `<bimo-remote-status-card>`

```ts
template: `
  <bimo-remote-status-card
    [remote]="remote"
    (toggle)="onToggle($event)"
    (navigate)="onNavigate($event)" />
`
```

**Inputs**:
- `remote: RemoteConfig` — required

**Outputs**:
- `toggle: EventEmitter<RemoteConfig>` — emits the remote when the toggle button is clicked
- `navigate: EventEmitter<RemoteConfig>` — emits when the user wants to open the remote

Used by the portal's remote list.

## Peer dependencies

- `@angular/core` ^19.0.0
- `@angular/common` ^19.0.0
- `@angular/material` ^19.0.0
- `@angular/cdk` ^19.0.0

Material is a peer because most apps already pull in their own version with their own theming. Pulling in a duplicate at a different version causes the worst kind of style breakage — the build succeeds and the UI silently looks wrong.

## Theming

The components honor your app's Material theme. They reference theme tokens through Material's CSS variables (`--mat-...`) so you do not need to import a separate theme.

## When to add a new component

The bar is:

1. Used in **two or more** Bimo-Nexus services (host, portal, etc.).
2. Cannot be expressed as a thin wrapper that lives in the consuming service.
3. Stable API — a major bump on `nexus-ui` is expensive because every consumer needs to rebuild.

A "remote tag" pill is borderline; "the portal's settings panel" is not.
