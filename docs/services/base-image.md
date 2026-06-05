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
# Build-stage base: Node 22 + git + wget + curl + bash
FROM node:22-alpine AS bimo-nexus-builder
RUN apk add --no-cache git wget curl bash
WORKDIR /app
RUN mkdir -p /app/src /app/public

# Runtime-stage base: nginx-alpine + wget + curl + healthcheck
FROM nginx:alpine AS bimo-nexus-runtime
RUN apk add --no-cache wget curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
```

Two stages, two roles. The build stage compiles your application; the runtime stage serves the static output. Every service depends on the same Node 22 patch level, the same nginx-alpine base, and the same set of system tools — so a build that works on one service reproduces on every other.

## How services use it

Every Nexus SPA service (host templates, remote templates, portal) chains the two stages:

```dockerfile
# syntax=docker/dockerfile:1.6
FROM ghcr.io/bimo-dk/nexus-base:22-alpine AS bimo-nexus-builder AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --prefer-offline
COPY . .
RUN npm run build

FROM ghcr.io/bimo-dk/nexus-base:22-alpine AS bimo-nexus-runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Rust services (registry, gateway) don't use this base — they have their own multi-stage `rust:1.83` → `distroless/cc` Dockerfile.

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
