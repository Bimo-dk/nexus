---
id: guide-angular-remote
title: Guide — Angular remote in depth
sidebar_position: 2
description: Build an Angular 19 micro frontend with Nexus from scratch. Decorators, self-registration, providers, the full Docker build, and the production deploy.
keywords:
  - Angular micro frontend
  - Angular 19 micro frontend
  - Native Federation
  - module federation Angular
  - micro frontend platform
---

# Angular remote in depth

This guide takes you from an empty directory to a production-ready Angular 19 micro frontend registered with Nexus. The [quick start](../getting-started/quick-start-angular.md) is the five-minute version; this one shows every file and every choice you can make.

## Prerequisites

- Node.js 22+, npm 10+, Docker with BuildKit.
- A running Nexus stack — `docker compose up` from the `nexus` repo.
- A GitHub PAT with `read:packages` scope, saved in `~/.npmrc`.

## Install the packages

```bash
mkdir checkout && cd checkout
npm init -y
npm install @angular/core @angular/common @angular/router @angular/platform-browser \
            @angular-architects/native-federation rxjs
npm install @bimo-dk/nexus-runtime @bimo-dk/nexus-build @bimo-dk/nexus-core
npm install -D @angular/cli @angular/compiler-cli typescript ng-packagr
```

Equivalent for pnpm: `pnpm add` (and `pnpm add -D` for devDependencies). For yarn: `yarn add` / `yarn add -D`.

## Expose your entry component

```ts
// src/app/remote-entry/entry.component.ts
import { Component } from '@angular/core';
import { NexusRemote, NexusComponent } from '@bimo-dk/nexus-build';

@NexusRemote()
@NexusComponent({
  title: 'Checkout',
  description: 'Cart review and payment flow.',
  category: 'commerce',
  tags: ['checkout', 'cart', 'payment'],
  inputs: {
    customerId: { type: 'string', required: true },
    showRecommendations: { type: 'boolean', default: true },
  },
})
@Component({
  standalone: true,
  selector: 'app-checkout',
  template: `
    <section class="checkout">
      <h1>Checkout</h1>
    </section>
  `,
})
export default class CheckoutComponent {}
```

What each decorator does:

- `@NexusRemote()` — at build time, `nexus-build` reads this and writes `federation.config.json` with `name`, `exposes`, and `shared`. With no arguments, the name is derived from `package.json` or the class name.
- `@NexusComponent()` — emits a catalog entry that shows up in the portal's `/catalog` page and is fetchable through `CatalogService`.

Both decorators are erased at runtime; they exist only for code generation.

## Bootstrap

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideNexusRemote,
  correlationIdInterceptor,
  nexusAuthInterceptor,
} from '@bimo-dk/nexus-runtime';
import CheckoutComponent from './app/remote-entry/entry.component';

bootstrapApplication(CheckoutComponent, {
  providers: [
    provideRouter([]),
    provideHttpClient(
      withInterceptors([correlationIdInterceptor, nexusAuthInterceptor]),
    ),
    provideNexusRemote({
      entry: CheckoutComponent,
      configDefaults: {
        registryUrl: '/api',
        retryAttempts: 5,
      },
    }),
  ],
}).catch((err) => console.error(err));
```

`provideNexusRemote()` registers an `APP_INITIALIZER` that runs `SelfRegisterService.register()` at startup. The service reads the metadata you declared via `@NexusRemote()` and POSTs to `${REGISTRY_INTERNAL_URL}/api/remotes`.

## Federation config shim

`@angular-architects/native-federation` expects a `federation.config.js` file. Keep it as a thin shim that reads what `nexus-build` writes:

```js
// federation.config.js
const config = require('./federation.config.json');
module.exports = config;
```

## Wire up the build pipeline

```json
// package.json (scripts)
{
  "scripts": {
    "prebuild": "nexus-build",
    "build": "ng build --configuration production",
    "start": "ng serve --port 8700"
  }
}
```

`prebuild` runs `nexus-build`, which scans `src/**/*.ts`, finds your `@NexusRemote()`-annotated component, and writes `federation.config.json`.

## angular.json

The minimum:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "projects": {
    "checkout": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "architect": {
        "build": {
          "builder": "@angular-architects/native-federation:build",
          "options": {
            "outputPath": "dist/checkout",
            "index": "src/index.html",
            "main": "src/main.ts",
            "tsConfig": "tsconfig.app.json"
          }
        }
      }
    }
  }
}
```

## Dockerfile (BuildKit secret)

```dockerfile
# syntax=docker/dockerfile:1.6
FROM ghcr.io/bimo-dk/nexus-base:latest AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --prefer-offline
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/checkout /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ >/dev/null || exit 1
```

Build:

```bash
docker build -t checkout-remote .
```

## Run and verify

```bash
docker run --rm -p 8700:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/checkout/remoteEntry.json \
  -e UPSTREAM_URL=http://checkout-remote:80 \
  --network nexus_default \
  checkout-remote
```

```bash
bnx status
# Remotes
#   checkout (global)      enabled   /remotes/checkout/*  http://checkout-remote:80
```

## What the host needs to do

Nothing custom. An Angular host loads your remote with:

```ts
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes = [
  nexusRoute({ path: 'checkout', remote: 'checkout', expose: 'RemoteEntry' }),
];
```

A Vue or React host loads it through their respective `nexusRoute` / `createNexusRoute` helpers. The remote does not care.

## Common pitfalls

- **`@NexusRemote()` cannot resolve a name.** Either set `name: 'checkout'` explicitly or ensure `package.json#name` is camelCase.
- **`federation.config.json` not regenerated.** `prebuild` must run before `ng build`. Verify by checking the file's mtime.
- **Browser loads stale `remoteEntry.json`.** The gateway sets `Cache-Control: no-store` on this URL. If you serve through your own CDN, mirror that header.
- **CORS error on `/api/remotes`.** The registry's `ALLOWED_ORIGINS` does not include your host. Update `.env`.

## Next

- [Guide: Angular host](guide-angular-host.md) — load this remote.
- [Guide: mixed-stack](guide-mixed-stack.md) — load Vue and React remotes in an Angular host.
- [Workflows: zero-downtime deploys](../workflows/zero-downtime.md)
