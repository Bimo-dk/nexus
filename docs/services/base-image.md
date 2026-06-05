---
id: base-image
title: nexus-base-image
sidebar_position: 7
description: The shared Docker base layer used by every Nexus service. Pinned Node, npm, and tool versions. Cache-friendly for fast rebuilds.
keywords:
  - micro frontend docker
  - shared base image
  - nexus-base-image
---

# nexus-base-image

The `nexus-base-image` repository ships a single Docker image used as the build stage for every Nexus service that needs Node.js. It exists for two reasons:

- **Pin tool versions in one place.** Node, npm, build essentials.
- **Make CI fast.** Every service's Docker build reuses the base layer, so `npm ci` is the only download per build.

Published image: `ghcr.io/bimo-dk/nexus-base:latest` (also versioned `:1.0`, `:1.0.0`).

## What's in it

```dockerfile
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git wget \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@10

WORKDIR /app
```

That's it. The point is *reproducibility*: every service depends on the same Node 22 patch level, the same npm 10 patch level, and the same OS package set.

## How services use it

Every Nexus service (host template, remote templates, portal) starts its Dockerfile with:

```dockerfile
# syntax=docker/dockerfile:1.6
FROM ghcr.io/bimo-dk/nexus-base:latest AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --prefer-offline
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

The runtime stage is service-specific (nginx for SPAs, distroless for Rust). The build stage is always `nexus-base`.

## Build

```bash
cd nexus-base-image
docker build -t ghcr.io/bimo-dk/nexus-base:dev .
```

## Updating Node

Bump the `FROM node:22-bookworm-slim` line, build, publish a new tag, then re-build downstream services pointing at the new tag. Use a versioned tag (`:1.1`) rather than `:latest` in production for reproducibility.

## Next

- [Workflows: deployment](../workflows/deployment.md) — building and shipping a service image.
- [Reference: security](../reference/security.md) — why BuildKit secrets matter when this image installs npm packages.
