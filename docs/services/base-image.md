---
id: base-image
title: Base Image
sidebar_position: 7
---

# Base Image

Repo: [`nexus-base-image`](https://github.com/Bimo-dk/nexus-base-image) — Image: `ghcr.io/bimo-dk/nexus-base`

A small Alpine-based Docker image that every Bimo-Nexus service uses as its starting point. Pre-installs Node.js 22, nginx, `wget`, `curl`, `bash` and `git` so each downstream Dockerfile saves ~30s on `apk add` calls.

## Build & publish

```bash
cd nexus-base-image
docker build -t bimo-nexus-base:22-alpine .
docker tag bimo-nexus-base:22-alpine ghcr.io/bimo-dk/nexus-base:22-alpine
docker push ghcr.io/bimo-dk/nexus-base:22-alpine
```

CI in this repo does the push automatically on a tagged commit.

## Two stages

The Dockerfile is multi-stage and each Bimo-Nexus service picks the stage it needs:

| Stage | Includes | Used by |
|---|---|---|
| `bimo-nexus-builder` | `node:22-alpine`, `git`, `wget`, `curl`, `bash` | The builder stage of every service |
| `bimo-nexus-runtime` | `nginx:alpine`, `wget`, `curl` + default `HEALTHCHECK /health` | The runtime stage of Angular services (gateway, host, portal, remotes) |

`bimo-nexus-runtime` ships a default `HEALTHCHECK` that hits `/health` every 30s — every service overrides `nginx.conf` to actually answer that endpoint.

## Usage in a service Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7
FROM ghcr.io/bimo-dk/nexus-base:22-alpine AS bimo-nexus-builder AS builder
WORKDIR /app
COPY package*.json .npmrc ./
RUN --mount=type=secret,id=node_auth_token,required=true \
    NODE_AUTH_TOKEN=$(cat /run/secrets/node_auth_token) \
    npm install --legacy-peer-deps
COPY . .
RUN npm run build:prod

FROM ghcr.io/bimo-dk/nexus-base:22-alpine AS bimo-nexus-runtime
COPY --from=builder /app/dist/<service>/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

The `AS bimo-nexus-builder AS builder` syntax is valid Dockerfile — it pulls the stage `bimo-nexus-builder` from the base image and renames it `builder` locally. Same trick for runtime.

## When to bump the base image

- Major Node version (22 → 24)
- Switching nginx to a non-`alpine` base
- Adding a globally-needed tool (e.g. `jq`)

Anything more local (per-service deps) belongs in the service's own Dockerfile.

## Why a base image at all?

Without it every service Dockerfile re-runs the same `apk add wget curl bash` and `node:22-alpine` pull. With it:

- Builds are ~30s faster on cold cache.
- The OS layer is identical across services — security scans only need to flag one image.
- A single `HEALTHCHECK` policy is enforced.

The downside: if you bump the base, every downstream service must rebuild to see the change. The repo is versioned with the underlying Node tag (e.g. `22-alpine`, `24-alpine`) so a bump is opt-in per consumer.
