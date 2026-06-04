---
id: nexus-cli
title: '@bimo-dk/nexus-cli (bnx)'
sidebar_position: 8
description: "bnx — the Nexus CLI. Generate remotes, publish to the registry, toggle features, run the dev proxy, and manage the platform from the terminal. bnx generate remote, bnx publish, bnx dev, bnx toggle."
keywords: [bnx CLI Angular, Nexus CLI micro frontend, bnx generate remote, Angular micro frontend CLI tools]
---

# @bimo-dk/nexus-cli — `bnx`

The command-line frontend to Bimo-Nexus. One binary, one config file, one `bnx dev` command for the local hot-reload workflow.

```bash
npm install -g @bimo-dk/nexus-cli
bnx --version
```

## Commands

| Command | Description |
|---|---|
| `bnx generate remote` | Scaffold a new remote (interactive prompts) |
| `bnx publish` | Register the current remote with the registry |
| `bnx status` | Table of all remotes in the registry |
| `bnx health` | Health check every remote, with response times |
| `bnx dev` | Start the local dev environment — proxy + autostart remotes |
| `bnx dev status` | Which configured remotes are running |
| `bnx --version` | Version |

## `bnx generate remote`

Interactive scaffold. Asks for:

- `name` (camelCase) — e.g. `checkout`
- `route` (kebab-case) — e.g. `checkout`

It then clones [`nexus-remote-templat`](../services/remotes.md), substitutes `__REMOTE_NAME__` and `__REMOTE_ROUTE__`, and writes the result into `./<name>/`. From there:

```bash
cd checkout
npm install
npm run build
```

`@bimo-dk/nexus-build` runs as `prebuild` and produces the `federation.config.json`.

## `bnx publish`

Reads `federation.config.json` for the current remote and POSTs it to the registry.

```bash
export NEXUS_TOKEN=...
export REGISTRY_URL=http://localhost:3000
export REMOTE_URL=https://cdn.example.com/checkout/remoteEntry.json
bnx publish
# ✓ Registered "checkout"
```

The CLI loads a `.env` from the cwd, so you typically only set `REMOTE_URL` per CI job.

Environment variables:

| Variable | Required | Default |
|---|---|---|
| `NEXUS_TOKEN` | yes | — |
| `REGISTRY_URL` | no | `http://localhost:3000` |
| `REMOTE_URL` | no | `/remotes/<name>/remoteEntry.json` |
| `REMOTE_ROUTE` | no | derived from `name` |

## `bnx status`

```bash
$ bnx status
┌──────────┬──────────────┬─────────┬──────┐
│ name     │ route        │ enabled │ url  │
├──────────┼──────────────┼─────────┼──────┤
│ checkout │ checkout     │ ✓       │ /... │
│ orders   │ orders       │ ✗       │ /... │
└──────────┴──────────────┴─────────┴──────┘
```

## `bnx health`

```bash
$ bnx health
checkout            8ms     healthy
orders              45ms    healthy
inventory           ✗       down (ECONNREFUSED)
```

Hits each remote's `<url>/../health` directly. Useful in CI to verify a freshly deployed environment.

## `bnx dev` — the local dev workflow

`bnx dev` is what you run as a developer to work on one or two remotes locally while everything else is served from staging.

### What it does

1. Reads `nexus.config.json` from the current directory.
2. Detects which configured remotes are already running on localhost.
3. Autostarts any remote with `autostart: true` that isn't running yet (runs `npm start` in `path`).
4. Starts a proxy on `proxyPort` that:
   - Routes `/remotes/<name>/*` to your local dev server.
   - Routes everything else (host, registry, `/api`, `/ws`) to `baseEnv`.
5. Opens the browser at the proxy URL.

You see the full app — but the remotes you're working on come from your local Angular dev server (HMR), and host/registry/other remotes come from staging.

### `nexus.config.json` schema

```jsonc
{
  "environments": {
    "staging": {
      "publicUrl": "https://nexus-staging.bimo.dk",
      "registryUrl": "https://nexus-staging.bimo.dk/api",  // optional
      "tokenEnv": "NEXUS_STAGING_TOKEN"                   // optional
    },
    "prod": {
      "publicUrl": "https://nexus.bimo.dk",
      "tokenEnv": "NEXUS_PROD_TOKEN"
    }
  },
  "dev": {
    "baseEnv": "staging",
    "proxyPort": 9000,
    "host": { "mode": "proxy" },           // only 'proxy' is implemented today
    "remotes": {
      "checkout": {
        "port": 4201,
        "path": "./packages/checkout",
        "autostart": true
      },
      "orders": {
        "port": 4202,
        "path": "./packages/orders",
        "autostart": false                 // start it yourself
      }
    },
    "logRouting": true
  }
}
```

### Example session

```bash
$ bnx dev
Bimo-Nexus dev
  config:     /work/myapp/nexus.config.json
  baseEnv:    staging (https://nexus-staging.bimo.dk)
  proxyPort:  9000

  ✓ checkout         listening on :4201 (verified federation entry)
  ↑ orders           autostart npm start in ./packages/orders (port 4202)
  ✓ orders           listening on :4202 (verified federation entry)

╭────────────────────────────────────────────────────────────
│  Open this:  http://localhost:9000
├────────────────────────────────────────────────────────────
│  Shared env: https://nexus-staging.bimo.dk
│  Local remotes:
│    /remotes/checkout         -> http://localhost:4201
│    /remotes/orders           -> http://localhost:4202
╰────────────────────────────────────────────────────────────
Press Ctrl+C to stop everything.
```

`Ctrl+C` stops the proxy *and* every dev server it autostarted.

### Options

```
bnx dev [options]
  -c, --config <file>     Path to nexus.config.json (default: search cwd)
  -p, --port <port>       Override proxy port
  --no-open               Do not open browser
  --no-autostart          Do not autostart dev servers (manual mode)
```

### `bnx dev status`

```bash
$ bnx dev status
Bimo-Nexus dev — status
  config:  /work/myapp/nexus.config.json
  baseEnv: staging -> https://nexus-staging.bimo.dk

  Shared env: reachable

  Local remotes:
    checkout            :4201   serving remoteEntry.json
    orders              :4202   not running
```

## `bnx dev` vs. the legacy dev proxy

[`nexus-proxy`](../services/proxy.md) is the underlying proxy with `nexus.dev.json` as its config. `bnx dev` is the higher-level wrapper that adds:

- A multi-environment config (`environments.staging`, `environments.prod`)
- Auto-detection of which dev servers are already running
- Auto-start of dev servers via `npm start`
- Federation entry validation before declaring a remote "ready"
- Open-the-browser convenience

New apps should use `bnx dev`. The `nexus-proxy` repo and its `nexus.dev.json` remain supported for the `nexus` orchestrator itself.
