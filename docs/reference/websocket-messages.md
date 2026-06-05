---
id: websocket-messages
title: WebSocket messages
sidebar_position: 4
description: Every server-pushed and client-sent message on the Nexus WebSocket. Payload shapes and when each fires.
keywords:
  - Nexus WebSocket
  - micro frontend WebSocket
  - registry broadcast
  - message reference
---

# WebSocket messages

The registry serves `GET /api/ws`. The gateway proxies it as `GET /ws` to browser clients. Every message is JSON with a `type` discriminator.

## Server → client

### welcome

Sent immediately on connect.

```json
{
  "type": "welcome",
  "timestamp": "2026-01-01T00:00:00Z",
  "clients": 4,
  "reconnect_policy": {
    "initial_delay_ms": 1000,
    "max_delay_ms": 30000,
    "backoff_multiplier": 2.0,
    "jitter_ms": 250,
    "max_attempts": 0
  }
}
```

Clients are expected to honor `reconnect_policy` for their own backoff.

### remotes_changed

```json
{
  "type": "remotes_changed",
  "timestamp": "2026-01-01T00:00:00Z",
  "remotes": [ /* RemoteConfig[] */ ],
  "trigger": "add:checkout"
}
```

`trigger` is a short label like `add:<name>`, `update:<name>`, `delete:<name>`, `toggle:<name>`, or `host_deleted`.

### host_changed

```json
{
  "type": "host_changed",
  "timestamp": "2026-01-01T00:00:00Z",
  "host": { /* Host */ },
  "trigger": "created" | "updated" | "deleted" | "toggle"
}
```

### gate_changed

```json
{
  "type": "gate_changed",
  "timestamp": "2026-01-01T00:00:00Z",
  "gate": { /* GateWithHost */ },
  "trigger": "created" | "updated" | "deleted" | "toggle" | "host_reassigned",
  "old_host_id": "01HXY..." | null,
  "new_host_id": "01HXZ..." | null
}
```

`old_host_id` and `new_host_id` are populated only when `trigger == "host_reassigned"`.

### config_changed

```json
{
  "type": "config_changed",
  "timestamp": "...",
  "section": "rate_limiting" | "ws_reconnect" | "circuit_breaker" | "graceful_shutdown" | "metrics" | "gateway_protection" | "gateway",
  "value": { /* the new config section */ }
}
```

### reconnect_policy_changed

```json
{
  "type": "reconnect_policy_changed",
  "timestamp": "...",
  "policy": { /* WsReconnectConfig */ }
}
```

Sent specifically when the WS reconnect policy changes — clients should adopt the new policy without disconnecting.

### system_health

```json
{
  "type": "system_health",
  "timestamp": "...",
  "snapshot": { /* implementation-defined snapshot */ }
}
```

Periodic, default every `HEALTH_CHECK_INTERVAL_MS`.

### log

```json
{
  "type": "log",
  "entry": {
    "timestamp": "...",
    "level": "info" | "warn" | "error" | "debug" | "trace",
    "target": "registry",
    "message": "...",
    "correlationId": "..."
  }
}
```

Live tail of the ring-buffered registry logs. The portal's Logs page subscribes to this.

### token_rotated

```json
{
  "type": "token_rotated",
  "timestamp": "...",
  "previous_token_expired": false
}
```

Fires on `POST /api/config/token/rotate`. The portal uses this to swap its stored token transparently.

### registry_shutting_down

```json
{
  "type": "registry_shutting_down",
  "timestamp": "...",
  "resume_in_ms": 8000
}
```

Sent before the registry begins its graceful drain. Clients should hold reconnect attempts for at least `resume_in_ms`.

### pong

```json
{ "type": "pong", "timestamp": "..." }
```

Response to a client `ping`.

## Client → server

### ping

```json
{ "type": "ping" }
```

Keep-alive. The server replies with `pong`.

### subscribe / unsubscribe

```json
{ "type": "subscribe",   "subscribe": "<channel>" }
{ "type": "unsubscribe", "subscribe": "<channel>" }
```

Reserved for future scope filters. Today the server fans every message out to every connected client.

### subscribe_gate

```json
{ "type": "subscribe_gate", "gate_name": "storefront-prod" }
```

The gateway uses this to declare which gate it serves. Once subscribed, the gateway only receives changes that affect its gate's host or remotes — though today's implementation still sends every message and the gateway filters locally.

## Reading the code

- Types: `nexus-registry/src/ws/messages.rs`.
- Broadcast hub: `nexus-registry/src/ws/hub.rs`.
- Gateway WebSocket bridge: `nexus-gateway/src/ws_proxy.rs`.

## Next

- [Reference: api-reference](api-reference.md) — every endpoint that triggers these messages.
- [`@bimo-dk/nexus-client`](../packages/nexus-client.md) — typed `RegistryWebSocket` client.
- [Infra: registry](../infrastructure/infra-registry.md) — broadcasts in context.
