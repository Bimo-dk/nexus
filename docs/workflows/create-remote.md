---
id: create-remote
title: Create a new remote
sidebar_position: 1
---

# Create a new remote

End-to-end: from "I need a new remote" to a registered, deployable container.

## Pre-flight

- A running registry the new remote can register against (local Docker stack, dev, staging — any).
- `BIMO_TOKEN` matching the registry's `NEXUS_TOKEN`.
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

Edit `src/app/remote-entry/entry.component.ts`:

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
export BIMO_TOKEN=<your-token>
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

Then deploy it to wherever the rest of the stack runs (Compose, Swarm, k8s). The gateway routes `/remotes/checkout/*` to `checkout:80`.

:::important
The remote's container name on the docker network **must** match the `/remotes/<name>` segment in the gateway's `nginx.conf`. The default templates use `remote-one`, `remote-two`. For your new remote, you'll need to extend the gateway's nginx config to add `location ^~ /remotes/checkout/` — see [gateway docs](../services/gateway.md#adding-a-route-for-a-new-remote).
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
| `POST /api/remotes` returns 401 | `BIMO_TOKEN` doesn't match the registry's `NEXUS_TOKEN`. |
| `POST /api/remotes` returns 409 | A remote with that name already exists. Use `PUT` (or delete first). |
| Host shows the remote in the sidebar but the route 404s | The federation entry returned 404 — check gateway's `nginx.conf` has a `/remotes/<name>/` block. |
| Host shows "failed remote" with `loadRemoteModule` error | `remoteEntry.json` was reachable but `exposedModule` key is wrong. Verify `nexus-build` ran. |

## Related

- [`@bimo-dk/nexus-build`](../packages/nexus-build.md) — decorator + CLI internals.
- [`@bimo-dk/nexus-runtime`](../packages/nexus-runtime.md) — `provideNexusRemote(...)`.
- [Local dev workflow](dev-mode.md) — run your remote against a shared environment.
