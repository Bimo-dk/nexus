---
id: security
title: Security
sidebar_position: 2
---

# Security

The Bimo-Nexus security model is small on purpose. Three concerns:

1. Who can read/write the registry (`X-Nexus-Token`).
2. Where browser code can be embedded (security headers).
3. How `@bimo-dk/*` packages are pulled into builds (GitHub Packages auth).

## `X-Nexus-Token`

Every registry endpoint requires the header `X-Nexus-Token: <NEXUS_TOKEN>`. The only exception is `GET /health` — a liveness probe.

```http
GET /api/remotes HTTP/1.1
Host: nexus.example.com
X-Nexus-Token: 7c8e...e2a
```

Missing or wrong → `401 { error: "unauthorized" }`.

### Where the token lives

| Component | How it gets the token |
|---|---|
| Registry | `NEXUS_TOKEN` env-var |
| Host (Angular) | Built into the bundled `nexusAuthInterceptor`, overridable via `/assets/config.json#nexusToken` |
| Portal (Angular) | Same as host |
| Gateway | Read by Angular bundle for proxied calls; nginx itself does **not** check the token |
| `bnx` CLI | `NEXUS_TOKEN` env-var |
| `RegistryClient` (any Node tool) | Constructor option `token` |

The Angular bundle's interceptor only adds the header for requests matching the registry origin — calls to unrelated origins are not tagged.

### Rotation

The token is shared state. To rotate:

1. Pick the new token.
2. Update `.env` (NEXUS_TOKEN) on the host running the orchestrator.
3. `docker compose up -d --build` — every service that bakes the token rebuilds; runtime overrides via `/assets/config.json` are also re-substituted.
4. Update any external tooling (`bnx`'s `NEXUS_TOKEN`, CI secrets).

For zero-downtime rotation, the registry accepts a `NEXUS_TOKEN_NEXT` (planned, not yet implemented) — both are accepted during a transition window.

### What the token does *not* protect

- It is symmetric. Anyone with the token can do anything to the registry.
- It is not bound to an identity — no audit trail beyond log lines.
- It is not encrypted in transit unless you put TLS in front of the gateway. **Always run TLS in production.**

For finer-grained access control, put the gateway behind an SSO proxy that maps the user identity to the right token (or to a "viewer" token vs. a "writer" token in a future version).

## Security headers

Every nginx container sets:

```nginx
add_header X-Frame-Options          "SAMEORIGIN"                       always;
add_header X-Content-Type-Options   "nosniff"                          always;
add_header X-XSS-Protection         "1; mode=block"                    always;
add_header Referrer-Policy          "strict-origin-when-cross-origin"  always;
```

`X-Frame-Options: SAMEORIGIN` blocks the app from being iframed cross-origin. If you have a legitimate use case for embedding, replace with a `Content-Security-Policy: frame-ancestors` clause.

## CORS

The registry allows only origins in `ALLOWED_ORIGINS` (comma-separated). In dev, the orchestrator's `.env.example` lists `http://localhost:866{6,7,8,9}` and `:8671`.

For production, set it to your public host(s):

```ini
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Wildcard (`*`) is allowed but disables credentialed requests in browsers — fine for read-only public APIs, not for the registry.

## GitHub Packages auth

`@bimo-dk/*` packages are not on the public npm registry. They live on GitHub Packages at `https://npm.pkg.github.com`. Every consuming repo needs:

### `.npmrc`

```ini
@bimo-dk:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Commit this file. It does not contain a secret — only the variable name.

### `NODE_AUTH_TOKEN` env var

On your dev machine: a PAT (classic or fine-grained) with `read:packages` scope.

In CI: a repository secret named `NODE_AUTH_TOKEN`.

In Docker builds: a **BuildKit secret**, never a `--build-arg`:

```dockerfile
# syntax=docker/dockerfile:1.7
RUN --mount=type=secret,id=node_auth_token,required=true \
    NODE_AUTH_TOKEN=$(cat /run/secrets/node_auth_token) \
    npm install --legacy-peer-deps
```

And on the build command:

```bash
DOCKER_BUILDKIT=1 docker build \
  --secret id=node_auth_token,env=NODE_AUTH_TOKEN \
  -t myorg/checkout:latest .
```

:::danger Never use `ARG NODE_AUTH_TOKEN`
ARG values are persisted in image layer metadata. Anyone with image pull rights can read them with `docker history`. BuildKit secrets are not persisted — they exist only inside the `RUN` step.
:::

## Threat model summary

| Threat | Mitigation |
|---|---|
| Anonymous reader hits `/api/remotes` | 401 — token required |
| MITM on registry traffic | Run TLS at the LB / gateway |
| Attacker iframes the portal to phish admin actions | `X-Frame-Options: SAMEORIGIN` |
| Cross-origin XHR to registry from a malicious site | CORS allowlist |
| GitHub PAT leaks via image layer | BuildKit secret, never ARG |
| Token reuse | Rotate via `NEXUS_TOKEN` env + rebuild |
| Malicious remote registered via stolen token | The token is the trust boundary — protect it; audit log lines correlate by `X-Request-ID` |

## What's not in scope (yet)

- Per-user identity / multi-tenant tokens
- Signed remote manifests (every host trusts every registered remote URL)
- Rate limiting on the registry API

These are planned. Until they ship, treat `NEXUS_TOKEN` like a database password — anyone with it has full write.
