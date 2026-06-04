---
id: environment
title: Environment variables
sidebar_position: 1
---

# Environment variables

Complete table of every environment variable read by Bimo-Nexus services, the package that reads it, and a sensible default.

## Orchestrator (.env in `nexus`)

| Variable | Default | Notes |
|---|---|---|
| `NEXUS_TOKEN` | `change-this-to-a-strong-secret-in-production` | Shared secret across registry/host/portal/gateway |
| `ALLOWED_ORIGINS` | `http://localhost:8666,...,8671` | CORS allowlist for the registry |
| `REGISTRY_URL` | `http://localhost:3000` | Default registry URL injected into Angular apps |
| `HOST_REMOTE_ENTRY` | `/host/remoteEntry.json` | Gateway's runtime config: where the host federation entry is |
| `HOST_EXPOSED_MODULE` | `./AppShell` | Gateway's runtime config: which exposed module to load |
| `NODE_AUTH_TOKEN` | — | GitHub PAT with `read:packages` — used as a BuildKit secret |

## Registry (`nexus-registry`)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NEXUS_TOKEN` | — | Required. Matched against `X-Nexus-Token`. |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS allowlist. Use `*` only in dev. |
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | How often the health-check loop pings remotes |
| `LOG_BUFFER_CAPACITY` | `500` | In-memory log ring buffer size |
| `SYSTEM_SERVICES` | `''` | Extra service URLs to include in system health |
| `NODE_ENV` | `development` | Toggles morgan log format |

## Gateway (`nexus-gateway`)

Build-time `ARG`s:

| ARG | Default | Notes |
|---|---|---|
| `HOST_REMOTE_ENTRY` | `/host/remoteEntry.json` | Baked into `environment.prod.ts` |
| `NEXUS_TOKEN` | `dev-token-change-in-production` | Baked into the auth interceptor |

Runtime env (read by `docker-entrypoint.d/40-runtime-config.sh`):

| Variable | Default | Notes |
|---|---|---|
| `HOST_REMOTE_ENTRY` | (ARG value) | Override at container start |
| `HOST_EXPOSED_MODULE` | `./AppShell` | Override at container start |

## Host (`nexus-host-template`)

Build-time:

| ARG | Default | Notes |
|---|---|---|
| `NEXUS_TOKEN` | `dev-token-change-in-production` | Baked into the bundled interceptor |
| `NODE_AUTH_TOKEN` | — | BuildKit secret — not an ARG (do not pass as `--build-arg`) |

Runtime (`/assets/config.json`):

| Field | Default | Notes |
|---|---|---|
| `registryUrl` | `/api` | Base path for registry calls |
| `nexusToken` | — | Overrides the build-time token |
| `staticBackupUrl` | `/assets/registry-backup/remotes.json` | Cold-start fallback |

## Portal (`nexus-portal`)

Same as host (build-time `NEXUS_TOKEN` + `NODE_AUTH_TOKEN`; runtime `/assets/config.json` with `registryUrl` and `nexusToken`).

## CLI (`@bimo-dk/nexus-cli`)

| Variable | Default | Notes |
|---|---|---|
| `NEXUS_TOKEN` | — | Required for `publish`, `status`, `health` |
| `REGISTRY_URL` | `http://localhost:3000` | |
| `REMOTE_URL` | `/remotes/<name>/remoteEntry.json` | Used by `publish` |
| `REMOTE_ROUTE` | derived from name | Override the route |
| `NEXUS_STAGING_TOKEN`, etc. | — | Whatever you put in `nexus.config.json#environments.<env>.tokenEnv` |

`.env` in the cwd is auto-loaded.

## `nexus-build`

No env vars. Reads only `package.json` and `src/**/*.ts`.

## Common pitfalls

- **`NODE_AUTH_TOKEN` vs `GITHUB_TOKEN`.** Inside the Docker BuildKit secret block you read `NODE_AUTH_TOKEN`. The `.npmrc` template uses `${NODE_AUTH_TOKEN}`. They have to match. `GITHUB_TOKEN` is a separate thing used by GitHub Actions to talk back to GitHub — different scope, different file.
- **`ALLOWED_ORIGINS=*` works in dev, breaks in browsers with credentials.** Use an explicit allowlist for staging/prod.
- **`NEXUS_TOKEN` baked vs. runtime.** The host and gateway accept *both* a build-time `ARG NEXUS_TOKEN` (baked into the bundle) and a runtime override from `/assets/config.json`. The runtime override wins. If they disagree, you'll get sporadic 401s — pick one source of truth.
