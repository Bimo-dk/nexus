---
id: nexus-cli
title: '@bimo-dk/nexus-cli (bnx)'
sidebar_position: 9
description: The bnx CLI for Nexus. Bootstrap a workspace, scaffold hosts/remotes/components across Angular, Vue, and React; multi-gateway-stack dev proxy; publish, status, health, and registry management.
keywords:
  - bnx cli
  - bnx init
  - bnx generate host
  - bnx generate component
  - nexus cli
  - micro frontend scaffold
  - bnx dev
  - multi environment dev
  - bnx hosts gates
---

# @bimo-dk/nexus-cli (bnx)

`bnx` is the developer-facing CLI for Nexus. Bootstrap a workspace, scaffold hosts/remotes/components, run the local dev environment against any of your gateway stacks, manage hosts and gates, publish.

For a guided end-to-end walkthrough, read [Local dev mode — step by step](../workflows/dev-mode.md). This page is the per-command reference.

## Install

```bash
npm install -g @bimo-dk/nexus-cli
# pnpm add -g @bimo-dk/nexus-cli
# yarn global add @bimo-dk/nexus-cli
```

## Authentication

Every command that talks to the registry reads `NEXUS_TOKEN` and `REGISTRY_URL` from the environment (and from `.env` in the current directory).

```bash
export NEXUS_TOKEN=your-secret
export REGISTRY_URL=http://localhost:8668
```

## Commands

### `bnx init`

Bootstraps a new workspace. Writes `nexus.config.json` with one or more gateway stacks (local docker-compose, staging, prod, custom) and a `.env.example` listing every required token env-var. Optionally scaffolds a host inline (delegates to `bnx generate host`).

```bash
bnx init
? Which gateway stacks (environments) will you work against? (Space to select)
  [x] local (docker-compose: gateway on http://localhost:8668)
  [x] staging (e.g. https://nexus-staging.bimo.dk)
  [ ] prod (e.g. https://nexus.bimo.dk)
? [local]   gateway URL: http://localhost:8668
? [local]   env-var name that holds NEXUS_TOKEN for this stack: NEXUS_TOKEN_LOCAL
? [staging] gateway URL: https://nexus-staging.bimo.dk
? [staging] env-var name that holds NEXUS_TOKEN for this stack: NEXUS_TOKEN_STAGING
? Default stack for `bnx dev` (overridable with --env): staging
? Scaffold a host now? Yes
```

Refuses to overwrite an existing `nexus.config.json`. Each stack records the *env-var name* that holds its token, never the token itself.

### `bnx generate host`

Scaffolds a new host shell from `nexus-host-template-{angular,vue,react}`.

```bash
bnx generate host
? Host name (kebab-case, e.g. shop-host): admin
? Host framework: angular | vue | react
```

Flags:
- `-n, --name <name>` — preset name.
- `-f, --framework <fw>` — preset framework.

### `bnx generate component <Name>`

Scaffolds a single component file with `defineNexusComponent` (Vue/React) or `@NexusComponent` (Angular) metadata. Framework is autodetected from the current remote's `package.json`. The next `npm run build` picks it up automatically through `nexusViteAuto()` (Vue/React) or the Angular scanner — no `vite.config.ts` edit per component.

```bash
bnx generate component Cart -c commerce -d "Sticky cart" -t "vue,cart"
+ wrote src/Cart.vue
```

Flags:
- `-f, --framework <fw>` — override the autodetected framework.
- `-c, --category <category>` — catalog category.
- `-d, --description <text>` — one-line catalog description.
- `-t, --tags <csv>` — comma-separated catalog tags.
- `-o, --out-dir <dir>` — output directory (default `src`).

### `bnx generate remote`

```bash
bnx generate remote
? Remote name (camelCase): checkout
? Route path (kebab-case): checkout
? Framework: angular | vue | react
```

Clones the matching template, substitutes name and route, prints next steps.

Flags:
- `-n, --name <name>` — preset name.
- `-r, --route <route>` — preset route.

### `bnx publish`

Registers the current remote with the registry. Reads `federation.config.json` to determine name and exposed module, then reports how many catalog entries the build produced (read from `dist/catalog.json`). The portal aggregates the per-remote catalog files at request time, so this count is a sanity check that your component metadata made it into the artifact.

```
> Publishing "cart" to https://nexus-staging.bimo.dk/api/remotes
+ Registered "cart"
  catalog: 4 components in dist/catalog.json
    - ./RemoteEntry         Cart entry
    - ./CartBadge           Sticky cart badge
    - ./CartDrawer          Slide-in cart drawer
    - ./CheckoutButton      Checkout CTA button
```

### `bnx status`

Three-section table.

```
Hosts
  storefront (angular)   enabled   1 gate
  admin      (vue)       enabled   1 gate

Gates
  storefront-prod        shop.example.com   -> storefront
  admin-prod             admin.example.com  -> admin

Remotes
  catalog  (global)         enabled   /remotes/catalog/*    http://remote-catalog:80
  checkout (global)         enabled   /remotes/checkout/*   http://remote-checkout:80
  users    (host:admin)     enabled   /remotes/users/*      http://remote-users:80
```

### `bnx health`

Health-checks every remote sequentially, prints response time and status.

```
catalog   healthy    47 ms
checkout  healthy    62 ms
users     down       (connection refused)
```

### `bnx dev`

Starts the local dev proxy with autostart for any configured remotes.

```bash
bnx dev                            # uses dev.baseEnv from nexus.config.json
bnx dev --env local                # work against http://localhost:8668 (docker-compose)
bnx dev --env staging              # work against staging
bnx dev --env prod                 # read-only smoke against prod
bnx dev status                     # what's running locally
bnx dev --gate storefront-prod     # impersonate a specific gate (sets NEXUS_GATE_NAME)
bnx dev --port 9001
bnx dev --no-open
bnx dev --no-autostart
```

Configuration lives in `nexus.config.json` — written by `bnx init` and editable by hand. Every entry under `environments` is a gateway stack the workspace can target:

```jsonc
{
  "environments": {
    "local":   { "publicUrl": "http://localhost:8668",         "tokenEnv": "NEXUS_TOKEN_LOCAL"   },
    "staging": { "publicUrl": "https://nexus-staging.bimo.dk", "tokenEnv": "NEXUS_TOKEN_STAGING" },
    "prod":    { "publicUrl": "https://nexus.bimo.dk",         "tokenEnv": "NEXUS_TOKEN_PROD"    }
  },
  "dev": {
    "baseEnv": "staging",
    "proxyPort": 9000,
    "remotes": {
      "checkout": { "port": 4201, "path": "./packages/checkout", "autostart": true },
      "orders":   { "port": 4202, "path": "./packages/orders",   "autostart": false }
    },
    "logRouting": true
  }
}
```

`dev.baseEnv` is the default; `bnx dev --env <name>` overrides per run.

See [workflows: dev-mode](../workflows/dev-mode.md) for the full recipe.

### `bnx hosts`

```bash
bnx hosts list
bnx hosts create
? Host name (camelCase): admin
? URL: http://host-admin:80
? Framework (angular/vue/react): vue
? Remote entry: /remoteEntry.json
? Exposed module: ./AppShell
bnx hosts toggle admin
```

### `bnx gates`

```bash
bnx gates list
bnx gates create
? Gate name: admin-prod
? Domain: admin.example.com
? Host (id or name): admin
```

## Output formatting

All commands use color where the terminal supports it. Use `NO_COLOR=1` to disable.

`bnx status` and `bnx hosts list` accept `--json` for machine-readable output (handy for CI).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | success |
| `1` | command failed (validation, network, etc.) |
| `2` | misuse — bad flag, missing required arg |
| `64` | could not reach the registry within the retry window |

## Next

- [Workflows: dev-mode](../workflows/dev-mode.md)
- [Workflows: hosts-and-gates-setup](../workflows/hosts-and-gates-setup.md)
- [Services: proxy](../services/proxy.md) — what `bnx dev` orchestrates.
