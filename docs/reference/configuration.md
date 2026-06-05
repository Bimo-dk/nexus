---
id: configuration
title: Configuration
sidebar_position: 2
description: Every runtime-configurable feature of the Nexus registry and gateway. Schemas, validation ranges, and where to edit each.
keywords:
  - Nexus configuration
  - feature flags
  - rate limit config
  - circuit breaker
  - graceful shutdown
---

# Configuration

Six platform features on the registry are hot-reloadable via `/api/config/*`. The gateway's seven protection layers are configured through `/api/config/gateway/protection`. Every change is validated server-side and applied within milliseconds.

## Where to edit

- **Portal** — recommended. Each feature has an inline editor with validation.
- **API** — for automation / drift detection / disaster recovery.
- **Env vars** — only what each service needs *to boot*. Feature config is not env-driven.

## Registry features

### Rate limiting (registry's own ingress)

```ts
type RateLimitingConfig = {
  enabled: boolean;
  requestsPerSecond: number;   // 1 – 1000
  burstSize: number;           // 1 – 500, must be >= requestsPerSecond
  by: 'ip' | 'token';
};
```

Default: `{ enabled: true, requestsPerSecond: 100, burstSize: 200, by: 'ip' }`.

GET/PUT `/api/config/rate-limiting`.

### WebSocket reconnect policy

Broadcast in the `welcome` frame to every client; clients are expected to obey.

```ts
type WsReconnectConfig = {
  initialDelayMs: number;     // 100 – 10 000
  maxDelayMs: number;         // 1 000 – 300 000, must be >= initialDelayMs
  backoffMultiplier: number;  // 1.0 – 10.0
  jitterMs: number;           // 0 – 5 000
  maxAttempts: number;        // 0 – 1 000 (0 = infinite)
};
```

Default: `{ initialDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2.0, jitterMs: 250, maxAttempts: 0 }`.

GET/PUT `/api/config/ws-reconnect`.

### Circuit breaker (health checks)

Wraps the per-remote health check loop. Opens when failures exceed threshold; lets a few probes through in half-open state.

```ts
type CircuitBreakerConfig = {
  enabled: boolean;
  failureThreshold: number;   // 1 – 20
  successThreshold: number;   // 1 – 10
  openDurationMs: number;     // 1 000 – 3 600 000
  halfOpenMaxCalls: number;   // 1 – 5
};
```

Default: `{ enabled: true, failureThreshold: 5, successThreshold: 2, openDurationMs: 60000, halfOpenMaxCalls: 3 }`.

GET/PUT `/api/config/circuit-breaker`. Inspect with `GET /api/config/circuit-breaker/state`. Reset with `POST /api/config/circuit-breaker/reset` or `POST /api/config/circuit-breaker/reset/{remote}`.

### Graceful shutdown

Drain timings used when the registry receives SIGTERM.

```ts
type GracefulShutdownConfig = {
  timeoutMs: number;     // 1 000 – 60 000
  wsNoticeMs: number;    // 500 – 10 000, must be < timeoutMs
};
```

Default: `{ timeoutMs: 10000, wsNoticeMs: 2000 }`.

Sequence on shutdown:

1. Broadcast `registry_shutting_down { resume_in_ms: timeoutMs - wsNoticeMs }`.
2. Wait `wsNoticeMs` for clients to flush.
3. Drain HTTP for `(timeoutMs - wsNoticeMs)`.
4. Close DB pool.
5. Exit.

GET/PUT `/api/config/graceful-shutdown`.

### Metrics (Prometheus exporter)

```ts
type MetricsConfig = {
  prometheusEnabled: boolean;
  prometheusPath: string;          // must start with /, max 64 chars
  requireAuth: boolean;
  customLabels: Record<string, string>;  // max 10 entries, alphanumeric+underscore keys
};
```

Default: `{ prometheusEnabled: true, prometheusPath: '/metrics', requireAuth: false, customLabels: {} }`.

GET/PUT `/api/config/metrics`.

### Token

```ts
type TokenInfo = {
  hasActive: boolean;
  hasPrevious: boolean;
  previousExpiresAt?: string;
};

type TokenRotateRequest = {
  newToken: string;
  gracePeriodSeconds?: number;     // default 0
};
```

GET `/api/config/token` returns metadata only (never the secret).

POST `/api/config/token/rotate`:

```json
{ "newToken": "<long-random>", "gracePeriodSeconds": 300 }
```

The old token continues to authenticate for `gracePeriodSeconds`. Both the new and old hash live in the database during the grace period.

DELETE `/api/config/token/previous` revokes the grace-period token immediately.

## Gateway protection

`/api/config/gateway/protection` — fifteen settings, all hot-applied.

```ts
type GatewayProtectionConfig = {
  rateLimitEnabled: boolean;
  rateLimitRequestsPerSecond: number;
  rateLimitBurst: number;
  rateLimitBy: 'ip' | 'token';
  maxConnectionsPerIp: number;
  maxWebsocketConnectionsPerIp: number;
  requestTimeoutMs: number;
  headerReadTimeoutMs: number;
  bodyReadTimeoutMs: number;
  idleTimeoutMs: number;
  maxBodyBytes: number;
  maxHeaderBytes: number;
  slowlorisTimeoutMs: number;
  banDurationSeconds: number;
  banThresholdViolations: number;
};
```

Defaults, ranges, and tuning advice in [infra-protection](../infrastructure/infra-protection.md) and [workflows: protection-setup](../workflows/protection-setup.md).

## Gateway full config

`GET /api/config/gateway` returns:

```ts
type GatewayConfig = {
  corsOrigins: string[];
  customHeaders: { name: string; value: string }[];
  healthCheckPath: string | null;
  publicUrl: string | null;
  protection: GatewayProtectionConfig;
};
```

The gateway loads this at startup and again whenever `config_changed` arrives over WebSocket.

## Reading the code

- Types: `nexus-registry/src/config/types.rs`.
- Defaults: `nexus-registry/src/config/defaults.rs`.
- Storage: `nexus-registry/src/config/store.rs`.
- Routes: `nexus-registry/src/config/routes.rs`.
- Gateway mirror: `nexus-gateway/src/state.rs` (`ProtectionConfig`, `GatewayConfig`).

## Next

- [Reference: api-reference](api-reference.md) — every endpoint in detail.
- [Infra: registry](../infrastructure/infra-registry.md) — the features in context.
- [Workflows: protection-setup](../workflows/protection-setup.md) — tuning playbook.
