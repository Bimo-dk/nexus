---
id: about
title: About Nexus
sidebar_position: 98
description: The story behind Nexus. Built inside Bimo in 2024 to run micro frontends fast, opened up in 2026 because the architecture that solved Bimo's problem is the same architecture every other team needs.
keywords:
  - about nexus
  - nexus history
  - Bimo
  - Steffen Vitten Pedersen
  - open source micro frontend
---

# About Nexus

## The short version

Nexus was built by Steffen Vitten Pedersen for Bimo in 2024. The problem
was specific: Bimo needed to ship new product features fast across multiple
Angular, Vue, and React micro frontends without every team waiting on
platform-engineering tickets to push infrastructure changes. Existing
micro frontend tooling solved half of the problem each — module federation
the build half, single-spa the routing half, Bit the components half — and
nothing was built to run hundreds of remotes from one place in production
with the kind of zero-downtime hot-swap that Bimo needed.

So Steffen built it.

It lived in Bimo's private repos for two years while we used it daily
internally — running real production traffic, fixing real edge cases,
hardening the gateway and registry against actual load. By early 2026
the platform had stopped being a moving target. The bug rate dropped.
The way teams onboarded onto it stabilised. We started to feel that
keeping it private was costing more than it gained.

After a conversation about that trade-off, Steffen Vitten Pedersen
decided to open the project: the same architecture that fixed Bimo's
deployment speed solves the exact same problem for every other team
shipping micro frontends. Holding it back did not make us better at
building product — it just made the rest of the ecosystem worse at
shipping platform code that already had a good answer.

## Why this changes the architecture (not just the license)

Open-sourcing Nexus was not a re-flag exercise. The Bimo-internal
version assumed:

- One organisation, one set of conventions, one Postgres.
- Gateways routing to hosts whose names the team already knew.
- Tokens shared by humans, not rotated automatically.
- A docs site written for developers who could ask in Slack when something
  was unclear.

Every one of those assumptions had to come out. The public release
of Nexus has:

- Multi-database storage in both registry and portal (SQLite, Postgres,
  MySQL, MariaDB), runtime-selected. A small team starts on SQLite and
  upgrades to Postgres later without changing code.
- Multi-domain gateways: one platform install can serve several public
  domains, each with its own host shell.
- A first-class CLI (`bnx`) that takes a brand-new tenant developer from
  an empty directory to a published remote in one read — `bnx init`,
  `bnx generate host`, `bnx generate remote`, `bnx generate component`,
  `bnx dev --env <stack>`.
- BYOF cross-framework mounting so an Angular host can load a Vue or
  React remote (and vice versa) without forcing everyone onto the same
  framework. That story is what made Nexus generally useful instead of
  just Bimo's internal toolchain.
- Documentation written for a reader who does not have an internal
  Slack channel to fall back on — that includes [the step-by-step
  dev-mode walkthrough](workflows/dev-mode.md) with diagrams and real
  portal screenshots.

## Why AGPL

The open-source release is licensed under the GNU Affero General
Public License v3.0 or any later version. The choice is deliberate.

Nexus is platform infrastructure. The whole value of it is that
everyone improves the same code, no one runs a secretly-forked version
that diverges over years. AGPL is the strongest copyleft license that
keeps the source visible even when the software is run as a
network-facing service — which is exactly what Nexus is.

For organisations that cannot adopt AGPL, a separate commercial
license is available. See [Commercial license](commercial-license.md).

## Who maintains Nexus

- **Steffen Vitten Pedersen** ([svp@bimo.dk](mailto:svp@bimo.dk)) —
  primary maintainer, original author. Built the initial private
  version inside Bimo in 2024; led the open-sourcing work in 2026.
- **Bimo** — the organisation that funded the original development,
  uses Nexus in production, and continues to invest in the
  open-source platform.

Issues, pull requests, and feature ideas go in the per-repo
[GitHub issue trackers under Bimo-dk](https://github.com/Bimo-dk).
Commercial license enquiries and partnership questions go to
[svp@bimo.dk](mailto:svp@bimo.dk).

## Timeline

| When | What |
|---|---|
| 2024 | Steffen Vitten Pedersen writes the first lines of Nexus for Bimo as a private internal platform. |
| 2024 – early 2026 | Lived in Bimo's private repos, running production traffic, hardened against real load. |
| Spring 2026 | Decision to open-source. Architecture rework began: multi-DB storage, multi-domain gateways, BYOF cross-framework, first-class CLI. |
| 2026-06 | First public 1.0 release on npm + ghcr. |
