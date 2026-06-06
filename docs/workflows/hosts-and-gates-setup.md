---
id: hosts-and-gates-setup
title: Hosts and gates setup
sidebar_position: 8
description: Step-by-step setup for the three-entity model. Create your first host, your first gate, and verify the routing works end to end.
keywords:
  - micro frontend hosts
  - micro frontend gates
  - bnx hosts gates
  - first-time setup
---

# Hosts and gates setup

The minimum-viable setup for a fresh Nexus stack. By the end you have one host, one gate, and a confirmed routing path.

## Prerequisites

- A running Nexus stack (see [Installation](../getting-started/installation.md)).
- `bnx` installed, `NEXUS_TOKEN` and `REGISTRY_URL` set.

## 1. Create a host

```bash
bnx hosts create
? Host name (camelCase): storefront
? URL: http://host-angular:80
? Framework: angular
? Remote entry: /remoteEntry.json
? Exposed module: ./AppShell
```

Verify:

```bash
bnx hosts list
# storefront (angular)   enabled   0 gates
```

## 2. Create a gate

```bash
bnx gates create
? Gate name: storefront-local
? Domain: localhost:8668
? Host: storefront
```

Verify:

```bash
bnx gates list
# storefront-local   localhost:8668   -> storefront
```

`bnx hosts list` now shows `1 gate` for `storefront`.

## 3. Confirm the gateway picked up the change

Open `http://localhost:8668/health`:

```json
{
  "status": "ok",
  "service": "nexus-gateway",
  "registry_connected": true,
  "gate": "storefront-local",
  "host": "storefront",
  "framework": "angular",
  "route_count": 1
}
```

If `gate` is `null`, the gateway didn't find a gate for its `NEXUS_GATE_NAME` (or the default first gate). Restart the gateway after creating the first gate, or set `NEXUS_GATE_NAME=storefront-local` explicitly in the gateway's environment.

## 4. Start the host container

```bash
docker run --rm --name host-angular -p 8000:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  --network nexus_default \
  ghcr.io/bimo-dk/nexus-host-template:latest
```

(In production, the host is part of your compose file, not started manually.)

## 5. Add a remote

```bash
bnx generate remote
? Remote name: catalog
? Route path: catalog
? Framework: angular

cd catalog && npm install && npm run build
docker build -t catalog .
docker run --rm --name catalog -p 8700:80 \
  -e REGISTRY_INTERNAL_URL=http://registry:8670 \
  -e NEXUS_TOKEN=$NEXUS_TOKEN \
  -e PUBLIC_URL=/remotes/catalog/remoteEntry.json \
  -e UPSTREAM_URL=http://catalog:80 \
  --network nexus_default \
  catalog
```

Verify:

```bash
bnx status
# Hosts
#   storefront (angular)   enabled   1 gate
#
# Gates
#   storefront-local       localhost:8668 -> storefront
#
# Remotes
#   catalog (global)       enabled   /remotes/catalog/*
```

Open `http://localhost:8668/catalog` — the catalog component renders inside the host shell.

## Adding more gates

You can attach more gates to this same host. Each gets its own domain. See [multi-domain-setup](multi-domain-setup.md).

## Adding more hosts

```bash
bnx hosts create
? Host name: admin
? Framework: vue
? URL: http://host-vue:80
? ...
```

Then a gate for it:

```bash
bnx gates create
? Gate name: admin-local
? Domain: admin.localhost
? Host: admin
```

You now have two hosts and two gates, sharing the same registry and gateway. Different domains route to different hosts; remotes can be `global` (visible to both) or `host:<id>` (locked to one).

## Next

- [Workflows: multi-domain-setup](multi-domain-setup.md) — multiple gates per host.
- [Workflows: create-remote-angular](create-remote-angular.md) — add more remotes.
- [Infra: hosts-and-gates](../infrastructure/infra-hosts-and-gates.md) — mental model.
