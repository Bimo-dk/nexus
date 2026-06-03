# Nexus — Angular Micro Frontend Platform

**Nexus** er en Angular 19 micro frontend-platform bygget oven på `@angular-architects/native-federation`. Skabelonen leverer zero-downtime arkitektur, dynamisk runtime remote-loading, Docker-orchestration, registry med WebSocket-broadcast, fallback-chain, health checks, `X-Nexus-Token` sikkerhed, correlation IDs, og en fuld admin manager-app.

> **Forholdet til Native Federation:** Native Federation er det underliggende ESM-baserede federation-bibliotek (analogt med Webpack Module Federation, men byggesystem-agnostisk). Nexus tilføjer registry, host-orkestrering, decorator-baseret config-generering, dev proxy og admin UI ovenpå. Bibliotekets API-navne (`loadRemoteModule`, `withNativeFederation`, `federation.config.js`) forbliver i koden — de er biblioteks-konvention.

---

## Developer workflow

To workflows som udviklere skal kende — ingen federation-konfiguration eller lokalt miljø-setup nødvendigt.

### A. Opret en ny remote (3 kommandoer, ingen manuel config)

```bash
# 1. Scaffold via Angular schematic — prompter for navn, route, port
npm run nexus:new

# 2. Byg — prebuild scanner @NexusRemote-decoratorer og genererer federation.config.json automatisk
cd <din-nye-remote> && npm install && npm run build

# 3. Registrer hos registry — læser federation.config.json, POSTer til /api/remotes
NEXUS_TOKEN=... REMOTE_URL=https://your-host/remotes/myRemote/remoteEntry.json npm run nexus:publish
```

Du behøver **kun** redigere `src/app/remote-entry/entry.component.ts`. `@NexusRemote({ name, route })` på klassen er eneste konfigurations-touch-point — al federation-config genereres automatisk.

### B. Arbejd lokalt på én remote med hot reload (1 kommando)

```bash
npm run dev:remote-one    # ELLER: dev:remote-two
```

Åbn http://localhost:9000 — du ser den komplette app med:

- **Din egen remote** (remote-one) kører lokalt på port 8666 med Angular's hot module replacement
- **Alt andet** (host, andre remotes, registry, manager) proxyes til det delte miljø defineret i `nexus.dev.json`

Ingen Docker, ingen lokale dependencies for andre services, ingen federation-konfiguration. Læs `dev-tools/README.md` for detaljer om proxy-routing og hvordan du peger mod staging.

---

## Arkitektur

```
                         Browser
                            |
                            v
              http://localhost:8668  (app)
                            |
                            | loader via Native Federation
                            v
              http://localhost:8667  (host - layout shell)
                            |
                            | dynamisk loader fra registry
              +-------------+-------------+
              |             |             |
              v             v             v
        remote-one     remote-two    [fremtidige remotes...]
        :6666          :6671

                  +------------------------+
                  |   registry  (:3000)    |  source of truth
                  |   JSON persistens      |
                  +------------------------+
                            ^
                            | admin REST API
                            |
              http://localhost:8669  (manager)
```

**Deploy-flow uden downtime:**

1. Én remote ændres og bygges som ny Docker-container.
2. Docker starter den nye container på samme port.
3. `app` fetcher `host`, `host` fetcher remotes fra `registry` ved runtime.
4. Ingen af de andre apps genstarter — brugeren ser opdateringen ved næste navigation.

---

## Quick start

```bash
# 1. Klon og konfigurer
cp .env.example .env
# Rediger .env — sæt NEXUS_TOKEN til en stærk secret

# 2. Start alle services
docker compose up --build

# 3. Åbn browser
# Applikation: http://localhost:8668
# Manager:     http://localhost:8669
# Registry:    http://localhost:3000/api/remotes (kræver X-Nexus-Token header)
```

---

## Ports oversigt

| Service       | Port  | Formål                                              |
|---------------|-------|-----------------------------------------------------|
| `app`         | 8668  | Entry point — brugeren går altid hertil             |
| `host`        | 8667  | Layout shell — loader remotes dynamisk              |
| `remote-one`  | 8666  | Eksempel micro frontend #1                          |
| `remote-two`  | 8671  | Eksempel micro frontend #2                          |
| `manager`     | 8669  | Admin UI: toggle, status, redeploy                  |
| `registry`    | 3000  | Source of truth for alle remotes                    |

---

## Environment variables

| Variabel             | Default                                                                                              | Beskrivelse                                          |
|----------------------|------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| `NEXUS_TOKEN`   | `change-this-to-a-strong-secret-in-production`                                                       | Bruges som `X-Nexus-Token` header               |
| `ALLOWED_ORIGINS`    | `http://localhost:8666,6667,6668,6669,6671`                                                          | Komma-separeret liste til registry CORS              |
| `REGISTRY_URL`       | `http://localhost:3000`                                                                              | URL Angular-apps bygges mod (injectes som env)       |

---

## Tilføj en remote via manager

1. Gå til http://localhost:8669
2. Naviger til **Remotes** → **Add remote**
3. Udfyld:
   - **name** — camelCase unikt navn, fx `remoteThree`
   - **url** — `http://localhost:6680/remoteEntry.json` (din nye remote)
   - **exposedModule** — `./RemoteEntry`
   - **routePath** — kebab-case URL, fx `remote-three`
4. Tryk **Save** → registry persisterer ændringen.
5. Inden for 30 sekunder opdager `host` ændringen via polling og registrerer ruten.
6. Gå til http://localhost:8668/remote-three — micro frontenden er live.

---

## Deploy en ny remote (Dockerized)

1. Lav en kopi af `remote-one/` til `remote-three/`.
2. Tilret `federation.config.js` (`name: 'remoteThree'`).
3. Tilret `nginx.conf` health-svar (`remote: 'remoteThree'`).
4. Tilføj service-blok i `docker-compose.yml`:

   ```yaml
   remote-three:
     build: ./remote-three
     ports: ["6680:80"]
     networks: [nexus-net]
   ```

5. `docker compose up -d --build remote-three`
6. Tilføj remote via manager UI (se ovenfor) — host loader den dynamisk.

---

## Zero-downtime update af eksisterende remote

```bash
# Kun remote-one opdateres — ingen andre services berøres
docker compose up --build --no-deps remote-one
```

`host` opdager den nye version inden for 30 sekunder via sin polling-loop. Aktive brugere fortsætter uden afbrydelse; næste navigation til den remote loader den opdaterede federation entry.

---

## Sikkerhed

### `X-Nexus-Token`

Alle skrivnings- og læsnings-endpoints på registry kræver `X-Nexus-Token` header — undtaget er kun `GET /health`. Token defineres som miljøvariabel `NEXUS_TOKEN`.

Angular-apps får tokenet injiceret ind via Docker build-args, og en functional HTTP interceptor (`nexusAuthInterceptor`) tilføjer det automatisk på alle requests mod registry-URL'en.

### Security headers

Hver Nginx-server sætter:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### CORS

Registry tillader kun origins der står i `ALLOWED_ORIGINS`-listen.

---

## Health checks

| Endpoint                                  | Auth     | Forventet svar                                       |
|-------------------------------------------|----------|------------------------------------------------------|
| `GET http://localhost:3000/health`        | Nej      | `{"status":"ok","timestamp":"..."}`                  |
| `GET http://localhost:8666/health`        | Nej      | `{"status":"ok","remote":"remoteOne"}`               |
| `GET http://localhost:8671/health`        | Nej      | `{"status":"ok","remote":"remoteTwo"}`               |
| `GET http://localhost:3000/api/remotes`   | **Ja**   | `{"remotes":[...],"total":N,"enabled":M}`            |

Manager-dashboardet poller alle remote-health endpoints hvert 30. sekund.

---

## Development mode (lokal kørsel uden Docker)

```bash
# 1. Installer dependencies i alle workspaces
cd registry && npm ci && cd ..
cd app && npm ci && cd ..
cd host && npm ci && cd ..
cd remote-one && npm ci && cd ..
cd remote-two && npm ci && cd ..
cd manager && npm ci && cd ..

# 2. Start registry i ét terminalvindue
cd registry && npm run dev

# 3. Start hver Angular-app i hvert sit terminalvindue
cd remote-one && npm start  # → http://localhost:8666
cd remote-two && npm start  # → http://localhost:8671
cd host && npm start        # → http://localhost:8667
cd app && npm start         # → http://localhost:8668
cd manager && npm start     # → http://localhost:8669
```

---

## Verificering — checklist

- [ ] `docker compose up --build` starter alle 6 services uden fejl
- [ ] http://localhost:8668 viser app med host's layout og remote-one's indhold
- [ ] http://localhost:8669 viser manager med status på alle remotes
- [ ] `GET http://localhost:3000/health` returnerer 200 uden token
- [ ] `GET http://localhost:3000/api/remotes` returnerer 401 uden token
- [ ] `GET http://localhost:3000/api/remotes` med korrekt token returnerer remote-liste
- [ ] Stop remote-one container → host viser `down` status inden for 60 sekunder
- [ ] Tilføj ny remote via manager → vises i host navigation inden for 30 sekunder uden restart
- [ ] `docker compose up --build --no-deps remote-one` opdaterer kun remote-one
- [ ] registry.json overlever `docker compose down && docker compose up` (volume persistence)

---

## Filnavne-konvention

`federation.config.js` og `federation.config.json` er Native Federation library-konvention og beholdes som filnavne. Indholdet styres af Nexus-værktøjet — du redigerer aldrig disse filer manuelt, de genereres fra `@NexusRemote`-decoratorer ved `npm run build`.
