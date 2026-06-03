# Bimo-Nexus

**Angular 19 micro frontend platform on top of Native Federation.** Gateway, host shell, registry with WebSocket broadcast, admin portal, dev proxy, and a 7-package ecosystem.

> 📚 **Documentation**: [bimo-dk.github.io/nexus](https://bimo-dk.github.io/nexus/) — the site is built from [`docs/`](./docs/) and deployed automatically on every push to `main`.

## Quick start

```bash
cp .env.example .env
# Edit NEXUS_TOKEN, NODE_AUTH_TOKEN

docker compose up --build
```

Then open:

- **Application** — http://localhost:8668
- **Admin portal** — http://localhost:8669

## Documentation

| Section | What's covered |
|---|---|
| [Getting started](./docs/getting-started/installation.md) | Prereqs, env, compose, first remote |
| [Architecture](./docs/getting-started/architecture.md) | Request flow, deploy flow, fallback chain |
| [Services](./docs/services/gateway.md) | One page per service — gateway, registry, portal, host, remotes, proxy, base image |
| [Packages](./docs/packages/overview.md) | All 7 `@bimo-dk/nexus-*` packages |
| [Workflows](./docs/workflows/create-remote.md) | Create a remote, deploy, zero-downtime updates, local dev |
| [Reference](./docs/reference/environment.md) | Env vars, security, API, troubleshooting |

## Running the docs locally

```bash
npm install --legacy-peer-deps
npm run docs:start
# → http://localhost:3000
```

## Layout

```
nexus/                        # ← you are here — orchestrator + docs site
  docker-compose.yml
  docs/                       # markdown source — readable on GitHub, built by Docusaurus
  src/, static/               # docs theme + assets
  .github/workflows/          # deploy-docs.yml for GitHub Pages

nexus-gateway/                # public ingress (nginx + Angular SPA)
nexus-host-template/          # host layout shell template
nexus-portal/                 # admin UI
nexus-registry/               # source of truth (Node/Express + WS)
nexus-remote-templat/         # remote scaffold
nexus-proxy/                  # dev-time hot-reload proxy
nexus-base-image/             # shared Docker base
nexus-packages/               # @bimo-dk/* monorepo (Turbo + Changesets)
nexus-example/                # runnable demo orchestrator
```

## License

See [LICENSE](./LICENSE).
