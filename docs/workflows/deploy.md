---
id: deploy
title: Deployment
sidebar_position: 4
description: Deploy a Nexus micro frontend stack to production. Docker Compose, GitHub Actions CI, environment variables, BuildKit secrets, health checks and rollback strategy — the complete production deployment guide.
keywords: [Angular micro frontend deployment, Docker Compose micro frontend, GitHub Actions Angular CI, micro frontend production deploy]
---

# Deployment

Two surfaces to think about:

1. **The orchestrator** — gateway + portal + registry + host (your shared infra).
2. **Each remote** — own repo, own CI, own image, own deploy schedule.

Each can be deployed and updated independently.

## Orchestrator deploy

The `nexus` repo contains the `docker-compose.yml` that ties services together. In production it typically lives on a single Docker host (or Swarm node), or its equivalent k8s manifest is generated from it.

```bash
# Cold start
cp .env.example .env
# Set NEXUS_TOKEN, NODE_AUTH_TOKEN, ALLOWED_ORIGINS

docker login ghcr.io -u <user> --password-stdin <<< "$NODE_AUTH_TOKEN"

docker compose up -d --build
```

Public ports:

- `:8668` — gateway
- `:8669` — portal

Front this with a TLS terminator (Caddy, Cloudflare, nginx-proxy, an LB) that maps your domain to those two ports.

## Per-remote deploy

A remote is its own Docker image. The team that owns the remote builds and pushes:

```bash
# In <remote-repo>/
docker build \
  --secret id=node_auth_token,env=NODE_AUTH_TOKEN \
  -t my-registry/checkout:$VERSION \
  .

docker push my-registry/checkout:$VERSION
```

To go live, the image is referenced by the orchestrator (compose or k8s) and rolled in:

```bash
# On the orchestrator host
docker compose pull checkout
docker compose up -d --no-deps checkout
```

Three things make this safe:

1. `--no-deps` means *only* `checkout` restarts.
2. The gateway's nginx never caches `remoteEntry.json` — the new bundle is served immediately.
3. The container's bootstrap re-announces itself to the registry via `PUT /api/remotes/checkout` (idempotent).

See [zero-downtime updates](zero-downtime.md) for the timeline.

## Production environment

| Setting | Recommendation |
|---|---|
| TLS termination | At an LB in front of the gateway. Never on the gateway container itself. |
| `NEXUS_TOKEN` | 32+ random bytes (e.g. `openssl rand -hex 32`). Rotate via container restart. |
| `ALLOWED_ORIGINS` | Explicit allowlist of your public hostnames. Never `*`. |
| `registry-data` volume | Backed up daily — small (KB) but critical. |
| `HEALTH_CHECK_INTERVAL_MS` | Default 30s is fine; lower it on tiny stacks where you want faster fail-over visibility. |
| Logging | The registry buffers 500 lines in-process. Stream `docker logs` to your central log system as well. |
| Metrics | Scrape `GET /api/system/metrics` from the portal or a sidecar. |
| Backup remotes | Bake a `staticBackupUrl` JSON into the host image with your "must-have" remotes — host falls back to this if registry is unreachable on cold start. |

## CI/CD shape

Per-remote pipeline (boilerplate):

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          DOCKER_BUILDKIT=1 docker build \
            --secret id=node_auth_token,env=NODE_AUTH_TOKEN \
            -t ghcr.io/${{ github.repository }}/checkout:${{ github.sha }} \
            -t ghcr.io/${{ github.repository }}/checkout:latest \
            .
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NODE_AUTH_TOKEN }}
      - name: Push
        run: docker push --all-tags ghcr.io/${{ github.repository }}/checkout
      - name: Deploy
        run: |
          ssh deploy@host 'cd /srv/nexus && docker compose pull checkout && docker compose up -d --no-deps checkout'
```

The two interesting bits:

- `--secret id=node_auth_token,env=NODE_AUTH_TOKEN` — the BuildKit secret pattern; the token never ends up in the image.
- `--no-deps` on `docker compose up` — only the remote restarts.

## Compose vs. Swarm vs. k8s

For ≤ 10 services on one box, plain compose is enough. For larger fleets, k8s. The model is identical: every remote is a Deployment+Service+Ingress; the gateway sits in front; the registry has a PV for `data/`.

A k8s helm chart for the orchestrator is on the roadmap.

## Rollback

For a remote:

```bash
docker compose up -d --no-deps --build=false --no-recreate checkout
# ... wait, that's a no-op. Use a versioned image instead:
sed -i 's|checkout:.*|checkout:1.2.2|' docker-compose.yml
docker compose up -d --no-deps checkout
```

The registry will receive a `PUT /api/remotes/checkout` from the old version's bootstrap and re-register. Host gets the broadcast, re-loads `remoteEntry.json` (no-cache), gets the old chunks. User sees the old version on next navigation.

For the registry:

```bash
docker compose up -d --no-deps registry
```

The `registry-data` volume is unchanged across container versions (as long as the JSON schema in `data/registry.json` is back-compatible — it has been since 1.0).
