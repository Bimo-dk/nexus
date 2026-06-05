---
id: nexus-cli
title: '@bimo-dk/nexus-cli (bnx)'
sidebar_position: 9
description: The bnx CLI for Nexus. Scaffold remotes for Angular, Vue, or React; manage hosts and gates; publish, status, health, and bnx dev.
keywords:
  - bnx cli
  - nexus cli
  - micro frontend scaffold
  - bnx dev
  - bnx hosts gates
---

# @bimo-dk/nexus-cli (bnx)

`bnx` is the developer-facing CLI for Nexus. Scaffold remotes, manage hosts and gates, run the local dev environment, check health, publish.

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

Registers the current remote with the registry. Reads `federation.config.json` (Angular) or the `nexusVite` config (Vue / React) to determine name and exposed module.

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
bnx dev
bnx dev status                     # what's running locally
bnx dev --gate storefront-prod     # impersonate a specific gate
bnx dev --port 9001
bnx dev --no-open
bnx dev --no-autostart
```

Configuration lives in `nexus.config.json`:

```jsonc
{
  "environments": {
    "staging": {
      "publicUrl": "https://nexus-staging.example.com",
      "tokenEnv": "NEXUS_STAGING_TOKEN"
    }
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
