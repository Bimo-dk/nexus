---
id: commercial-license
title: Commercial license
sidebar_position: 99
description: Nexus is dual-licensed. The open-source release is AGPL-3.0-or-later; a commercial license is available for organisations that cannot adopt AGPL. Contact svp@bimo.dk.
keywords:
  - nexus license
  - AGPL micro frontend
  - commercial license
  - dual license
---

# Commercial license

Nexus is **dual-licensed**. Pick the model that matches your organisation's needs.

## Open source — AGPL-3.0-or-later

The open-source release of every Nexus repository (registry, gateway, portal,
proxy, base image, runtime packages, build tooling, CLI, host and remote
scaffolds) is published under the **GNU Affero General Public License v3.0
or any later version** (`AGPL-3.0-or-later`).

The AGPL is a strong copyleft license. The most important implication for
network-facing software:

> If you modify Nexus and run the modified version to provide a service
> over a network, you must make the complete source of your modified
> version available to the users of that service under the same AGPL
> license.

For many teams this is fine — Nexus is designed to be used as-is, with
business components living in *your* repos that are not derivative works
of Nexus itself. Your remotes, hosts, and component code are yours; only
modifications to the Nexus platform itself trigger AGPL obligations.

Full license text: [`LICENSE`](https://github.com/Bimo-dk/nexus/blob/main/LICENSE).
Canonical AGPL-3.0 text: https://www.gnu.org/licenses/agpl-3.0.html.

## Commercial license

A separate commercial license is available for organisations that:

- Cannot release modifications to Nexus under the AGPL (typical for closed
  source SaaS products built on Nexus).
- Need a different warranty, indemnity, or support arrangement than the
  AGPL provides (it provides none).
- Are required by procurement or legal policy to use software under a
  non-copyleft license.
- Want priority bug fixes, custom features, or a written SLA.

The commercial license grants the same code under terms that do not
trigger the AGPL's source-disclosure requirement for derivative works
or network use.

### Contact

For pricing, scope, and contract details:

**Steffen Vitten Pedersen**
[svp@bimo.dk](mailto:svp@bimo.dk)

Include in your first email:

- Company name and a short description of how Nexus will be used
  (gateway-only? full platform? embedded in a product?).
- Approximate scale (number of hosts, remotes, peak request rate).
- Deployment model (single SaaS instance, on-prem per customer,
  multi-tenant).
- Whether you need modifications to Nexus itself or only build on top
  of the unmodified platform.

A first reply with a quote and proposed terms usually lands within two
business days.

## Which one do I need?

| Your situation | License |
|---|---|
| You build remotes / hosts / components against unmodified Nexus and your remote source is yours | AGPL is fine |
| You modify the Nexus gateway, registry, portal, or any package and run it as a service for users | AGPL requires you to publish your modifications |
| You modify Nexus and *do not want to publish* the modifications | Commercial license |
| You embed Nexus into a closed-source product you sell | Commercial license |
| You need a contract with warranty, indemnity, or SLA | Commercial license |
| You are not sure | Email [svp@bimo.dk](mailto:svp@bimo.dk) and describe the situation — we will tell you honestly |

## Honesty note

We do not "AGPL-trap" the project. The AGPL terms are real but the bar
to comply is low for the most common Nexus use cases. If your team uses
the platform unmodified and writes your business code in your own repos,
you do not owe anyone source disclosure. The commercial license exists
for the cases where AGPL genuinely does not fit — not as a forced
upgrade path.
