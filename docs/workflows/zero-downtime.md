---
id: zero-downtime
title: Zero-downtime updates
sidebar_position: 3
description: How Nexus delivers zero-downtime deploys for Angular micro frontends. Registry WebSocket broadcast triggers host route refresh and nginx graceful reload — no dropped requests, no tab refresh, no version pinning.
keywords: [Angular micro frontend zero downtime, micro frontend live deploy, Angular federation hot update, WebSocket micro frontend deploy]
---

# Zero-downtime updates

The whole platform is designed so a deploy of a remote does not interrupt the user. This page explains why, and how to actually do it.

## What "zero downtime" means here

- **No user reload required.** The user keeps clicking; the next navigation to the updated remote uses the new bundle.
- **No host or registry restart.** Nothing in the request path restarts.
- **No flash-of-broken-UI.** In-flight requests on the old bundle complete; new requests use the new bundle.

## How a remote update propagates

```
T+0   git push → CI builds new image  →  docker push my-registry/checkout:1.2.3
T+10s docker compose pull checkout && docker compose up -d --no-deps checkout
T+15s old container drains, new container starts
T+20s new container's bootstrap calls POST /api/remotes (or PUT) with itself
T+20s registry persists, broadcasts "remotes_changed"
T+20s host receives broadcast — no action needed (URL is same; bundle is new)
T+x   next user navigation to /checkout loads remoteEntry.json (cache: no-store)
        → new chunks
```

There is no coordination between the remote and the host beyond the WebSocket broadcast. The host does not pre-load remote chunks; it loads them on demand.

## Why this is safe

Two cache rules in `nexus-gateway/nginx.conf`:

```nginx
location ~* remoteEntry\.(json|js)$ {
  add_header Cache-Control "no-store, no-cache, must-revalidate" always;
}

location ~* /(chunk|remote)-[^/]+\.js$ {
  add_header Cache-Control "no-store" always;
}
```

Federation entries and chunks are never cached. As soon as the new container is reachable on the same internal hostname, the next request for `/remotes/checkout/remoteEntry.json` returns the new manifest. Older bundles in flight finish; new ones use the new bundle.

Everything else (Angular's hashed JS, CSS, fonts) is `immutable, max-age=31536000` — long-cached because filenames change with every build.

## The actual command

```bash
# Update only checkout — leave everything else alone
docker compose up -d --build --no-deps checkout
```

`--no-deps` is the critical flag. Without it, compose may also restart any service `checkout` depends on (registry, host, gateway), which would defeat the point.

For pre-built images (the common production case):

```bash
docker compose pull checkout
docker compose up -d --no-deps checkout
```

## What about the host?

A host update is **also** zero-downtime as long as users only see the gateway. Update the host container; the gateway's reverse proxy serves the new bundle. The browser doesn't refresh, but the next navigation that does a full host bundle load uses the new bundle.

However — and this is the only caveat — a user who already has the host loaded in their tab continues to run the *old* host shell until they navigate to a new page or refresh. Sessions are inherently sticky to the host that bootstrapped the tab. If you make a breaking change to the host shell (e.g. remove a publicly-callable API), expect a 5-30 minute warm-rollout window where some tabs are still on the old shell.

For non-breaking host updates: just `docker compose up -d --no-deps host`.

## What about the registry?

The registry's data is on a Docker volume:

```yaml
registry:
  volumes:
    - registry-data:/app/data
```

So a container restart preserves `registry.json`. The on-disk write pattern is `tmp + rename` (atomic), so even an OS crash mid-write does not corrupt the file.

```bash
docker compose up -d --no-deps registry
```

Active WebSocket clients are dropped, but the `RegistryWebSocketService` in every host reconnects with exponential backoff (1s → 2s → 4s → ... → 30s max).

The host's fallback chain (live → cache → static backup) ensures a downed registry does not break the user's session — they continue to see the cached remote list until the registry is back.

## What about the gateway?

The gateway is the public ingress. If you restart it, the user **does** see a couple seconds of "Connection refused" — there is nothing else to fall through to. So:

- For nginx-only changes (`nginx.conf`): `docker compose up -d --no-deps gateway` is a couple seconds of outage.
- For breaking config changes: blue/green deploy with another container on `:8670`, swap the LB.
- For a TLS terminator in front (production): treat that LB as your zero-downtime layer.

In other words: the gateway is the only choke point. Plan accordingly.

## Update a remote — full checklist

- [ ] CI passes on the remote's repo.
- [ ] Image is pushed and reachable from the docker host.
- [ ] No breaking change to `exposedModule` interface (e.g. a removed public component).
- [ ] No breaking change to `federation.config.json` `name` or `exposes` (would break the host's URL contract).
- [ ] Run: `docker compose pull <remote> && docker compose up -d --no-deps <remote>`.
- [ ] Verify in the portal: the remote's health pill is green within 30s.
- [ ] Hit a route in the remote in your browser — it should load fresh chunks (DevTools Network → confirm 200 from `/remotes/<name>/remoteEntry.json` without `from disk cache`).

## What blocks zero-downtime

Things that force a coordinated multi-container restart:

- Change to the gateway's URL contract (a new `/remotes/<name>` path block) — rebuild gateway image.
- Change to the shared port-mapping (`8668`, `8669`).
- Major Node bump that requires every service to rebuild against the new base image.

For those, plan a maintenance window or a blue/green deploy.
