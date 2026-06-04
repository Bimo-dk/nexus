---
id: gateway
title: Gateway
sidebar_position: 1
---

# Gateway

Repo: [`nexus-gateway`](https://github.com/Bimo-dk/nexus-gateway) — Image: `ghcr.io/bimo-dk/nexus-gateway`

The **gateway** is the only container the public reaches. It does three jobs:

1. Serves a minimal Angular SPA that loads the host shell via Native Federation.
2. Reverse-proxies `/api/*`, `/ws`, `/host/*` and `/remotes/<name>/*` to internal services.
3. Sets cache and security headers so a remote redeploy is visible immediately and nothing else is stale.

## What the SPA does

The Angular app under `src/app/` is intentionally tiny:

- `main.ts` waits for native-federation init, then dynamically loads the host's `AppShell` module via `loadRemoteModule(...)`.
- `host-loader.service.ts` retries up to `environment.retryAttempts` times with `environment.retryDelayMs` between attempts — for the case where the gateway is up but `host` is still starting.
- An offline screen is shown if every retry fails.

```ts
// nexus-gateway/src/app/services/host-loader.service.ts
const moduleRef = await loadRemoteModule({
  remoteEntry: environment.hostRemoteEntry,    // /host/remoteEntry.json
  exposedModule: environment.hostExposedModule, // ./AppShell
});
```

That is the only federation call the gateway ever makes. Everything else is handled by the host shell after this point.

## Runtime configuration

At container start, `docker-entrypoint.d/40-runtime-config.sh` runs before nginx. It substitutes environment variables into the prebuilt assets so the same image is reused across staging/prod with different config.

| Env var | Description | Default |
|---|---|---|
| `HOST_REMOTE_ENTRY` | URL to host's `remoteEntry.json` | `/host/remoteEntry.json` |
| `HOST_EXPOSED_MODULE` | Module key exposed by the host | `./AppShell` |
| `REGISTRY_INTERNAL_URL` | Internal URL the gateway uses to reach the registry at startup and for WebSocket. | `http://registry:3000` |

These are written into `environment.prod.ts` placeholders at build time, *and* into `/assets/config.json` at container start, so both the bundled SPA and any runtime overrides see the same value.

## Nginx configuration

`nginx.conf` is short and worth reading in full — it is the URL contract for the whole platform.

```nginx
# /api/*  → registry HTTP API
location ^~ /api/ {
  proxy_pass http://registry:3000;
}

# /ws — registry WebSocket (with Upgrade headers)
location ^~ /ws {
  proxy_pass http://registry:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "Upgrade";
  proxy_read_timeout 86400;
}

# /host/* — host layout shell (prefix stripped)
location ^~ /host/ {
  rewrite ^/host(/.*)$ $1 break;
  proxy_pass http://host:80;
}

# /remotes/<name>/* — generated dynamically from registry
# See docker-entrypoint.d/40-runtime-config.sh
include /etc/nginx/conf.d/remotes.conf;

# Federation entries — never cache
location ~* remoteEntry\.(json|js)$ {
  add_header Cache-Control "no-store, no-cache, must-revalidate" always;
  try_files $uri =404;
}
```

The full file is at [`nexus-gateway/nginx.conf`](https://github.com/Bimo-dk/nexus-gateway/blob/main/nginx.conf).

## How remote routes work

Gateway has no hardcoded remote names. At container start, `docker-entrypoint.d/40-runtime-config.sh` calls `GET /api/remotes` on the registry and generates `/etc/nginx/conf.d/remotes.conf` — one `location` block per enabled remote, using the remote's `upstreamUrl` as the nginx upstream. Nginx then includes this file.

After nginx starts, a lightweight Node process connects to the registry WebSocket (`/ws`). On every `remotes_changed` message it regenerates `remotes.conf` and calls `nginx -s reload`. The reload is graceful — existing connections are drained before worker processes are replaced.

You never touch nginx config to add a remote.

## Security headers

Set globally in `nginx.conf`:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## Healthcheck

```bash
GET http://localhost:8668/health
{"status":"ok","service":"app"}
```

This is the endpoint Docker uses for the `HEALTHCHECK` directive in the Dockerfile.

## Build pipeline

```
Dockerfile
├── builder stage
│   ├── npm install --legacy-peer-deps
│   ├── substitute HOST_REMOTE_ENTRY + NEXUS_TOKEN into env.prod.ts
│   └── npm run build:prod
└── runtime stage
    ├── nginx:alpine + wget + gettext
    ├── copy dist/app/browser → /usr/share/nginx/html
    ├── copy nginx.conf → /etc/nginx/conf.d/default.conf
    └── copy 40-runtime-config.sh → /docker-entrypoint.d/
```

The `gettext` package is included so `envsubst` can fill the runtime config template at startup.

## When to change the gateway

| Task | Where |
|---|---|
| Change the registry URL gateway connects to | `REGISTRY_INTERNAL_URL` env-var |
| Add a security header | `nginx.conf` |
| Change retry behaviour for failed host load | `src/app/services/host-loader.service.ts` |
| Change the public port | `docker-compose.yml` `ports:` entry |
| Add a runtime env-var | `docker-entrypoint.d/40-runtime-config.sh` + `environment.prod.ts` |
