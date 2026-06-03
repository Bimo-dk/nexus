# Nexus — Angular Micro Frontend Platform

**Nexus** is an Angular 19 micro frontend platform built on top of `@angular-architects/native-federation`. The template delivers zero-downtime architecture, dynamic runtime remote loading, Docker orchestration, registry with WebSocket broadcast, fallback chain, health checks, `X-Nexus-Token` security, correlation IDs, and a full admin manager app.

> **Relationship to Native Federation:** Native Federation is the underlying ESM-based federation library (analogous to Webpack Module Federation, but build-system-agnostic). Nexus adds registry, host orchestration, decorator-based config generation, dev proxy and admin UI on top. The library's API names (`loadRemoteModule`, `withNativeFederation`, `federation.config.js`) remain in the code — they are library convention.

---

## Developer workflow

Two workflows developers need to know — no federation configuration or local environment setup required.

### A. Create a new remote (3 commands, no manual config)

```bash
# 1. Scaffold via Angular schematic — prompts for name, route, port
npm run nexus:new

# 2. Build — prebuild scans @NexusRemote decorators and generates federation.config.json automatically
cd <your-new-remote> && npm install && npm run build

# 3. Register with the registry — reads federation.config.json, POSTs to /api/remotes
NEXUS_TOKEN=... REMOTE_URL=https://your-host/remotes/myRemote/remoteEntry.json npm run nexus:publish
```

You **only** need to edit `src/app/remote-entry/entry.component.ts`. `@NexusRemote({ name, route })` on the class is the sole configuration touch-point — all federation config is generated automatically.

### B. Work locally on one remote with hot reload (1 command)

```bash
npm run dev:remote-one    # OR: dev:remote-two
```

Open http://localhost:9000 — you see the complete app with:

- **Your own remote** (remote-one) running locally on port 8666 with Angular's hot module replacement
- **Everything else** (host, other remotes, registry, manager) proxied to the shared environment defined in `nexus.dev.json`

No Docker, no local dependencies for other services, no federation configuration. Read `dev-tools/README.md` for details on proxy routing and how to point at staging.

---

## Architecture

```
                         Browser
                            |
                            v
              http://localhost:8668  (app)
                            |
                            | loaded via Native Federation
                            v
              http://localhost:8667  (host - layout shell)
                            |
                            | dynamic loader from registry
              +-------------+-------------+
              |             |             |
              v             v             v
        remote-one     remote-two    [future remotes...]
        :6666          :6671

                  +------------------------+
                  |   registry  (:3000)    |  source of truth
                  |   JSON persistence     |
                  +------------------------+
                            ^
                            | admin REST API
                            |
              http://localhost:8669  (manager)
```

**Deploy flow with no downtime:**

1. One remote is changed and built as a new Docker container.
2. Docker starts the new container on the same port.
3. `app` fetches `host`, `host` fetches remotes from `registry` at runtime.
4. None of the other apps restart — the user sees the update on the next navigation.

---

## Quick start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — set NEXUS_TOKEN to a strong secret

# 2. Start all services
docker compose up --build

# 3. Open browser
# Application: http://localhost:8668
# Manager:     http://localhost:8669
# Registry:    http://localhost:3000/api/remotes (requires X-Nexus-Token header)
```

---

## Ports overview

| Service       | Port  | Purpose                                              |
|---------------|-------|------------------------------------------------------|
| `app`         | 8668  | Entry point — the user always goes here              |
| `host`        | 8667  | Layout shell — loads remotes dynamically             |
| `remote-one`  | 8666  | Example micro frontend #1                            |
| `remote-two`  | 8671  | Example micro frontend #2                            |
| `manager`     | 8669  | Admin UI: toggle, status, redeploy                   |
| `registry`    | 3000  | Source of truth for all remotes                      |

---

## Environment variables

| Variable             | Default                                                                                              | Description                                          |
|----------------------|------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| `NEXUS_TOKEN`        | `change-this-to-a-strong-secret-in-production`                                                       | Used as `X-Nexus-Token` header                       |
| `ALLOWED_ORIGINS`    | `http://localhost:8666,6667,6668,6669,6671`                                                          | Comma-separated list for registry CORS               |
| `REGISTRY_URL`       | `http://localhost:3000`                                                                              | URL Angular apps are built against (injected as env) |

---

## Add a remote via the manager

1. Go to http://localhost:8669
2. Navigate to **Remotes** -> **Add remote**
3. Fill in:
   - **name** — camelCase unique name, e.g. `remoteThree`
   - **url** — `http://localhost:6680/remoteEntry.json` (your new remote)
   - **exposedModule** — `./RemoteEntry`
   - **routePath** — kebab-case URL, e.g. `remote-three`
4. Click **Save** -> the registry persists the change.
5. Within 30 seconds, `host` discovers the change via polling and registers the route.
6. Go to http://localhost:8668/remote-three — the micro frontend is live.

---

## Deploy a new remote (Dockerized)

1. Make a copy of `remote-one/` to `remote-three/`.
2. Adjust `federation.config.js` (`name: 'remoteThree'`).
3. Adjust `nginx.conf` health response (`remote: 'remoteThree'`).
4. Add a service block in `docker-compose.yml`:

   ```yaml
   remote-three:
     build: ./remote-three
     ports: ["6680:80"]
     networks: [nexus-net]
   ```

5. `docker compose up -d --build remote-three`
6. Add the remote via the manager UI (see above) — host loads it dynamically.

---

## Zero-downtime update of an existing remote

```bash
# Only remote-one is updated — no other services are affected
docker compose up --build --no-deps remote-one
```

`host` discovers the new version within 30 seconds via its polling loop. Active users continue without interruption; the next navigation to that remote loads the updated federation entry.

---

## Security

### `X-Nexus-Token`

All write and read endpoints on the registry require the `X-Nexus-Token` header — only `GET /health` is exempt. The token is defined as the environment variable `NEXUS_TOKEN`.

Angular apps get the token injected via Docker build args, and a functional HTTP interceptor (`nexusAuthInterceptor`) adds it automatically on all requests against the registry URL.

### Security headers

Each Nginx server sets:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### CORS

Registry allows only origins in the `ALLOWED_ORIGINS` list.

---

## Health checks

| Endpoint                                  | Auth | Expected response                                    |
|-------------------------------------------|------|------------------------------------------------------|
| `GET http://localhost:3000/health`        | No   | `{"status":"ok","timestamp":"..."}`                  |
| `GET http://localhost:8666/health`        | No   | `{"status":"ok","remote":"remoteOne"}`               |
| `GET http://localhost:8671/health`        | No   | `{"status":"ok","remote":"remoteTwo"}`               |
| `GET http://localhost:3000/api/remotes`   | **Yes** | `{"remotes":[...],"total":N,"enabled":M}`         |

The manager dashboard polls all remote-health endpoints every 30 seconds.

---

## Development mode (local run without Docker)

```bash
# 1. Install dependencies in all workspaces
cd registry && npm ci && cd ..
cd app && npm ci && cd ..
cd host && npm ci && cd ..
cd remote-one && npm ci && cd ..
cd remote-two && npm ci && cd ..
cd manager && npm ci && cd ..

# 2. Start registry in one terminal window
cd registry && npm run dev

# 3. Start each Angular app in its own terminal window
cd remote-one && npm start  # -> http://localhost:8666
cd remote-two && npm start  # -> http://localhost:8671
cd host && npm start        # -> http://localhost:8667
cd app && npm start         # -> http://localhost:8668
cd manager && npm start     # -> http://localhost:8669
```

---

## Verification — checklist

- [ ] `docker compose up --build` starts all 6 services without errors
- [ ] http://localhost:8668 shows the app with host's layout and remote-one's content
- [ ] http://localhost:8669 shows the manager with status of all remotes
- [ ] `GET http://localhost:3000/health` returns 200 without a token
- [ ] `GET http://localhost:3000/api/remotes` returns 401 without a token
- [ ] `GET http://localhost:3000/api/remotes` with the correct token returns the remote list
- [ ] Stop the remote-one container -> host shows `down` status within 60 seconds
- [ ] Add a new remote via the manager -> shows up in host navigation within 30 seconds without restart
- [ ] `docker compose up --build --no-deps remote-one` only updates remote-one
- [ ] registry.json survives `docker compose down && docker compose up` (volume persistence)

---

## File naming convention

`federation.config.js` and `federation.config.json` are Native Federation library convention and are kept as filenames. The content is controlled by the Nexus tooling — you never edit these files manually; they are generated from `@NexusRemote` decorators at `npm run build`.
