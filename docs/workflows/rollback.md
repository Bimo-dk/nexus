---
id: rollback
title: Roll back a config change
sidebar_position: 6
description: How to undo a registry-level change — remote configuration, gate routing, or host wiring — with one API call. The layer below Kubernetes container rollback, and why both exist.
keywords:
  - micro frontend rollback
  - registry rollback
  - micro frontend platform
  - zero downtime deployment
  - undo deploy
---

:::info Shipping in 1.0
The versions table and `/rollback` endpoint land in the 1.0 release. The contract documented here is what the API exposes today on `main`; if you are reading from an earlier build the endpoints may not yet exist. Check the registry's `OpenAPI` at `/api/openapi.json` to confirm.
:::

# Roll back a config change

The registry keeps a version history of every remote's configuration. If a routing change, a visibility flip, or a URL edit breaks something, you revert with one call. The change is hot — new behaviour is live across every gateway instance within milliseconds, in-flight requests are unaffected.

## What rollback covers, and what it does not

This is a registry-level rollback. It moves the **configuration state** that lives in the registry's database back to a prior snapshot — `url`, `exposedModule`, `routePath`, `visibility`, `enabled`, etc.

It does **not** roll back container images. That is Kubernetes' job (`kubectl rollout undo`). The two layers stack:

| Layer | What rolls back | Tool |
|---|---|---|
| **Container** (cluster) | Container image / pod spec — `checkout:v2` → `checkout:v1` | `kubectl rollout undo`, your CD tool |
| **Routing / config** (Nexus registry) | URL, exposed module, route path, visibility, enabled flag | `POST /api/remotes/<name>/rollback { "version": N }` |

A bad container is a Kubernetes rollback. A bad portal edit ("I just hid the checkout remote from the storefront host by mistake") is a Nexus rollback. They solve different problems; you reach for whichever matches the cause.

## How it works

Every change to a remote — whether through the portal or directly through `PUT /api/remotes/<name>` — captures a new version row. Versions are numbered monotonically per remote and recorded with timestamp, actor (correlation id), and the full configuration snapshot.

```
v1  2026-06-05 14:02  url=/remotes/checkout/remoteEntry.json  visibility=global   enabled=true
v2  2026-06-05 14:08  url=/remotes/checkout/remoteEntry.json  visibility=host:abc enabled=true   ← mistake
v3  2026-06-05 14:09  (rollback to v1)                                                            ← undo
```

Rolling back creates a **new** version row that is a copy of the target — the history is append-only. There is no "delete v2"; v2 stays in the audit trail.

## Doing a rollback

### List versions

```bash
curl -H "X-Nexus-Token: $NEXUS_TOKEN" \
  "$REGISTRY_URL/api/remotes/checkout/versions"
```

Response:

```json
{
  "remote": "checkout",
  "versions": [
    { "version": 1, "timestamp": "2026-06-05T14:02:00Z", "actor": "...", "config": { "url": "/remotes/checkout/remoteEntry.json", "visibility": "global", "enabled": true } },
    { "version": 2, "timestamp": "2026-06-05T14:08:00Z", "actor": "...", "config": { "url": "/remotes/checkout/remoteEntry.json", "visibility": "host:abc", "enabled": true } }
  ]
}
```

### Roll back

```bash
curl -X POST \
  -H "X-Nexus-Token: $NEXUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "version": 1 }' \
  "$REGISTRY_URL/api/remotes/checkout/rollback"
```

Response:

```json
{
  "remote": "checkout",
  "restoredVersion": 1,
  "newVersion": 3,
  "config": { "url": "/remotes/checkout/remoteEntry.json", "visibility": "global", "enabled": true }
}
```

The registry persists the restored config as a new version, broadcasts `remotes_changed` (with `trigger: "rollback:checkout"`), and every gateway swaps its route table within milliseconds.

### From the portal

Remote detail page → Versions tab → click the version row you want → confirm. The portal calls the same endpoint.

## When to reach for which layer

| Situation | Reach for |
|---|---|
| New container image is crashing | Kubernetes rollback |
| New container is healthy but behaving wrong | Look at the registry config — did something get edited at the same time? |
| Portal edit changed visibility / URL / route incorrectly | Registry rollback |
| Routing change affected the wrong gate | Registry rollback on the remote, or [gate-host-swap](gate-host-swap.md) on the gate |
| Cluster-wide outage | Both — but the registry recovers via its database, not via rollback |

## Rollback is not a substitute for backups

Versions are kept in the same database as the live configuration. If you lose the database, you lose both. For disaster recovery, snapshot the database itself — see [infra-high-availability — disaster recovery](../infrastructure/infra-high-availability.md#disaster-recovery).

## What it does not roll back today

- **Gates** and **hosts** are not yet versioned — they are simpler entities and a manual re-edit is fast. On the roadmap if there is demand.
- **Hot-reloadable platform config** (rate limits, breaker policy, etc.) is not versioned. Re-PUT the previous values.
- **Container images** — by design. That is Kubernetes.

## Versions table growth

The registry caps the version history per remote at a configurable retention window — defaults are kept reasonable for operators who don't tune them. Set `REMOTE_VERSION_RETENTION_DAYS` or `REMOTE_VERSION_RETENTION_COUNT` to override; the older of the two limits wins.

## Next

- [Gate host-swap](gate-host-swap.md) — the gate-level cousin of rollback.
- [Zero-downtime deployment](zero-downtime.md) — why a rolled-back config goes live without a single dropped request.
- [Infra: high availability](../infrastructure/infra-high-availability.md) — how rollback interacts with multi-replica registry deployments.
