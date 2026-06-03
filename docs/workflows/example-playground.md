---
id: example-playground
title: Example playground
sidebar_position: 5
---

# Example playground (`nexus-example`)

Repo: [`nexus-example`](https://github.com/Bimo-dk/nexus-example)

A drop-in, runnable demonstration of the whole stack. Pre-built images for gateway, portal and registry are pulled from ghcr.io; host and two remotes are built locally from editable source. Use it to experiment with the platform without going through the full multi-repo setup.

## What you get

```
nexus-example/
├── docker-compose.yml
├── .env.example
├── host/             ◄── local source — edit and rebuild
├── remote-one/       ◄── local source — edit and rebuild
└── remote-two/       ◄── local source — edit and rebuild
```

| Service | Image | Source |
|---|---|---|
| `gateway` | `ghcr.io/bimo-dk/nexus-gateway` | pre-built |
| `portal` | `ghcr.io/bimo-dk/nexus-portal` | pre-built |
| `registry` | `ghcr.io/bimo-dk/nexus-registry` | pre-built |
| `host` | built locally | `./host/` |
| `remote-one` | built locally | `./remote-one/` |
| `remote-two` | built locally | `./remote-two/` |

## Quick start

```bash
git clone https://github.com/Bimo-dk/nexus-example.git
cd nexus-example

cp .env.example .env
# Set NEXUS_TOKEN and NODE_AUTH_TOKEN

echo "$NODE_AUTH_TOKEN" | docker login ghcr.io -u <your-github-user> --password-stdin

docker compose up --build
```

When everything is healthy:

- http://localhost:8668 — the application
- http://localhost:8669 — the admin portal

## Try the developer loops

### Edit a remote

```bash
# Open ./remote-one/src/app/remote-entry/entry.component.ts in your editor
# Change the template
docker compose up -d --build remote-one
# Hard-refresh browser — your change is live
```

### Edit the host

```bash
# Open ./host/src/app/...
docker compose up -d --build host
# Hard-refresh browser
```

### Add a remote via the portal

1. http://localhost:8669 → **Remotes → Add remote**
2. Fill in name + URL
3. Save — host discovers it via WebSocket and registers the route within seconds.

### Add a remote with code

1. Scaffold with `bnx generate remote` (from `@bimo-dk/nexus-cli`).
2. Add a service to this `docker-compose.yml`:
   ```yaml
   remote-three:
     build: ./remote-three
     expose: ["80"]
     networks: [nexus-net]
   ```
3. **Extend the gateway image** to know about `/remotes/remoteThree/*` — see [gateway docs](../services/gateway.md#adding-a-route-for-a-new-remote). The pre-built image only knows about `remoteOne` and `remoteTwo`.
4. `docker compose up --build remote-three`
5. Register via the portal UI.

## How the gateway routes (in this demo)

The pre-built `gateway` image has hard-coded proxy rules for two remotes — exactly to keep this example trivial:

| URL prefix | Target |
|---|---|
| `/host/*` | `host:80/*` |
| `/remotes/remoteOne/*` | `remote-one:80/*` |
| `/remotes/remoteTwo/*` | `remote-two:80/*` |
| `/api/*` | `registry:3000/api/*` |
| `/ws` | `registry:3000/ws` |

This is why the service names in this `docker-compose.yml` must match exactly: `host`, `remote-one`, `remote-two`, `registry`.

## Troubleshooting

| Problem | Solution |
|---|---|
| `denied: requested access to the resource is denied` on `docker compose pull` | Log in to ghcr.io: `docker login ghcr.io` with a PAT |
| Host build fails with `401 Unauthorized` | `NODE_AUTH_TOKEN` is missing or lacks `read:packages` |
| Browser shows "Host shell unavailable" | The host container hasn't come up — `docker compose logs host` |
| Portal shows no remotes | Registry volume is empty — `docker compose down -v && docker compose up` |

## What this example is NOT

- Not a production template — gateway is pinned to two remotes by build.
- Not a replacement for `bnx dev` (which is a far better developer loop for a real product).
- Not exhaustive — the editable services are deliberately minimal so you can read every file.

Use it as a 60-minute introduction to the platform, not the foundation of your own product.
