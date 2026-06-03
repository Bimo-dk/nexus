# Nexus

> **An open-source Angular micro frontend platform — developed by Bimo.**

**Nexus** is an Angular 19 micro frontend platform on top of Native Federation. It bundles a gateway, a host shell, a registry with WebSocket broadcast, an admin portal, a dev proxy, and a 7-package ecosystem so a team can ship independent remotes with zero downtime.

MIT-licensed. Free to use, free to fork, contributions welcome.

> 📚 **Documentation site:** generated from [`docs/`](./docs/) and deployed to GitHub Pages by [`.github/workflows/deploy-docs.yml`](./.github/workflows/deploy-docs.yml) on every push to `main`.

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

## GitHub Pages deployment

The site is built and deployed automatically by the workflow at `.github/workflows/deploy-docs.yml`:

1. Enable Pages on the repo: **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` — the workflow builds Docusaurus and deploys to GitHub Pages.

The workflow auto-detects the GitHub org and repo name (`${{ github.repository_owner }}` and `${{ github.event.repository.name }}`), so no config edit is needed if you fork or rename the repo.

For local docs builds outside GitHub Actions, optionally set `GITHUB_ORG` and `GITHUB_REPO` env-vars (defaults to placeholders).

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

## About

Nexus is an open-source project developed and maintained by **Bimo**. Built to give multi-team Angular products an honest path to micro frontends — no proprietary runtime, no lock-in, just sensible defaults on top of an ESM federation spec.

## License

MIT — see [LICENSE](./LICENSE).
