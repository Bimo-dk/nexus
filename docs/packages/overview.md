---
id: overview
title: Packages overview
sidebar_position: 1
---

# Packages

Seven npm packages published from the [`nexus-packages`](https://github.com/Bimo-dk/nexus-packages) monorepo. They are all scoped `@bimo-dk/*`, all written in TypeScript, all built with `turbo`, and all versioned with Changesets.

## What's in each

| Package | Purpose |
|---|---|
| [`@bimo-dk/nexus-core`](nexus-core.md) | TypeScript types + constants + validators. Zero runtime deps. |
| [`@bimo-dk/nexus-client`](nexus-client.md) | `RegistryClient` (HTTP) + `RegistryWebSocket` (WS). |
| [`@bimo-dk/nexus-build`](nexus-build.md) | `@NexusRemote` decorator + `nexus-build` CLI — generates `federation.config.json` automatically. |
| [`@bimo-dk/nexus-runtime`](nexus-runtime.md) | Angular providers — `provideNexusHost`, `provideNexusRemote`. |
| [`@bimo-dk/nexus-ui`](nexus-ui.md) | Angular Material component library — health badge, offline banner, status card. |
| [`@bimo-dk/nexus-testing`](nexus-testing.md) | `MockRegistryServer` + mock factories. devDependency only. |
| [`@bimo-dk/nexus-cli`](nexus-cli.md) | `bnx` CLI — generate, publish, status, health, dev. |

## Dependency graph

```
core ◄────────────────┐
  ▲                   │
  ├─── client ◄───────┤
  ├─── ui ◄───────────┤    (no client dep)
  ├─── build ◄────────┤    (no runtime dep)
  ├─── runtime ◄──────┤    (depends on client + build)
  ├─── testing ◄──────┤    (depends on core + client)
  └─── cli ◄──────────┤    (depends on core + client + build)
```

`core` is the root. Everything else depends on it directly or transitively.

## Which package do I need?

| Role | Install |
|---|---|
| Writing a remote | `@bimo-dk/nexus-build` (dev), `@bimo-dk/nexus-runtime` (deps), `@bimo-dk/nexus-core` (peer) |
| Writing a host | `@bimo-dk/nexus-runtime`, `@bimo-dk/nexus-ui` |
| Writing a registry client (Node or browser) | `@bimo-dk/nexus-client` |
| Writing tests | `@bimo-dk/nexus-testing` |
| Operating the platform from the terminal | `@bimo-dk/nexus-cli` (global) |
| Sharing types across services | `@bimo-dk/nexus-core` |

`nexus-runtime` already pulls `nexus-client` and `nexus-build` transitively, so for the Angular case you typically install:

```bash
npm install @bimo-dk/nexus-runtime
npm install -D @bimo-dk/nexus-build
```

## Authentication for GitHub Packages

`@bimo-dk/*` are hosted on **GitHub Packages**, not the public npm registry. Each consuming repo needs `.npmrc`:

```ini
@bimo-dk:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

And the env-var `NODE_AUTH_TOKEN` (not `GITHUB_TOKEN`) set to a PAT with `read:packages` scope.

In Dockerfiles, use BuildKit secrets to avoid leaking the token into image layers:

```dockerfile
# syntax=docker/dockerfile:1.7
RUN --mount=type=secret,id=node_auth_token,required=true \
    NODE_AUTH_TOKEN=$(cat /run/secrets/node_auth_token) \
    npm install --legacy-peer-deps
```

See [security](../reference/security.md#github-packages-auth) for the full setup.

## Release flow

```
1. Change one or more packages
2. npm run changeset          # interactive: pick packages, bump, write summary
3. git commit + push
4. PR → main triggers publish.yml:
     - changeset version  → bumps + writes CHANGELOG
     - turbo build + test
     - changeset publish  → npm
     - github release created
```

`verify/` in `nexus-packages` runs after publish to smoke-test that the published tarballs actually work — a guardrail in case a build script silently dropped a file.
