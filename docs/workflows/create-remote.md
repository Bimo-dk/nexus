---
id: create-remote
title: Create a new remote
sidebar_position: 1
---

# Create a new remote

End-to-end: from "I need a new remote" to a registered, deployable container.

## Pre-flight

- A running registry the new remote can register against (local Docker stack, dev, staging — any).
- `NEXUS_TOKEN` matching the registry's `NEXUS_TOKEN`.
- `@bimo-dk/nexus-cli` installed: `npm install -g @bimo-dk/nexus-cli`.
- Auth to GitHub Packages so the build can install `@bimo-dk/*` — see [reference/security](../reference/security.md#github-packages-auth).

## 1. Scaffold

```bash
bnx generate remote
? Remote name (camelCase): checkout
? Route path (kebab-case):  checkout
```

Output:

```
✓ Cloned nexus-remote-templat to ./checkout
✓ Substituted __REMOTE_NAME__ and __REMOTE_ROUTE__
```

The scaffold contains:

- `src/app/remote-entry/entry.component.ts` — your only entry point
- `federation.config.js` + `federation.config.json` — leave alone, regenerated at build
- `nginx.conf` — static-file server + `/health`
- `Dockerfile` — multi-stage with BuildKit secret for `NODE_AUTH_TOKEN`

## 2. Implement

Edit `src/app/remote-entry/entry.component.ts`.

**Default export (scaffold default — no extra config needed):**

```ts
import { Component, signal } from '@angular/core';
import { NexusRemote } from '@bimo-dk/nexus-build';

@NexusRemote()
@Component({
  selector: 'app-checkout',
  standalone: true,
  template: `
    <h1>Checkout</h1>
    <p>Cart total: <strong>{{ total() }}</strong></p>
  `,
})
export default class CheckoutComponent {
  readonly total = signal(0);
}
```

`@NexusRemote()` with no options defaults `exposeAs` to `'RemoteEntry'`, which matches the scaffold's `federation.config.json` expose key `./RemoteEntry`. This is the zero-config path.

**Named export (use when you expose the module under a custom key):**

```ts
import { Component, signal } from '@angular/core';
import { NexusRemote } from '@bimo-dk/nexus-build';

@NexusRemote({ exposeAs: 'CheckoutPage' })
@Component({
  selector: 'app-checkout',
  standalone: true,
  template: `<h1>Checkout</h1>`,
})
export class CheckoutPageComponent {
  readonly total = signal(0);
}
```

When `exposeAs` is set, the federation config exposes `./CheckoutPage` and the remote self-registers with `exposedModule: './CheckoutPage'`. Both the federation build and the registry entry stay in sync automatically.

Add child routes, services, lazy modules — anything Angular allows. This file's class is what the host mounts.

## 3. Run standalone (sanity check)

```bash
cd checkout
npm install
npm start            # ng serve --port 8700 --host 0.0.0.0
```

Open http://localhost:8700 — you see `AppComponent` (a thin wrapper around your entry component, used only for standalone runs). The host never sees this wrapper.

## 4. Build the production bundle

```bash
npm run build
```

What happens:

```
ng build
  ├─ prebuild
  │   └─ nexus-build     ◄── scans @NexusRemote, writes federation.config.json
  └─ ng build            ◄── reads federation.config.js → federation.config.json
```

Output: `dist/checkout/browser/`.

## 5. Register with the registry

### Via CLI (recommended)

```bash
export NEXUS_TOKEN=<your-token>
export REGISTRY_URL=http://localhost:8668
export REMOTE_URL=/remotes/checkout/remoteEntry.json
bnx publish
# ✓ Registered "checkout"
```

`bnx publish` reads `federation.config.json` and POSTs:

```json
{
  "name":          "checkout",
  "url":           "/remotes/checkout/remoteEntry.json",
  "exposedModule": "./RemoteEntry",
  "routePath":     "checkout"
}
```

The registry validates it, persists it, and broadcasts `remotes_changed`. The host adds the route. The user can navigate to `/checkout` immediately.

### Via portal

Open http://localhost:8669 → **Remotes → Add remote**, fill in the same fields. Same result, with a clickier UI.

### Via the runtime (automatic at container start)

If you use `provideNexusRemote(...)` in `bootstrap.ts`, the remote calls `POST /api/remotes` (or `PUT` if it already exists) on container startup. So in production you typically:

1. Deploy the container with the right `REGISTRY_URL` and `NEXUS_TOKEN` in `/assets/config.json`.
2. Container starts, registers itself, host picks it up.
3. No manual `bnx publish` needed.

The remote reads `UPSTREAM_URL` from `/assets/config.json` and includes it in the `POST /api/remotes` payload. Gateway reads this field when generating its nginx proxy rules. If `UPSTREAM_URL` is not set, gateway cannot proxy to this remote — set it to the remote's internal Docker URL (e.g. `http://my-service-name:80`).

## 6. Verify

```bash
bnx status
# ┌──────────┬──────────┬─────────┬───────────────────────────────────────┐
# │ name     │ route    │ enabled │ url                                   │
# ├──────────┼──────────┼─────────┼───────────────────────────────────────┤
# │ checkout │ checkout │ ✓       │ /remotes/checkout/remoteEntry.json    │
# └──────────┴──────────┴─────────┴───────────────────────────────────────┘

bnx health
# checkout       12ms    healthy
```

Open http://localhost:8668/checkout — you see your remote inside the host shell.

## 7. Containerize for production

```bash
docker build \
  --secret id=node_auth_token,env=NODE_AUTH_TOKEN \
  -t my-registry/checkout:latest \
  ./checkout

docker push my-registry/checkout:latest
```

Then deploy it to wherever the rest of the stack runs. A minimal service definition:

```yaml
# In your docker-compose.yml:
checkout:
  image: my-registry/checkout:latest
  container_name: checkout
  expose:
    - "80"
  environment:
    REGISTRY_INTERNAL_URL: http://registry:3000
    NEXUS_TOKEN: ${NEXUS_TOKEN}
    PUBLIC_URL: /remotes/checkout/remoteEntry.json
    UPSTREAM_URL: http://checkout:80
  networks:
    - nexus-net
```

The service name in docker-compose (`checkout`) does not need to match anything in the gateway. Only `UPSTREAM_URL` matters — that is what gateway proxies to.

:::tip No gateway config needed
Gateway discovers the new remote automatically when it registers itself at startup. Set `PUBLIC_URL` and `UPSTREAM_URL` in your container's environment and the gateway will proxy `/remotes/<name>/` to your service.
:::

## Add a route inside the remote

```ts
// src/app/app.routes.ts (or wherever)
export const routes: Routes = [
  { path: '', component: EntryComponent },
  { path: 'thank-you', loadComponent: () => import('./thank-you.component').then(m => m.ThankYouComponent) },
];
```

The host already mounted you at `/checkout`, so internally your routes are `/checkout`, `/checkout/thank-you`, etc. Use `RouterModule.forChild(routes)` or pass routes to a standalone provider — Angular's router merges child trees automatically.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Build fails on `nexus-build` with "no @NexusRemote found" | Your entry component is missing the decorator, or it lives outside `src/`. |
| `POST /api/remotes` returns 401 | `NEXUS_TOKEN` doesn't match the registry's `NEXUS_TOKEN`. |
| `POST /api/remotes` returns 409 | A remote with that name already exists. Use `PUT` (or delete first). |
| Remote registered but gateway returns 502 | `UPSTREAM_URL` is wrong or the container is not on the nexus-net network. Check `docker compose logs gateway` for the nginx upstream error. |
| Remote registered but gateway hasn't reloaded yet | Gateway reloads on `remotes_changed` — wait 1-2 seconds. If it never reloads, check `docker compose logs gateway` for WebSocket connection errors to the registry. |
| Host shows "failed remote" with `loadRemoteModule` error | `remoteEntry.json` was reachable but `exposedModule` key is wrong. Verify `nexus-build` ran and that `exposeAs` in the decorator matches the key in `federation.config.json`. |

## Related

- [`@bimo-dk/nexus-build`](../packages/nexus-build.md) — decorator + CLI internals.
- [`@bimo-dk/nexus-runtime`](../packages/nexus-runtime.md) — `provideNexusRemote(...)`.
- [Local dev workflow](dev-mode.md) — run your remote against a shared environment.
