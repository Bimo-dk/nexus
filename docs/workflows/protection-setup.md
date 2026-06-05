---
id: protection-setup
title: DDoS protection setup
sidebar_position: 9
description: Configure the Nexus gateway's seven DDoS protection layers. Sensible defaults, tuning targets, and the test recipe.
keywords:
  - DDoS protection setup
  - rate limiting
  - micro frontend security
  - Slowloris
---

# DDoS protection setup

The Nexus gateway ships with seven protection layers enabled by default. This page is the checklist for first-time setup and tuning. For the operator's incident playbook see [infra-protection](../infrastructure/infra-protection.md).

## Defaults

Out of the box, the gateway protects with:

| Setting | Default |
|---|---|
| `rateLimitEnabled` | true |
| `rateLimitRequestsPerSecond` | 100 |
| `rateLimitBurst` | 200 |
| `rateLimitBy` | ip |
| `maxConnectionsPerIp` | 50 |
| `maxWebsocketConnectionsPerIp` | 5 |
| `requestTimeoutMs` | 30 000 |
| `headerReadTimeoutMs` | 5 000 |
| `bodyReadTimeoutMs` | 10 000 |
| `idleTimeoutMs` | 60 000 |
| `slowlorisTimeoutMs` | 10 000 |
| `maxBodyBytes` | 1 048 576 (1 MiB) |
| `maxHeaderBytes` | 8 192 |
| `banDurationSeconds` | 300 |
| `banThresholdViolations` | 10 |

These are reasonable for a low-traffic dev environment. Tighten before going public.

## Recommended starting point for production

| Setting | Production value | Why |
|---|---|---|
| `rateLimitRequestsPerSecond` | 60 | Most real users send under 10 rps. |
| `rateLimitBurst` | 120 | Allow for page loads with many parallel requests. |
| `maxConnectionsPerIp` | 30 | Pages typically hold 6–10 sockets via H2. |
| `maxWebsocketConnectionsPerIp` | 3 | One per tab is plenty. |
| `requestTimeoutMs` | 20 000 | Below most CDN/LB timeouts. |
| `headerReadTimeoutMs` | 3 000 | Headers should arrive in one packet. |
| `slowlorisTimeoutMs` | 5 000 | Be aggressive with slow attackers. |
| `banDurationSeconds` | 900 | 15 min — long enough to discourage, short enough to recover. |
| `banThresholdViolations` | 5 | Auto-ban after five flagged requests. |

## Apply via portal

1. Open the portal at `http://localhost:8669/protection`.
2. Edit each setting inline. Validation happens server-side; out-of-range values are rejected.
3. Changes apply within milliseconds — no restart.

## Apply via API

```bash
curl -X PUT http://localhost:8668/api/config/gateway/protection \
  -H "X-Nexus-Token: $NEXUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rateLimitEnabled": true,
    "rateLimitRequestsPerSecond": 60,
    "rateLimitBurst": 120,
    "maxConnectionsPerIp": 30,
    "maxWebsocketConnectionsPerIp": 3,
    "requestTimeoutMs": 20000,
    "headerReadTimeoutMs": 3000,
    "slowlorisTimeoutMs": 5000,
    "banDurationSeconds": 900,
    "banThresholdViolations": 5
  }'
```

## Verify the rules are active

```bash
curl -H "X-Nexus-Token: $NEXUS_TOKEN" \
  http://localhost:8668/api/protection/status
```

Returns the active config plus the current ban list and top offenders.

## Test rate limiting

```bash
# Send 200 requests as fast as possible — should see 429s after the burst is exhausted.
seq 200 | xargs -P 50 -n 1 -I{} curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8668/ | sort | uniq -c
# Output:
#   120 200    # burst exhausted at 120
#    80 429    # rate-limited
```

If the ratio is wrong, your reverse proxy in front of the gateway might be smoothing the requests — point your test at the gateway directly.

## Test auto-ban

```bash
# Run the rate-limit test five times in succession from one IP.
# After ~50 violations within the window, the IP should auto-ban.
for i in {1..5}; do
  seq 200 | xargs -P 50 -n 1 -I{} curl -s -o /dev/null http://localhost:8668/
  sleep 1
done

# Confirm:
curl -H "X-Nexus-Token: $NEXUS_TOKEN" \
  http://localhost:8668/api/protection/status | jq '.active_bans'
```

You should see your IP in `active_bans` with a `remaining_seconds` countdown.

## Whitelisting

The gateway has no built-in IP whitelist (every IP is rate-limited). Two options:

1. Run an internal monitoring path under a different gate that you don't expose publicly.
2. Use the front LB to send health-check traffic from known IPs that bypass the gateway.

A native whitelist is on the roadmap.

## Dashboards

Hook the gateway's `/metrics` endpoint to Prometheus and chart:

- `rate(nexus_gateway_requests_blocked_total[5m])` — block rate per layer.
- `nexus_gateway_banned_ips` — current ban list size.
- `nexus_gateway_active_connections{kind="ws"}` — WS load.

Full metric reference: [infra-prometheus-metrics](../infrastructure/infra-prometheus-metrics.md).

## Next

- [Infra: protection](../infrastructure/infra-protection.md) — incident playbook.
- [Infra: gateway](../infrastructure/infra-gateway.md) — what's inside each layer.
- [Reference: security](../reference/security.md) — token rotation and CORS.
