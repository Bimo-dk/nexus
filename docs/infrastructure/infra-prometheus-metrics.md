---
id: infra-prometheus-metrics
title: Prometheus metrics
sidebar_position: 7
description: Every Prometheus metric Nexus exposes. Gateway counters and gauges, registry exporter, recommended dashboards and alert thresholds.
keywords:
  - micro frontend metrics
  - Prometheus
  - micro frontend gateway
  - observability
  - SRE
---

# Prometheus metrics

Both the registry and the gateway ship a Prometheus exporter. They use the same metric naming convention (`nexus_<service>_<name>`) so you can graph them side by side.

## Gateway

`GET http://<gateway>:8668/metrics` — Prometheus text format. Public by default. Authenticate with a reverse-proxy if you don't want it open.

### Counters

| Metric | Labels | Increment |
|---|---|---|
| `nexus_gateway_requests_total` | `method`, `status`, `upstream` | every completed request |
| `nexus_gateway_requests_blocked_total` | `reason`, `ip_class` | every protection-layer rejection |
| `nexus_gateway_violations_total` | `reason` | every recorded violation (precursor to a ban) |
| `nexus_gateway_route_swaps_total` | `trigger` | every registry-driven route table swap |
| `nexus_gateway_websocket_messages_total` | `direction=in|out` | every WebSocket frame proxied |

### Gauges

| Metric | Labels | Reads |
|---|---|---|
| `nexus_gateway_active_connections` | `kind=http|ws` | live connection count |
| `nexus_gateway_banned_ips` | — | current ban list size |
| `nexus_gateway_registry_connected` | — | `1` if WS to registry is up, else `0` |

### Histograms

| Metric | Labels | Buckets |
|---|---|---|
| `nexus_gateway_upstream_latency_seconds` | `upstream` | 5 ms — 30 s |
| `nexus_gateway_request_duration_seconds` | `route_class` | 5 ms — 30 s |

## Registry

`GET http://<registry>:8670/metrics` (or whatever you set in `MetricsConfig.prometheusPath`).

### Counters

| Metric | Labels | Increment |
|---|---|---|
| `nexus_registry_requests_total` | `method`, `status`, `path_class` | every completed request |
| `nexus_registry_remotes_changed_total` | `trigger` | every `remotes_changed` broadcast |
| `nexus_registry_hosts_changed_total` | `trigger` | every `host_changed` broadcast |
| `nexus_registry_gates_changed_total` | `trigger` | every `gate_changed` broadcast |
| `nexus_registry_health_checks_total` | `status` | every remote health check |
| `nexus_registry_circuit_state_transitions_total` | `to_state` | breaker transitions |
| `nexus_registry_token_rotations_total` | — | every `token_rotated` event |

### Gauges

| Metric | Reads |
|---|---|
| `nexus_registry_ws_clients` | active WebSocket clients |
| `nexus_registry_db_pool_size` | sqlx pool size |
| `nexus_registry_db_pool_idle` | sqlx idle connections |
| `nexus_registry_log_buffer_size` | ring-buffer entries |

### Histograms

| Metric | Labels | Buckets |
|---|---|---|
| `nexus_registry_request_duration_seconds` | `path_class` | 1 ms — 5 s |
| `nexus_registry_health_check_duration_seconds` | `remote` | 5 ms — 10 s |

## Recommended dashboards

### Traffic overview

- `sum by (status) (rate(nexus_gateway_requests_total[5m]))` — request rate split by status code.
- `histogram_quantile(0.99, sum by (le, upstream) (rate(nexus_gateway_upstream_latency_seconds_bucket[5m])))` — upstream p99 latency.
- `sum by (kind) (nexus_gateway_active_connections)` — live connection counts.

### Protection

- `sum by (reason) (rate(nexus_gateway_requests_blocked_total[5m]))` — block rate by layer.
- `nexus_gateway_banned_ips` — ban list size.
- `sum by (ip_class) (rate(nexus_gateway_violations_total[5m]))` — violation rate by IP class.

### Registry health

- `nexus_registry_ws_clients` — live client count (gateway + every host browser tab).
- `nexus_registry_db_pool_size - nexus_registry_db_pool_idle` — DB pool saturation.
- `sum by (to_state) (rate(nexus_registry_circuit_state_transitions_total[15m]))` — breaker churn.

## Alerts

### High block rate

```promql
sum(rate(nexus_gateway_requests_blocked_total[5m])) > 50
```

If sustained, an attacker is probing. Check the Protection page for top offenders.

### Registry WebSocket down on gateway

```promql
nexus_gateway_registry_connected == 0
```

For more than 60 seconds: paging condition. The gateway is operating on cached routes and cannot accept registry-driven changes.

### Circuit breaker churn

```promql
sum by (to_state) (rate(nexus_registry_circuit_state_transitions_total[15m])) > 5
```

A specific remote is flapping. Find it via the registry's `/api/system/health` snapshot.

### DB pool saturation

```promql
nexus_registry_db_pool_size - nexus_registry_db_pool_idle > 0.8 * nexus_registry_db_pool_size
```

DB calls are queueing. If you're on SQLite, this is a sign to move to PostgreSQL (see [infra-high-availability](infra-high-availability.md)).

## Reading the code

- Gateway exporter: `nexus-gateway/src/metrics.rs`.
- Registry exporter: `nexus-registry/src/observability/metrics.rs`.
- Registry config: `nexus-registry/src/config/types.rs` (`MetricsConfig`).

## Next

- [Infra: protection](infra-protection.md) — what the protection counters represent.
- [Reference: configuration](../reference/configuration.md) — how to enable/disable the exporter.
- [Reference: api-reference](../reference/api-reference.md) — the `/api/config/metrics` endpoint.
