---
id: security
title: Security
sidebar_position: 5
description: The Nexus security model. Token model, rotation, CORS, BuildKit secrets for GitHub Packages, gateway protection, and what's out of scope today.
keywords:
  - Nexus security
  - micro frontend security
  - token rotation
  - BuildKit secrets
  - CORS
---

# Security

This page is the platform-level security reference. For protection layer operations, see [infra-protection](../infrastructure/infra-protection.md).

## Auth boundaries

Nexus has two distinct auth surfaces:

- **Machine-to-machine** — every direct call to the registry, gateway, host, or remote APIs uses the shared secret `NEXUS_TOKEN` in the `X-Nexus-Token` header. This is how the gateway authenticates to the registry, how `bnx` talks to the registry, and how the portal BFF forwards to the registry. Treat the token like a database password.
- **Human-to-portal** — the admin portal is gated by username/password login, session cookies, and role-based access (admin / developer). The `NEXUS_TOKEN` for the registry is held inside the portal BFF's environment and is never sent to the browser.

The rest of this section covers the machine token. For the portal's auth model, see [Infra: portal — Authentication](../infrastructure/infra-portal.md#authentication).

## Token model

The machine token model is **single shared secret**: `NEXUS_TOKEN` is required for every `/api/*` call to the registry, gateway, and host. Anyone with the token can mutate every host, gate, remote, and configuration setting. Treat it like a database password.

### Rotation

Rotate with a grace period so existing clients don't fail mid-call:

```bash
curl -X POST http://localhost:8668/api/config/token/rotate \
  -H "X-Nexus-Token: $NEXUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "newToken": "<new-long-random>", "gracePeriodSeconds": 600 }'
```

For 10 minutes, both tokens authenticate. After that the old token is rejected.

If a token leaks and you need to revoke immediately:

```bash
# Rotate to a new token with grace period 0, then revoke the previous
curl -X POST .../api/config/token/rotate -d '{"newToken":"...","gracePeriodSeconds":0}'
curl -X DELETE .../api/config/token/previous
```

### Hashing

Tokens are stored as HMAC-SHA256 hashes with a `NEXUS_TOKEN_PEPPER`. Set the pepper in production; without it the registry uses a default and warns on every start.

### What's on the roadmap

Per-identity machine tokens with role-based scopes (`read:remotes`, `write:hosts`, …) for direct API calls. Not shipped today — the machine token remains a single shared secret.

Per-identity RBAC for the **portal** (admin vs developer, password-backed login) **is** shipped. See [Infra: portal — Authentication](../infrastructure/infra-portal.md#authentication).

## CORS

The registry's `ALLOWED_ORIGINS` env var is the allowlist. Comma-separated, or `*` to allow any origin.

```ini
ALLOWED_ORIGINS=https://shop.example.com,https://admin.example.com
```

Wildcards (`*.example.com`) are not supported — list each origin explicitly. The OPTIONS preflight is handled automatically.

For the gateway, set `corsOrigins` in the gateway config (via portal or API). Same semantics.

## npm packages

`@bimo-dk/nexus-*` packages are public on [npmjs.com](https://www.npmjs.com/org/bimo-dk). No token or `.npmrc` configuration is required to install them:

```bash
npm install @bimo-dk/nexus-runtime
```

## Gateway protection

Seven layers, all configurable:

- IP bans (manual + automatic)
- Per-IP HTTP connection caps
- Token bucket rate limiting
- Payload size limits
- Header size limits
- Read timeouts (including Slowloris)
- Per-IP WebSocket connection caps

Configure via portal → Protection page or `/api/config/gateway/protection`. Operations playbook: [infra-protection](../infrastructure/infra-protection.md).

## TLS

The gateway speaks HTTP/1.1 and HTTP/2 in plaintext internally. Terminate TLS at your load balancer or CDN. The gateway listens on `:8668` and expects to be fronted.

If you must terminate TLS at the gateway, run it behind a small TLS terminator (e.g., Caddy, Traefik, AWS NLB-with-TLS). Native TLS in axum is supported but not the recommended deployment shape.

## CSP, HSTS, frame headers

Set these via the gateway's `customHeaders`:

```bash
curl -X PUT .../api/config/gateway \
  -d '{
    "customHeaders": [
      { "name": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
      { "name": "X-Content-Type-Options",     "value": "nosniff" },
      { "name": "X-Frame-Options",            "value": "DENY" },
      { "name": "Content-Security-Policy",    "value": "default-src https://shop.example.com; ..." }
    ]
  }'
```

Per-gate overrides are supported — see [workflows: multi-domain-setup](../workflows/multi-domain-setup.md).

## Secrets in env files

Don't check `.env` into git. The repo's `.gitignore` already excludes it. For CI, use the platform's secret store (GitHub Actions secrets, GitLab CI variables, k8s `Secret`s).

## Data at rest

The registry's SQLite file contains:

- Host, gate, remote configuration.
- Hashed token (not the raw secret).
- The pepper if you wrote it to disk somewhere (don't).

Encrypt the volume at rest if your threat model requires it. PostgreSQL deployments should use transparent data encryption per your provider.

## Reading the code

- Token middleware: `nexus-registry/src/features/token.rs`.
- Token hashing: same file.
- CORS layer: `nexus-registry/src/main.rs` (`build_cors`).
- Gateway protection: `nexus-gateway/src/protection.rs`.
- BuildKit pattern: every `Dockerfile` in the workspace.

## Next

- [Workflows: protection-setup](../workflows/protection-setup.md)
- [Reference: configuration](configuration.md) — token rotation, metrics auth, etc.
- [Infra: protection](../infrastructure/infra-protection.md) — playbook.
