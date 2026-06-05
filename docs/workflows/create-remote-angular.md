---
id: create-remote-angular
title: Create an Angular remote
sidebar_position: 1
description: Step-by-step workflow to scaffold, build, and register a new Angular 19 micro frontend with a Nexus stack.
keywords:
  - Angular micro frontend
  - create Angular remote
  - micro frontend scaffold
  - bnx generate
---

# Create an Angular remote

The procedural recipe. For a runnable five-minute version see [quick-start-angular](../getting-started/quick-start-angular.md); for the deep-dive guide see [guide-angular-remote](../guides/guide-angular-remote.md).

## 1. Scaffold

```bash
bnx generate remote
? Remote name (camelCase): checkout
? Route path (kebab-case): checkout
? Framework: angular
```

## 2. Install

```bash
cd checkout
npm install     # or pnpm install / yarn install
```

## 3. Edit the entry component

`src/app/remote-entry/entry.component.ts`:

```ts
@NexusRemote()
@NexusComponent({ title: 'Checkout', category: 'commerce' })
@Component({ standalone: true, selector: 'app-checkout', template: '<h1>Checkout</h1>' })
export default class CheckoutComponent {}
```

## 4. Build

```bash
npm run build
```

The `prebuild` script runs `nexus-build`, which writes `federation.config.json`.

## 5. Containerize

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t checkout-remote .
```

## 6. Run with self-registration

```bash
docker run --rm -p 8700:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://checkout-remote:80 \
  --network nexus_default \
  checkout-remote
```

## 7. Verify

```bash
bnx status
# Remotes
#   checkout (global)   enabled   /remotes/checkout/*
```

## 8. Wire into a host

Angular host's `routes.ts`:

```ts
nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' })
```

Or use the drop-in tag anywhere:

```html
<nexus-component remote="checkout" expose="RemoteEntry" />
```

## Next

- [Workflows: zero-downtime](zero-downtime.md) — deploy this without breaking anyone.
- [Guide: Angular remote](../guides/guide-angular-remote.md) — every option explained.
