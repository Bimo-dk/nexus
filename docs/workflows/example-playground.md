---
id: example-playground
title: Example playground
sidebar_position: 5
---

# NexusShop — example playground

Repo: [`nexus-example`](https://github.com/Bimo-dk/nexus-example)

A complete webshop demo showing all central Nexus features in one runnable stack. Five remotes, each with its own responsibility, wired together by the host using `nexusRoute()` and `<nexus-component>`. Pre-built images for gateway, portal and registry are pulled from ghcr.io; host and the five remotes build locally from editable source.

## What is demonstrated

| Feature | Where |
|---|---|
| `nexusRoute()` — route-based pages | All 5 remotes mounted as top-level routes |
| `<nexus-component>` — drop-in tag | MiniCart from the cart remote in the host navbar |
| Cross-remote composition | Host's `AppComponent` imports `NexusComponent` and renders MiniCart |
| Self-registration via `UPSTREAM_URL` | Every remote registers itself at startup — no manual `bnx publish` |
| Docker service names ≠ remote names | `remote-catalog` service registers as remote `catalog` |
| `@NexusComponent` metadata | Portal `/catalog` page shows all 7 tagged components |

## Remotes

| Remote | Docker service | Route | Exposed components |
|---|---|---|---|
| `catalog` | `remote-catalog` | `/products` | `CatalogPage` |
| `product` | `remote-product` | `/products/:id` | `ProductPage` |
| `cart` | `remote-cart` | `/cart` | `CartPage`, `MiniCart` |
| `checkout` | `remote-checkout` | `/checkout` | `CheckoutPage` |
| `account` | `remote-account` | `/account` | `AccountPage` |

## Repo layout

```
nexus-example/
├── docker-compose.yml     9 services
├── .env.example
├── nexus.config.json      bnx dev config
├── host/                  NexusShop layout shell — navbar, router-outlet, footer
├── remote-catalog/        Product list with category filter
├── remote-cart/           Cart page + MiniCart navbar widget
├── remote-product/        Product detail with reviews
├── remote-checkout/       Checkout form
└── remote-account/        Account + order history
```

## Services

| Service | Image | Source |
|---|---|---|
| `gateway` | `ghcr.io/bimo-dk/nexus-gateway` | pre-built |
| `portal` | `ghcr.io/bimo-dk/nexus-portal` | pre-built |
| `registry` | `ghcr.io/bimo-dk/nexus-registry` | pre-built |
| `host` | built locally | `./host/` |
| `remote-catalog` | built locally | `./remote-catalog/` |
| `remote-cart` | built locally | `./remote-cart/` |
| `remote-product` | built locally | `./remote-product/` |
| `remote-checkout` | built locally | `./remote-checkout/` |
| `remote-account` | built locally | `./remote-account/` |

## Quick start

```bash
git clone https://github.com/Bimo-dk/nexus-example.git
cd nexus-example

cp .env.example .env
# Set NEXUS_TOKEN and NODE_AUTH_TOKEN (GitHub PAT with read:packages)

echo "$NODE_AUTH_TOKEN" | docker login ghcr.io -u <your-github-user> --password-stdin

docker compose up --build
```

When everything is healthy:

- http://localhost:8668 — NexusShop
- http://localhost:8669 — admin portal + component catalog

## Try the developer loops

### Edit a remote

```bash
# Open ./remote-catalog/src/app/remote-entry/catalog-page.component.ts
# Change the template, add a product, tweak the filter
docker compose up -d --build remote-catalog
# Hard-refresh browser — your change is live
```

All other remotes keep running from their existing containers while you rebuild the one you care about.

### Edit the host

```bash
# Open ./host/src/app/app.component.html (navbar, layout)
# Open ./host/src/app/app.routes.ts  (routes)
docker compose up -d --build host
# Hard-refresh browser
```

### Add a new remote

1. Scaffold with `bnx generate remote`:
   ```bash
   bnx generate remote
   ? Remote name: wishlist
   ? Route path: wishlist
   ```
2. Add a service to `docker-compose.yml`:
   ```yaml
   remote-wishlist:
     build:
       context: ./remote-wishlist
       secrets:
         - node_auth_token
     expose: ["80"]
     environment:
       REGISTRY_INTERNAL_URL: http://registry:3000
       NEXUS_TOKEN: ${NEXUS_TOKEN:-dev-token}
       PUBLIC_URL: /remotes/wishlist/remoteEntry.json
       UPSTREAM_URL: http://remote-wishlist:80
     depends_on:
       registry: { condition: service_healthy }
     networks: [nexus-net]
   ```
3. `docker compose up --build remote-wishlist`

The remote registers itself on startup. Gateway reloads. The route is live at `/wishlist` within seconds — no other file to edit.

### Toggle a remote from the portal

1. http://localhost:8669 → **Remotes**
2. Disable `catalog` — the host immediately removes the `/products` route via WebSocket.
3. Re-enable it — the route comes back. The user never sees a restart.

## How the host mounts remotes

```ts
// host/src/app/app.routes.ts
import { nexusRoute } from '@bimo-dk/nexus-runtime';

export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },
  nexusRoute({ path: 'products',     remote: 'catalog',  expose: 'CatalogPage'  }),
  nexusRoute({ path: 'products/:id', remote: 'product',  expose: 'ProductPage'  }),
  nexusRoute({ path: 'cart',         remote: 'cart',     expose: 'CartPage'     }),
  nexusRoute({ path: 'checkout',     remote: 'checkout', expose: 'CheckoutPage' }),
  nexusRoute({ path: 'account',      remote: 'account',  expose: 'AccountPage'  }),
];
```

```ts
// host/src/app/app.component.ts
import { NexusComponent } from '@bimo-dk/nexus-runtime';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NexusComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  cartCount = signal(3);
}
```

```html
<!-- host/src/app/app.component.html -->
<header class="navbar">
  <a class="logo" routerLink="/">NexusShop</a>
  <nav>
    <a routerLink="/products" routerLinkActive="active">Produkter</a>
    <a routerLink="/account"  routerLinkActive="active">Konto</a>
  </nav>
  <div class="navbar-right">
    <!-- MiniCart comes from the cart remote — different team, different container -->
    <nexus-component remote="cart" expose="MiniCart" [inputs]="{ itemCount: cartCount() }" />
  </div>
</header>
<main><router-outlet /></main>
```

## How a remote registers itself

```ts
// remote-catalog/src/app/app.config.ts
provideNexusRemote({
  entry: CatalogPageComponent,
  configDefaults: {
    registryUrl: 'http://registry:3000',
    nexusToken: 'dev-token',
  },
})
```

```ts
// remote-catalog/src/app/remote-entry/catalog-page.component.ts
@NexusRemote({ exposeAs: 'CatalogPage' })   // tells the registry which module key to use
@NexusComponent({ title: 'Catalog page', category: 'pages', tags: ['products', 'shop'] })
@Component({ ... })
export class CatalogPageComponent { ... }
```

On startup, `SelfRegisterService` reads the decorator metadata, builds the registration payload from `REGISTRY_INTERNAL_URL` / `PUBLIC_URL` / `UPSTREAM_URL`, and `POST /api/remotes`. The host's WebSocket subscription fires immediately and the route becomes active.

## How gateway routes

The pre-built gateway image has no hardcoded remote names. At startup it calls `GET /api/remotes` on the registry and generates nginx proxy rules for every enabled remote using each remote's `UPSTREAM_URL`. When a remote changes, the registry broadcasts `remotes_changed` and gateway reloads routes without a container restart.

| URL prefix | Target |
|---|---|
| `/host/*` | `host:80/*` |
| `/remotes/<name>/*` | remote's `UPSTREAM_URL` (from registry) |
| `/api/*` | `registry:3000/api/*` |
| `/ws` | `registry:3000/ws` |

## Troubleshooting

| Problem | Solution |
|---|---|
| `denied: requested access to the resource is denied` | Log in: `docker login ghcr.io` with a PAT |
| Host build fails with `401 Unauthorized` | `NODE_AUTH_TOKEN` missing or lacks `read:packages` |
| Browser shows "Host shell unavailable" | Host container not up yet — `docker compose logs host` |
| Portal shows no remotes | Registry volume empty — `docker compose down -v && docker compose up` |
| Remote registered but page is blank | `exposeAs` in the decorator does not match the federation `exposes` key — rebuild the remote |
| MiniCart shows loading spinner forever | The `cart` remote is not healthy — check `docker compose logs remote-cart` |

## What this example is NOT

- Not a production template — it uses stub data and no real backend.
- Not a replacement for `bnx dev` (a far better loop for a real product remote).
- Not exhaustive — source files are short on purpose so you can read them all in an afternoon.

Use it as a 60-minute introduction to the platform, then scaffold your own remote with `bnx generate remote`.
